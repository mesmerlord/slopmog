import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { postingRegistry } from "@/services/posting/provider";
import "@/services/posting/upvotemax"; // Register the provider on import
import { deductCredits, refundCredits } from "@/server/utils/credits";
import { addToTrackingQueue } from "./queues";
import type { PostingJobData } from "./queues";

const MAX_CONSECUTIVE_FAILURES = 3;

const processPosting = async (job: Job<PostingJobData>) => {
  const { opportunityId } = job.data;
  console.log(`[posting] Posting comment for opportunity ${opportunityId}`);

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { campaign: true },
  });

  if (!opportunity) {
    console.log(`[posting] Opportunity ${opportunityId} not found`);
    return;
  }

  if (opportunity.status !== "POSTING") {
    console.log(`[posting] Opportunity ${opportunityId} status is ${opportunity.status}, skipping`);
    return;
  }

  if (!opportunity.generatedComment) {
    console.log(`[posting] Opportunity ${opportunityId} has no generated comment`);
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: { error: "No generated comment" } },
    });
    return;
  }

  const campaign = opportunity.campaign;
  const userId = campaign.userId;

  // 1. Deduct 1 credit
  const creditResult = await deductCredits({
    userId,
    amount: 1,
    reason: "CAMPAIGN_USAGE",
    reasonExtra: `Posted comment for campaign "${campaign.name}" in r/${opportunity.subreddit}`,
    throwOnInsufficient: false,
  });

  if (!creditResult.success) {
    console.log(`[posting] Insufficient credits for user ${userId}`);
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: { error: "Insufficient credits" } },
    });
    return;
  }

  // 2. Get posting provider
  const provider = await postingRegistry.getFirstAvailable();
  if (!provider) {
    // Refund credit since we can't post
    await refundCredits({
      userId,
      amount: 1,
      reason: "CAMPAIGN_USAGE",
      reasonExtra: "Refund: no posting provider available",
    });
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: { error: "No posting provider available" } },
    });
    return;
  }

  // 3. Post the comment
  const postResult = await provider.postComment({
    threadUrl: opportunity.redditUrl,
    commentText: opportunity.generatedComment,
    subreddit: opportunity.subreddit,
    parentCommentId: opportunity.parentCommentId ?? undefined,
  });

  if (postResult.success) {
    // Update opportunity as posted
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: "POSTED",
        postedCommentId: postResult.commentId,
        postedCommentUrl: postResult.commentUrl,
        providerUsed: provider.name,
        postedAt: new Date(),
      },
    });

    // Increment campaign credits used
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { creditsUsed: { increment: 1 } },
    });

    // Schedule tracking check
    await addToTrackingQueue(
      { opportunityId, checkNumber: 0 },
      { delay: 2 * 60 * 60 * 1000 }, // First check in 2 hours
    );

    console.log(`[posting] Successfully posted comment for ${opportunityId}`);
  } else {
    // Refund credit on failure
    await refundCredits({
      userId,
      amount: 1,
      reason: "CAMPAIGN_USAGE",
      reasonExtra: `Refund: posting failed — ${postResult.error}`,
    });

    const newStatus = postResult.retryable ? "FAILED" : "SKIPPED";
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: newStatus, metadata: { error: postResult.error } },
    });

    // Auto-pause safety: check for consecutive failures
    if (!postResult.retryable) {
      const recentFailures = await prisma.opportunity.count({
        where: {
          campaignId: campaign.id,
          status: { in: ["FAILED", "SKIPPED"] },
          updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
      });

      if (recentFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`[posting] Auto-pausing campaign ${campaign.id} after ${recentFailures} failures`);
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: "PAUSED" },
        });
      }
    }

    console.error(`[posting] Failed to post for ${opportunityId}: ${postResult.error}`);

    if (postResult.retryable) {
      throw new Error(postResult.error); // Re-throw for BullMQ retry
    }
  }
};

const worker = new Worker("posting", processPosting, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on("completed", (job) => {
  console.log(`[posting] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[posting] Job ${job?.id} failed:`, err.message);
});
