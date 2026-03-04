import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { DiscoveryJobData, GenerationJobData } from "@/queue/queues";
import { generationQueue } from "@/queue/queues";
import {
  searchReddit,
  searchYouTube,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import {
  scoreOpportunityBatch,
  triageByTitle,
  type ScoreInput,
  type SiteContext,
} from "@/services/discovery/scorer";
import { pMap } from "@/services/shared/parallel";
import type { Prisma } from "@prisma/client";
import type { KeywordConfig } from "@/services/discovery/site-analyzer";
import { parseDiscoveryConfig, type DiscoveryConfig } from "@/services/discovery/config";

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

// Extended type for discovery items that carries extra fields
interface DiscoveryItem extends ScoreInput {
  contentUrl: string;
  matchedKeyword: string;
  publishedAtRaw?: string;
  author?: string;
  viewCount?: number;
  commentCount?: number;
  metadata?: Record<string, string | number | boolean>;
  _hasBrandMention?: boolean;
}

// Shared mutable state across keyword iterations within a single run
interface RunState {
  generatedCount: number;
  savedCount: number;
  totalFound: number;
  totalScored: number;
}

// ─── Keyword Prioritization ─────────────────────────────────

function categorizeKeyword(
  keyword: string,
  keywordConfig: KeywordConfig | null | undefined,
): number {
  if (!keywordConfig) return 4; // unknown
  const lower = keyword.toLowerCase();
  if (keywordConfig.brand.some((k) => k.toLowerCase() === lower)) return 0;
  if (keywordConfig.features.some((k) => k.toLowerCase() === lower)) return 1;
  const platformKws = [...keywordConfig.reddit, ...keywordConfig.youtube];
  if (platformKws.some((k) => k.toLowerCase() === lower)) return 2;
  if (keywordConfig.competitors.some((k) => k.toLowerCase() === lower)) return 3;
  return 4;
}

function prioritizeKeywords(
  keywords: string[],
  keywordConfig: KeywordConfig | null | undefined,
): string[] {
  return [...keywords].sort(
    (a, b) => categorizeKeyword(a, keywordConfig) - categorizeKeyword(b, keywordConfig),
  );
}

// ─── Per-Keyword Search Functions ───────────────────────────

async function searchRedditKeyword(
  keyword: string,
  existingIds: Set<string>,
  cfg: DiscoveryConfig,
): Promise<DiscoveryItem[]> {
  const items: DiscoveryItem[] = [];
  let after: string | undefined;

  for (let page = 0; page < cfg.maxRedditPages; page++) {
    const result = await searchReddit(keyword, { timeframe: "day", after });

    for (const post of result.posts) {
      if (existingIds.has(post.id)) continue;

      // Pre-filter: skip low-engagement posts and small subreddits
      const hasMinEngagement = post.score >= cfg.minRedditUpvotes || post.numComments >= cfg.minRedditComments;
      if (!hasMinEngagement) continue;
      if (post.subredditSubscribers > 0 && post.subredditSubscribers < cfg.minSubredditSubscribers) continue;

      existingIds.add(post.id);

      items.push({
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
        metadata: { score: post.score, permalink: post.permalink, subredditSubscribers: post.subredditSubscribers },
      });
    }

    if (!result.after || result.posts.length === 0) break;
    after = result.after;
  }

  return items;
}

async function searchYouTubeKeyword(
  keyword: string,
  existingIds: Set<string>,
  brandName: string,
  cutoffDate: Date,
  cfg: DiscoveryConfig,
): Promise<DiscoveryItem[]> {
  const items: DiscoveryItem[] = [];
  const videos = await searchYouTube(keyword);

  for (const video of videos) {
    if (existingIds.has(video.videoId)) continue;
    if (video.viewCount < cfg.minYoutubeViews) continue;
    const publishedAt = parsePublishedAt(video.publishedAt);
    if (publishedAt && publishedAt < cutoffDate) continue;

    existingIds.add(video.videoId);

    items.push({
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
      metadata: { likeCount: video.likeCount, channelId: video.channelId, thumbnail: video.thumbnail },
    });
  }

  // Check for existing brand mentions in comments (first 2 videos per keyword)
  const brandLower = brandName.toLowerCase();
  const sampled = items.slice(0, 2);

  await pMap(
    sampled,
    async (video) => {
      try {
        const comments = await getYouTubeComments(video.contentUrl);
        const hasMention = comments.some((c) =>
          c.text.toLowerCase().includes(brandLower),
        );
        if (hasMention) video._hasBrandMention = true;
      } catch {
        // Non-critical, continue
      }
    },
    2,
  );

  return items;
}

// ─── Per-Keyword Processing (triage → score → save → generate) ──

async function processKeywordResults(
  items: DiscoveryItem[],
  siteContext: SiteContext,
  site: { id: string; name: string },
  run: { id: string },
  platform: "REDDIT" | "YOUTUBE",
  runState: RunState,
  cfg: DiscoveryConfig,
): Promise<void> {
  if (items.length === 0) return;

  runState.totalFound += items.length;

  // Triage: reorder by title relevance for better scoring priority
  const triaged = await triageByTitle(items, siteContext);

  // Score
  const scored = await scoreOpportunityBatch(triaged, siteContext);
  const passing = scored.filter((s) => s.relevant);
  const sourceById = new Map(items.map((item) => [item.externalId, item]));

  runState.totalScored += scored.length;

  // Sort passing by score descending for auto-generate priority
  const passingSorted = [...passing].sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Upsert passing items immediately — visible in queue!
  for (const item of passingSorted) {
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
        contentUrl: source.contentUrl,
        title: source.title,
        body: source.body,
        sourceContext: source.sourceContext,
        matchedKeyword: source.matchedKeyword,
        author: source.author,
        viewCount: source.viewCount,
        commentCount: source.commentCount,
        metadata: (source.metadata as Prisma.InputJsonValue) ?? undefined,
        relevanceScore: item.relevanceScore,
        postType: item.postType,
        scoreReason: item.scoreReason,
        ...(publishedAt ? { publishedAt } : {}),
        status: "PENDING_REVIEW",
      },
      update: {
        author: source.author,
        viewCount: source.viewCount,
        commentCount: source.commentCount,
        metadata: (source.metadata as Prisma.InputJsonValue) ?? undefined,
        relevanceScore: item.relevanceScore,
        postType: item.postType,
        scoreReason: item.scoreReason,
        ...(publishedAt ? { publishedAt } : {}),
      },
    });
    runState.savedCount++;

    // Auto-generate for items above the auto-generate threshold
    if (
      item.relevanceScore >= cfg.autoGenerateMinScore &&
      opportunity.status === "PENDING_REVIEW"
    ) {
      const hasComment = await prisma.comment.count({
        where: { opportunityId: opportunity.id },
      });
      if (hasComment === 0) {
        await generationQueue.add("generate", {
          opportunityId: opportunity.id,
        } satisfies GenerationJobData);
        runState.generatedCount++;
      }
    }
  }

  // Update DiscoveryRun counts progressively
  await prisma.discoveryRun.update({
    where: { id: run.id },
    data: {
      foundCount: runState.totalFound,
      scoredCount: runState.totalScored,
      generatedCount: runState.generatedCount,
    },
  });
}

// ─── Main Discovery Flow ────────────────────────────────────

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
  const cfg = parseDiscoveryConfig(site.discoveryConfig);
  const keywordOverrides = dedupeKeywords(job.data.keywordOverrides ?? []);

  // Process each platform
  for (const platform of site.platforms) {
    const rawKeywords = getKeywordsForPlatform(
      keywordConfig,
      site.keywords,
      platform,
      keywordOverrides,
    );

    // Prioritize: brand → features → platform-specific → competitors → unknown
    const keywords = keywordOverrides.length > 0
      ? rawKeywords
      : prioritizeKeywords(rawKeywords, keywordConfig);

    const run = await prisma.discoveryRun.create({
      data: {
        siteId: site.id,
        platform,
        status: "RUNNING",
        keywordsUsed: keywords,
      },
    });

    const runState: RunState = {
      generatedCount: 0,
      savedCount: 0,
      totalFound: 0,
      totalScored: 0,
    };

    try {
      await job.log(`[${platform}] Searching with ${keywords.length} keywords: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? ` (+${keywords.length - 5} more)` : ""}`);

      // Load existing IDs once at start (shared across all keywords)
      const existingIds = new Set(
        (await prisma.opportunity.findMany({
          where: { siteId: site.id, platform },
          select: { externalId: true },
        })).map((o) => o.externalId),
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cfg.maxYoutubeAgeDays);

      // Process keywords sequentially so items stream through the full pipeline ASAP
      for (const keyword of keywords) {
        try {
          let items: DiscoveryItem[] = [];

          if (platform === "REDDIT") {
            items = await searchRedditKeyword(keyword, existingIds, cfg);
          } else if (platform === "YOUTUBE") {
            items = await searchYouTubeKeyword(keyword, existingIds, site.name, cutoffDate, cfg);
          }

          if (items.length === 0) {
            await job.log(`[${platform}] "${keyword}" — 0 new items, skipping`);
            continue;
          }

          await job.log(`[${platform}] "${keyword}" — ${items.length} new items, scoring...`);
          await job.updateProgress({ phase: "scoring", platform, keyword, itemCount: items.length });

          await processKeywordResults(
            items,
            { ...siteContext, keywords },
            site,
            run,
            platform,
            runState,
            cfg,
          );

          await job.log(`[${platform}] "${keyword}" — done (running total: ${runState.savedCount} saved, ${runState.generatedCount} generating)`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[discovery] ${platform} keyword "${keyword}" failed for ${site.name}:`, err);
          await job.log(`WARN [${platform}] keyword "${keyword}" failed: ${message} — continuing`);
          // Continue to next keyword
        }
      }

      // Final pass: ensure the global top N all have comments queued.
      // The per-keyword loop already generated for ≥0.90 items, but due to keyword
      // ordering some top items may have been missed. This backfills the gaps.
      const topWithoutComments = await prisma.opportunity.findMany({
        where: {
          discoveryRunId: run.id,
          status: "PENDING_REVIEW",
          comments: { none: {} },
        },
        orderBy: { relevanceScore: "desc" },
        take: cfg.autoGenerateTopN,
        select: { id: true },
      });

      for (const opp of topWithoutComments) {
        await generationQueue.add("generate", {
          opportunityId: opp.id,
        } satisfies GenerationJobData);
        runState.generatedCount++;
      }

      if (topWithoutComments.length > 0) {
        await job.log(`[${platform}] Final pass: backfilled ${topWithoutComments.length} comments for top opportunities`);
      }

      await prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          foundCount: runState.totalFound,
          scoredCount: runState.totalScored,
          generatedCount: runState.generatedCount,
          completedAt: new Date(),
        },
      });

      const summary = `[${platform}] Done — ${runState.totalFound} found, ${runState.savedCount} saved (score ≥0.75), ${runState.generatedCount} auto-generating`;
      console.log(`[discovery] ${platform} complete for ${site.name}: ${runState.totalFound} found, ${runState.savedCount} saved, ${runState.generatedCount} auto-generating`);
      await job.log(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          foundCount: runState.totalFound,
          scoredCount: runState.totalScored,
          generatedCount: runState.generatedCount,
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
