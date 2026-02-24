import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { postingRegistry } from "@/services/posting/provider";
import "@/services/posting/upvotemax"; // Register the provider on import
import { deductCredits, refundCredits } from "@/server/utils/credits";
import { addToPostingQueue, addToTrackingQueue } from "./queues";
import type { PostingJobData } from "./queues";

const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_POLL_ATTEMPTS = 20;

// Exponential backoff for polling: 30s, 60s, 120s, ... capped at 5 min
function getPollDelay(attempt: number): number {
  return Math.min(30000 * Math.pow(2, attempt), 5 * 60 * 1000);
}

// ─── Phase 1: Create the UpvoteMax order ────────────────────

async function handleCreate(job: Job<PostingJobData>) {
  const { opportunityId } = job.data;
  console.log(`[posting] Creating order for opportunity ${opportunityId}`);

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

  // 3. Create the order
  const orderResult = await provider.createCommentOrder({
    threadUrl: opportunity.redditUrl,
    commentText: opportunity.generatedComment,
    subreddit: opportunity.subreddit,
    parentCommentId: opportunity.parentCommentId ?? undefined,
  });

  if (!orderResult.success || !orderResult.orderId) {
    // Refund credit since the order wasn't created
    await refundCredits({
      userId,
      amount: 1,
      reason: "CAMPAIGN_USAGE",
      reasonExtra: `Refund: order creation failed — ${orderResult.error}`,
    });

    if (orderResult.retryable) {
      // Let BullMQ retry the whole job
      throw new Error(orderResult.error || "Order creation failed");
    }

    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: { error: orderResult.error } },
    });
    await checkConsecutiveFailures(campaign.id);
    return;
  }

  // 4. Save the order ID and enqueue the poll phase
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      externalOrderId: orderResult.orderId,
      providerUsed: provider.name,
    },
  });

  console.log(`[posting] Order ${orderResult.orderId} created for opportunity ${opportunityId}, starting poll`);

  await addToPostingQueue(
    { opportunityId, phase: "poll", pollAttempt: 0 },
    { delay: getPollDelay(0) },
  );
}

// ─── Phase 2: Poll the order status ────────────────────────

async function handlePoll(job: Job<PostingJobData>) {
  const { opportunityId, pollAttempt = 0 } = job.data;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { campaign: true },
  });

  if (!opportunity) {
    console.log(`[posting:poll] Opportunity ${opportunityId} not found`);
    return;
  }

  if (opportunity.status !== "POSTING") {
    console.log(`[posting:poll] Opportunity ${opportunityId} status is ${opportunity.status}, skipping poll`);
    return;
  }

  if (!opportunity.externalOrderId) {
    console.log(`[posting:poll] Opportunity ${opportunityId} has no externalOrderId`);
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: { error: "Missing order ID for polling" } },
    });
    return;
  }

  const provider = await postingRegistry.getFirstAvailable();
  if (!provider) {
    console.log(`[posting:poll] No provider available for polling`);
    // Re-enqueue — provider might come back
    if (pollAttempt < MAX_POLL_ATTEMPTS) {
      await addToPostingQueue(
        { opportunityId, phase: "poll", pollAttempt: pollAttempt + 1 },
        { delay: getPollDelay(pollAttempt + 1) },
      );
    }
    return;
  }

  const statusResult = await provider.checkOrderStatus(opportunity.externalOrderId);

  console.log(
    `[posting:poll] Order ${opportunity.externalOrderId} status: ${statusResult.status} (attempt ${pollAttempt})`,
  );

  const campaign = opportunity.campaign;
  const userId = campaign.userId;

  if (statusResult.status === "completed") {
    // Success — mark as posted
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
      },
    });

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { creditsUsed: { increment: 1 } },
    });

    // Schedule tracking check
    await addToTrackingQueue(
      { opportunityId, checkNumber: 0 },
      { delay: 2 * 60 * 60 * 1000 }, // First check in 2 hours
    );

    console.log(`[posting:poll] Successfully posted for ${opportunityId}`);
    return;
  }

  if (statusResult.status === "failed") {
    // Refund credit
    await refundCredits({
      userId,
      amount: 1,
      reason: "CAMPAIGN_USAGE",
      reasonExtra: `Refund: UpvoteMax order failed — ${statusResult.error ?? "unknown"}`,
    });

    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: "FAILED",
        metadata: { error: statusResult.error ?? "UpvoteMax order failed" },
      },
    });

    await checkConsecutiveFailures(campaign.id);
    console.error(`[posting:poll] Order failed for ${opportunityId}: ${statusResult.error}`);
    return;
  }

  // Still pending/running/unknown — re-enqueue if under limit
  if (pollAttempt < MAX_POLL_ATTEMPTS) {
    await addToPostingQueue(
      { opportunityId, phase: "poll", pollAttempt: pollAttempt + 1 },
      { delay: getPollDelay(pollAttempt + 1) },
    );
    return;
  }

  // Exceeded max polls — give up
  await refundCredits({
    userId,
    amount: 1,
    reason: "CAMPAIGN_USAGE",
    reasonExtra: "Refund: order timed out waiting for completion",
  });

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      status: "FAILED",
      metadata: { error: `Order timed out after ${MAX_POLL_ATTEMPTS} poll attempts` },
    },
  });

  console.error(`[posting:poll] Order timed out for ${opportunityId}`);
}

// ─── Shared: auto-pause after consecutive failures ──────────

async function checkConsecutiveFailures(campaignId: string) {
  const recentFailures = await prisma.opportunity.count({
    where: {
      campaignId,
      status: { in: ["FAILED", "SKIPPED"] },
      updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    },
  });

  if (recentFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.log(`[posting] Auto-pausing campaign ${campaignId} after ${recentFailures} failures`);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "PAUSED" },
    });
  }
}

// ─── Worker entry point ─────────────────────────────────────

const processPosting = async (job: Job<PostingJobData>) => {
  const phase = job.data.phase ?? "create";
  if (phase === "poll") {
    await handlePoll(job);
  } else {
    await handleCreate(job);
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
