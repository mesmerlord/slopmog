import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { scoutSubreddits } from "@/services/reddit/scout";
import { mineOpportunities } from "@/services/reddit/miner";
import { addToScoringQueue } from "./queues";
import type { DiscoveryJobData } from "./queues";
import type { DiscoveredThread } from "@/services/reddit/types";

const processDiscovery = async (job: Job<DiscoveryJobData>) => {
  const { campaignId, mode } = job.data;
  console.log(`[discovery] Running ${mode} for campaign ${campaignId}`);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { keywords: true, subreddits: true },
  });

  if (!campaign || campaign.status !== "ACTIVE") {
    console.log(`[discovery] Campaign ${campaignId} not active, skipping`);
    return;
  }

  const keywords = campaign.keywords.map((k) => k.keyword);
  const subreddits = campaign.subreddits.map((s) => s.subreddit);

  if (keywords.length === 0 || subreddits.length === 0) {
    console.log(`[discovery] Campaign ${campaignId} has no keywords or subreddits`);
    return;
  }

  let threads: DiscoveredThread[];

  if (mode === "scout") {
    threads = await scoutSubreddits({ campaignId, subreddits, keywords });
  } else {
    // Parse keyword categories from siteAnalysisData
    const analysis = campaign.siteAnalysisData as Record<string, unknown> | null;
    threads = await mineOpportunities({
      campaignId,
      subreddits,
      keywords,
      problemKeywords: (analysis?.problemKeywords as string[]) ?? [],
      longTailKeywords: (analysis?.longTailKeywords as string[]) ?? [],
      competitorKeywords: (analysis?.competitorKeywords as string[]) ?? [],
    });
  }

  console.log(`[discovery] Found ${threads.length} threads for campaign ${campaignId}`);

  // Create Opportunity records
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
          matchedKeyword: thread.matchedKeyword,
          discoverySource: mode === "scout" ? "SCOUT" : "MINER",
          relevanceScore: thread.relevanceScore,
          status: "DISCOVERED",
          // If the thread has a suggested reply target, store it
          parentCommentId: thread.suggestedReplyTarget?.commentId ?? null,
          parentCommentBody: thread.suggestedReplyTarget?.commentBody ?? null,
          parentCommentAuthor: thread.suggestedReplyTarget?.commentAuthor ?? null,
        },
      });

      // Enqueue scoring
      await addToScoringQueue({ opportunityId: opportunity.id });
    } catch (error) {
      // Unique constraint violation = already discovered, skip
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        continue;
      }
      console.error(`[discovery] Failed to create opportunity:`, error);
    }
  }

  return { threadsFound: threads.length };
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
