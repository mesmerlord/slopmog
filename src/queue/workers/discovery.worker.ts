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

function getKeywordsForPlatform(
  keywordConfig: KeywordConfig | null | undefined,
  fallbackKeywords: string[],
  platform: "REDDIT" | "YOUTUBE",
): string[] {
  if (!keywordConfig) return fallbackKeywords;

  // Platform-specific keywords + brand + competitors (always search those)
  const platformKw = platform === "REDDIT" ? keywordConfig.reddit : keywordConfig.youtube;
  const all = Array.from(new Set([...platformKw, ...keywordConfig.brand, ...keywordConfig.competitors]));
  return all.length > 0 ? all : fallbackKeywords;
}

async function processDiscovery(job: Job<DiscoveryJobData>) {
  const { siteId } = job.data;

  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
  });

  if (!site.active) {
    console.log(`[discovery] Site ${site.name} is inactive, skipping`);
    return;
  }

  const siteContext: SiteContext = {
    name: site.name,
    description: site.description,
    valueProps: site.valueProps,
    keywords: site.keywords,
  };

  const keywordConfig = site.keywordConfig as KeywordConfig | null;

  // Process each platform
  for (const platform of site.platforms) {
    const keywords = getKeywordsForPlatform(keywordConfig, site.keywords, platform);

    const run = await prisma.discoveryRun.create({
      data: {
        siteId: site.id,
        platform,
        status: "RUNNING",
        keywordsUsed: keywords,
      },
    });

    try {
      let allItems: ScoreInput[] = [];

      if (platform === "REDDIT") {
        allItems = await discoverReddit(keywords, site.id);
      } else if (platform === "YOUTUBE") {
        allItems = await discoverYouTube(keywords, site.id, site.name);
      }

      await job.updateProgress({ phase: "scoring", platform, itemCount: allItems.length });

      // Score all items
      const scored = await scoreOpportunityBatch(allItems, siteContext);
      const passing = scored.filter((s) => s.relevant);

      await job.updateProgress({ phase: "saving", platform, passingCount: passing.length });

      // Upsert opportunities and enqueue generation
      let generatedCount = 0;
      for (const item of passing) {
        const source = allItems.find((i) => i.externalId === item.externalId);
        if (!source) continue;

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
            status: "DISCOVERED",
          },
          update: {
            relevanceScore: item.relevanceScore,
            postType: item.postType,
            scoreReason: item.scoreReason,
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

      console.log(`[discovery] ${platform} complete for ${site.name}: ${allItems.length} found, ${passing.length} passed, ${generatedCount} enqueued`);
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
      throw err;
    }
  }
}

// Extended type for discovery items that carries extra fields
interface DiscoveryItem extends ScoreInput {
  contentUrl: string;
  matchedKeyword: string;
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
    3,
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
    3,
  );

  for (const { keyword, videos } of keywordResults) {
    for (const video of videos) {
      if (existingIds.has(video.videoId)) continue;
      if (video.viewCount < MIN_YOUTUBE_VIEWS) continue;

      existingIds.add(video.videoId);

      allVideos.push({
        externalId: video.videoId,
        title: video.title,
        body: video.description?.slice(0, 500),
        sourceContext: video.channelName,
        platform: "YOUTUBE",
        contentUrl: video.url,
        matchedKeyword: keyword,
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
