import { Worker, Job } from "bullmq";
import { redisConnection, redis } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { scoutSubreddits } from "@/services/reddit/scout";
import { mineOpportunities } from "@/services/reddit/miner";
import { addToScoringQueue } from "./queues";
import { getUserPlan } from "@/server/utils/plan";
import type { DiscoveryJobData } from "./queues";
import type { DiscoveredThread } from "@/services/reddit/types";

// ─── Progress helpers ────────────────────────────────────────

const PROGRESS_TTL = 300; // 5 minutes

interface DiscoveryProgress {
  stage: "starting" | "scanning" | "scoring" | "complete" | "error";
  message: string;
  currentSubreddit?: string;
  threadsFound: number;
  threadsScored: number;
  opportunitiesCreated: number;
  startedAt: string;
  updatedAt: string;
}

const progressKey = (campaignId: string) => `discovery:progress:${campaignId}`;

const writeProgress = async (campaignId: string, progress: Partial<DiscoveryProgress> & { stage: string }) => {
  const key = progressKey(campaignId);
  const existing = await redis.get(key);
  const prev: DiscoveryProgress = existing
    ? JSON.parse(existing)
    : { stage: "starting", message: "", threadsFound: 0, threadsScored: 0, opportunitiesCreated: 0, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  const updated = { ...prev, ...progress, updatedAt: new Date().toISOString() };
  await redis.setex(key, PROGRESS_TTL, JSON.stringify(updated));
};

// ─── Fun messages ────────────────────────────────────────────

const SCANNING_MESSAGES = [
  "Warming up the search engines...",
  "Scanning the depths of Reddit...",
  "Looking for where your people hang out...",
  "Digging through threads...",
  "Hunting for golden opportunities...",
];

const SCORING_MESSAGES = [
  "Ranking what we found...",
  "Separating the wheat from the chaff...",
  "Figuring out which threads are actually worth it...",
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// ─── Main processor ──────────────────────────────────────────

const processDiscovery = async (job: Job<DiscoveryJobData>) => {
  const { campaignId, mode } = job.data;
  const log = async (msg: string) => {
    console.log(`[discovery:${mode}] ${msg}`);
    await job.log(msg);
  };

  await writeProgress(campaignId, {
    stage: "starting",
    message: "Warming up...",
    startedAt: new Date().toISOString(),
  });

  await log(`Starting ${mode} discovery for campaign ${campaignId}`);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { keywords: true, subreddits: true },
  });

  if (!campaign || campaign.status !== "ACTIVE") {
    await log(`Campaign ${campaignId} not active (status: ${campaign?.status ?? "not found"}), skipping`);
    await writeProgress(campaignId, { stage: "complete", message: "Campaign not active" });
    return;
  }

  // Group keywords by strategy, respecting per-keyword enabled flag + strategy toggles
  const featureKws = campaign.keywords
    .filter((k) => k.enabled && k.strategy === "FEATURE" && campaign.featureStrategyEnabled)
    .map((k) => k.keyword);
  const brandKws = campaign.keywords
    .filter((k) => k.enabled && k.strategy === "BRAND" && campaign.brandStrategyEnabled)
    .map((k) => k.keyword);
  const competitorKws = campaign.keywords
    .filter((k) => k.enabled && k.strategy === "COMPETITOR" && campaign.competitorStrategyEnabled)
    .map((k) => k.keyword);

  const subreddits = campaign.subreddits.map((s) => s.subreddit);

  await log(`Campaign "${campaign.name}": ${featureKws.length} feature, ${brandKws.length} brand, ${competitorKws.length} competitor keywords, ${subreddits.length} subreddits`);

  const totalKws = featureKws.length + brandKws.length + competitorKws.length;
  if (totalKws === 0 || subreddits.length === 0) {
    await log("No keywords or subreddits configured, skipping");
    await writeProgress(campaignId, { stage: "complete", message: "No keywords or subreddits configured" });
    return;
  }

  await writeProgress(campaignId, {
    stage: "scanning",
    message: pickRandom(SCANNING_MESSAGES),
  });

  let threads: DiscoveredThread[];

  if (mode === "scout") {
    // Scout uses all enabled keywords combined
    const allKeywords = [...featureKws, ...brandKws, ...competitorKws];
    threads = await scoutSubreddits({ campaignId, subreddits, keywords: allKeywords, log });
  } else {
    threads = await mineOpportunities({
      campaignId,
      subreddits,
      featureKeywords: featureKws,
      brandKeywords: brandKws,
      competitorKeywords: competitorKws,
      log,
    });
  }

  await writeProgress(campaignId, {
    stage: "scoring",
    message: pickRandom(SCORING_MESSAGES),
    threadsFound: threads.length,
  });

  await log(`Discovery complete: ${threads.length} threads found`);

  // Create Opportunity records
  let created = 0;
  let duplicates = 0;
  let errors = 0;

  for (const thread of threads) {
    try {
      const opportunity = await prisma.opportunity.create({
        data: {
          campaignId,
          redditPostId: thread.post.id,
          redditUrl: thread.post.url,
          title: thread.post.title,
          subreddit: thread.post.subreddit,
          postBody: thread.post.selftext?.slice(0, 5000) || null,
          score: thread.post.score,
          numComments: thread.post.numComments,
          redditCreatedAt: thread.post.createdUtc ? new Date(thread.post.createdUtc * 1000) : null,
          matchedKeyword: thread.matchedKeyword,
          discoverySource: mode === "scout" ? "SCOUT" : "MINER",
          relevanceScore: thread.relevanceScore,
          status: "DISCOVERED",
          parentCommentId: thread.suggestedReplyTarget?.commentId ?? null,
          parentCommentBody: thread.suggestedReplyTarget?.commentBody ?? null,
          parentCommentAuthor: thread.suggestedReplyTarget?.commentAuthor ?? null,
        },
      });

      await addToScoringQueue({ opportunityId: opportunity.id });
      created++;

      // Update progress with each new opportunity
      await writeProgress(campaignId, {
        stage: "scoring",
        message: `Found ${created} opportunities, scoring...`,
        opportunitiesCreated: created,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        duplicates++;
        continue;
      }
      errors++;
      console.error(`[discovery] Failed to create opportunity:`, error);
    }
  }

  await log(`Opportunities: ${created} created, ${duplicates} duplicates skipped, ${errors} errors`);

  await writeProgress(campaignId, {
    stage: "complete",
    message: created > 0
      ? `Done! ${created} opportunities found`
      : "Done! No new opportunities this time",
    opportunitiesCreated: created,
    threadsFound: threads.length,
  });

  return { threadsFound: threads.length, created, duplicates, errors };
};

const worker = new Worker("discovery", processDiscovery, {
  connection: redisConnection,
  concurrency: 3,
});

worker.on("completed", (job) => {
  console.log(`[discovery] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[discovery] Job ${job?.id} failed:`, err.message);
});
