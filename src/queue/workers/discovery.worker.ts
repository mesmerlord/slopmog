import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { DiscoveryJobData, GenerationJobData } from "@/queue/queues";
import { generationQueue } from "@/queue/queues";
import {
  searchReddit,
  searchYouTube,
  getYouTubeComments,
  type RedditPost,
  type YouTubeVideo,
} from "@/services/discovery/scrape-creators";
import {
  scoreOpportunityBatch,
  type ScoreInput,
  type SiteContext,
} from "@/services/discovery/scorer";
import { pMap } from "@/services/shared/parallel";
import type { KeywordConfig } from "@/services/discovery/site-analyzer";

const MIN_YOUTUBE_VIEWS = 1000;
const MAX_YOUTUBE_AGE_DAYS = 90;
const KEYWORD_SEARCH_CONCURRENCY = 4;

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeKeywords(keywords: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function parsePublishedAt(raw: string | undefined): Date | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
    // Handle UNIX timestamps from APIs that return seconds or milliseconds.
    const millis = asNumber > 1e12 ? asNumber : asNumber * 1000;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // YouTube may return relative dates like "3 days ago" or "streamed 2 weeks ago".
  const relativeMatch = value.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!relativeMatch) return null;

  const amount = Number(relativeMatch[1]);
  const unit = relativeMatch[2].toLowerCase();
  if (Number.isNaN(amount) || amount <= 0) return null;

  const date = new Date();
  if (unit === "minute") date.setMinutes(date.getMinutes() - amount);
  else if (unit === "hour") date.setHours(date.getHours() - amount);
  else if (unit === "day") date.setDate(date.getDate() - amount);
  else if (unit === "week") date.setDate(date.getDate() - amount * 7);
  else if (unit === "month") date.setMonth(date.getMonth() - amount);
  else if (unit === "year") date.setFullYear(date.getFullYear() - amount);
  else return null;

  return Number.isNaN(date.getTime()) ? null : date;
}

function getKeywordsForPlatform(
  keywordConfig: KeywordConfig | null | undefined,
  fallbackKeywords: string[],
  platform: "REDDIT" | "YOUTUBE",
  overrides?: string[],
): string[] {
  const normalizedOverrides = dedupeKeywords(overrides ?? []);
  if (normalizedOverrides.length > 0) return normalizedOverrides;

  if (!keywordConfig) return dedupeKeywords(fallbackKeywords);

  // Prioritize platform-specific terms, but include all enabled categories.
  const platformKw = platform === "REDDIT" ? keywordConfig.reddit : keywordConfig.youtube;
  const all = dedupeKeywords([
    ...platformKw,
    ...keywordConfig.features,
    ...keywordConfig.competitors,
    ...keywordConfig.brand,
  ]);
  return all.length > 0 ? all : dedupeKeywords(fallbackKeywords);
}

async function processDiscovery(job: Job<DiscoveryJobData>) {
  const { siteId } = job.data;
  if (!siteId) {
    const msg = "[discovery] Invalid job payload: missing siteId";
    console.error(msg, job.data);
    await job.log(`ERROR: ${msg}`);
    job.discard();
    throw new Error(msg);
  }

  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
  });

  await job.log(`Starting discovery for site "${site.name}" (${siteId}), platforms: ${site.platforms.join(", ")}`);

  if (!site.active) {
    console.log(`[discovery] Site ${site.name} is inactive, skipping`);
    await job.log(`Site "${site.name}" is inactive — skipping`);
    return;
  }

  const siteContext: SiteContext = {
    name: site.name,
    description: site.description,
    valueProps: site.valueProps,
    keywords: site.keywords,
  };

  const keywordConfig = site.keywordConfig as KeywordConfig | null;

  const keywordOverrides = dedupeKeywords(job.data.keywordOverrides ?? []);

  // Process each platform
  for (const platform of site.platforms) {
    const keywords = getKeywordsForPlatform(
      keywordConfig,
      site.keywords,
      platform,
      keywordOverrides,
    );

    const run = await prisma.discoveryRun.create({
      data: {
        siteId: site.id,
        platform,
        status: "RUNNING",
        keywordsUsed: keywords,
      },
    });

    try {
      await job.log(`[${platform}] Searching with ${keywords.length} keywords: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? ` (+${keywords.length - 5} more)` : ""}`);

      let allItems: DiscoveryItem[] = [];

      if (platform === "REDDIT") {
        allItems = await discoverReddit(keywords, site.id);
      } else if (platform === "YOUTUBE") {
        allItems = await discoverYouTube(keywords, site.id, site.name);
      }

      await job.log(`[${platform}] Search complete — ${allItems.length} new items found`);
      await job.updateProgress({ phase: "scoring", platform, itemCount: allItems.length });

      // Score all items
      const scored = await scoreOpportunityBatch(allItems, {
        ...siteContext,
        keywords,
      });
      const passing = scored.filter((s) => s.relevant);
      const sourceById = new Map(allItems.map((item) => [item.externalId, item]));

      await job.log(`[${platform}] Scoring complete — ${passing.length}/${scored.length} items passed relevance filter`);
      await job.updateProgress({ phase: "saving", platform, passingCount: passing.length });

      // Upsert opportunities and enqueue generation
      let generatedCount = 0;
      for (const item of passing) {
        const source = sourceById.get(item.externalId);
        if (!source) continue;
        const publishedAt = parsePublishedAt(source.publishedAtRaw);

        const opportunity = await prisma.opportunity.upsert({
          where: {
            siteId_externalId: { siteId: site.id, externalId: item.externalId },
          },
          create: {
            siteId: site.id,
            discoveryRunId: run.id,
            platform,
            externalId: item.externalId,
            contentUrl: (source as ScoreInput & { contentUrl?: string }).contentUrl ?? "",
            title: source.title,
            body: source.body,
            sourceContext: source.sourceContext,
            matchedKeyword: (source as ScoreInput & { matchedKeyword?: string }).matchedKeyword ?? "",
            relevanceScore: item.relevanceScore,
            postType: item.postType,
            scoreReason: item.scoreReason,
            ...(publishedAt ? { publishedAt } : {}),
            status: "DISCOVERED",
          },
          update: {
            relevanceScore: item.relevanceScore,
            postType: item.postType,
            scoreReason: item.scoreReason,
            ...(publishedAt ? { publishedAt } : {}),
          },
        });

        // Only enqueue generation for newly created opportunities
        if (opportunity.status === "DISCOVERED") {
          await generationQueue.add("generate", {
            opportunityId: opportunity.id,
          } satisfies GenerationJobData);
          generatedCount++;
        }
      }

      await prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          foundCount: allItems.length,
          scoredCount: scored.length,
          generatedCount,
          completedAt: new Date(),
        },
      });

      const summary = `[${platform}] Done — ${allItems.length} found, ${passing.length} passed, ${generatedCount} generation jobs enqueued`;
      console.log(`[discovery] ${platform} complete for ${site.name}: ${allItems.length} found, ${passing.length} passed, ${generatedCount} enqueued`);
      await job.log(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      console.error(`[discovery] ${platform} failed for ${site.name}:`, err);
      await job.log(`ERROR [${platform}]: ${message}`);
      throw err;
    }
  }
}

// Extended type for discovery items that carries extra fields
interface DiscoveryItem extends ScoreInput {
  contentUrl: string;
  matchedKeyword: string;
  publishedAtRaw?: string;
  author?: string;
  viewCount?: number;
  commentCount?: number;
}

async function discoverReddit(keywords: string[], siteId: string): Promise<DiscoveryItem[]> {
  const existingIds = new Set(
    (await prisma.opportunity.findMany({
      where: { siteId, platform: "REDDIT" },
      select: { externalId: true },
    })).map((o) => o.externalId),
  );

  const allPosts: DiscoveryItem[] = [];

  const MAX_PAGES = 5;

  const keywordResults = await pMap(
    keywords,
    async (keyword) => {
      const allPagesOfPosts: RedditPost[] = [];
      let after: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await searchReddit(keyword, { timeframe: "day", after });
        allPagesOfPosts.push(...result.posts);

        if (!result.after || result.posts.length === 0) break;
        after = result.after;
      }

      return { keyword, posts: allPagesOfPosts };
    },
    KEYWORD_SEARCH_CONCURRENCY,
  );

  for (const { keyword, posts } of keywordResults) {
    for (const post of posts) {
      if (existingIds.has(post.id)) continue;
      existingIds.add(post.id); // dedupe across keywords

      allPosts.push({
        externalId: post.id,
        title: post.title,
        body: post.body,
        sourceContext: post.subreddit,
        platform: "REDDIT",
        contentUrl: post.url,
        matchedKeyword: keyword,
        publishedAtRaw: post.createdAt,
        author: post.author,
        commentCount: post.numComments,
      });
    }
  }

  console.log(`[discovery] Reddit: ${allPosts.length} new posts across ${keywords.length} keywords`);
  return allPosts;
}

async function discoverYouTube(
  keywords: string[],
  siteId: string,
  brandName: string,
): Promise<DiscoveryItem[]> {
  const existingIds = new Set(
    (await prisma.opportunity.findMany({
      where: { siteId, platform: "YOUTUBE" },
      select: { externalId: true },
    })).map((o) => o.externalId),
  );

  const allVideos: DiscoveryItem[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_YOUTUBE_AGE_DAYS);

  const keywordResults = await pMap(
    keywords,
    async (keyword) => {
      const videos = await searchYouTube(keyword);
      return { keyword, videos };
    },
    KEYWORD_SEARCH_CONCURRENCY,
  );

  for (const { keyword, videos } of keywordResults) {
    for (const video of videos) {
      if (existingIds.has(video.videoId)) continue;
      if (video.viewCount < MIN_YOUTUBE_VIEWS) continue;
      const publishedAt = parsePublishedAt(video.publishedAt);
      if (publishedAt && publishedAt < cutoffDate) continue;

      existingIds.add(video.videoId);

      allVideos.push({
        externalId: video.videoId,
        title: video.title,
        body: video.description?.slice(0, 500),
        sourceContext: video.channelName,
        platform: "YOUTUBE",
        contentUrl: video.url,
        matchedKeyword: keyword,
        publishedAtRaw: video.publishedAt,
        viewCount: video.viewCount,
        commentCount: video.commentCount,
      });
    }
  }

  // Check for existing brand mentions in comments (sample first 5 videos)
  const sampled = allVideos.slice(0, 5);
  const brandLower = brandName.toLowerCase();

  await pMap(
    sampled,
    async (video) => {
      try {
        const comments = await getYouTubeComments(video.contentUrl);
        const hasMention = comments.some((c) =>
          c.text.toLowerCase().includes(brandLower),
        );
        if (hasMention) {
          // Mark to set existingBrandMention when saving
          (video as DiscoveryItem & { _hasBrandMention?: boolean })._hasBrandMention = true;
        }
      } catch {
        // Non-critical, continue
      }
    },
    2,
  );

  console.log(`[discovery] YouTube: ${allVideos.length} new videos across ${keywords.length} keywords`);
  return allVideos;
}

export const discoveryWorker = new Worker<DiscoveryJobData>(
  "discovery",
  processDiscovery,
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

discoveryWorker.on("completed", (job) => {
  console.log(`[discovery] Job ${job.id} completed for site ${job.data.siteId}`);
});

discoveryWorker.on("failed", (job, err) => {
  console.error(`[discovery] Job ${job?.id} failed:`, err.message);
});
