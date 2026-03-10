import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { PostingJobData } from "@/queue/queues";
import { postingRegistry } from "@/services/posting/provider";
import { hasEnoughCredits, deductCredits } from "@/server/utils/credits";
import { CREDIT_COSTS } from "@/constants/credits";

// Register providers (side-effect imports)
import "@/services/posting/upvotemax";
import "@/services/posting/socialplug";
import "@/services/posting/socialplug-twitter";

const SOCIALPLUG_YOUTUBE_COMMENT_TARGET = 5;

function normalizeSocialPlugYouTubeCommentText(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return text;
  if (lines.length >= SOCIALPLUG_YOUTUBE_COMMENT_TARGET) {
    return lines.slice(0, SOCIALPLUG_YOUTUBE_COMMENT_TARGET).join("\n");
  }

  const padded = [...lines];
  while (padded.length < SOCIALPLUG_YOUTUBE_COMMENT_TARGET) {
    padded.push(lines[padded.length % lines.length]);
  }

  return padded.join("\n");
}

async function processPosting(job: Job<PostingJobData>) {
  const { commentId } = job.data;

  await job.log(`Processing comment ${commentId}`);

  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    include: {
      opportunity: true,
      site: true,
    },
  });

  const { opportunity } = comment;

  await job.log(
    `Platform: ${opportunity.platform} | URL: ${opportunity.contentUrl}`,
  );

  // Update statuses to POSTING
  await prisma.$transaction([
    prisma.comment.update({
      where: { id: commentId },
      data: { status: "APPROVED" }, // Keep APPROVED until actual post
    }),
    prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { status: "POSTING" },
    }),
  ]);

  const provider = postingRegistry.getForPlatform(opportunity.platform);
  if (!provider) {
    const msg = `No posting provider registered for ${opportunity.platform}`;
    console.error(`[posting] ${msg}`);
    await job.log(`ERROR: ${msg}`);
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: { status: "FAILED", errorMessage: msg },
      }),
      prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { status: "FAILED" },
      }),
    ]);
    return;
  }

  await job.log(`Provider selected: ${provider.name}`);

  // Credit pre-check — insufficient credits is not retryable
  const platformKey = opportunity.platform.toLowerCase() as "reddit" | "youtube" | "twitter";
  const creditCost = CREDIT_COSTS.daily[platformKey];
  const creditCheck = await hasEnoughCredits(comment.site.userId, creditCost);
  if (!creditCheck.hasEnough) {
    const msg = `Insufficient credits — purchase more at billing. Available: ${creditCheck.totalCredits}`;
    console.warn(`[posting] Comment ${commentId}: ${msg}`);
    await job.log(`SKIPPED: ${msg}`);
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: { status: "DRAFT", errorMessage: msg },
      }),
      prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { status: "PENDING_REVIEW" },
      }),
    ]);
    return;
  }

  const commentText =
    opportunity.platform === "YOUTUBE" && provider.name === "socialplug"
      ? normalizeSocialPlugYouTubeCommentText(comment.text)
      : comment.text;

  await job.log(`Submitting order to ${provider.name}`);

  const result = await provider.createCommentOrder({
    contentUrl: opportunity.contentUrl,
    commentText,
    sourceContext: opportunity.sourceContext,
  });

  if (result.success) {
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: {
          status: "POSTED",
          providerId: provider.name,
          orderId: result.orderId,
          postedAt: new Date(),
        },
      }),
      prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { status: "POSTED" },
      }),
    ]);

    // Update discovery run posted count
    await prisma.discoveryRun.update({
      where: { id: opportunity.discoveryRunId },
      data: { postedCount: { increment: 1 } },
    });

    // Deduct credits for the posted comment
    try {
      await deductCredits({
        userId: comment.site.userId,
        amount: creditCost,
        reason: "CAMPAIGN_USAGE",
        reasonExtra: `Comment ${commentId} on ${opportunity.platform}`,
        throwOnInsufficient: false,
      });
    } catch (creditErr) {
      console.error(`[posting] CRITICAL: Failed to deduct credit for comment ${commentId}:`, creditErr);
    }

    console.log(
      `[posting] Comment ${commentId} posted via ${provider.name} (order: ${result.orderId})`,
    );
    await job.log(`Posted successfully — order: ${result.orderId}`);
  } else if (result.retryable) {
    // Throw to let BullMQ retry with exponential backoff
    await job.log(`Retryable failure: ${result.error}`);
    throw new Error(`Posting failed (retryable): ${result.error}`);
  } else {
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: {
          status: "FAILED",
          providerId: provider.name,
          errorMessage: result.error,
        },
      }),
      prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { status: "FAILED" },
      }),
    ]);
    console.error(
      `[posting] Comment ${commentId} failed (non-retryable): ${result.error}`,
    );
    await job.log(`Non-retryable failure: ${result.error}`);
  }
}

export const postingWorker = new Worker<PostingJobData>(
  "posting",
  processPosting,
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

postingWorker.on("completed", (job) => {
  console.log(`[posting] Job ${job.id} completed`);
});

postingWorker.on("failed", async (job, err) => {
  console.error(`[posting] Job ${job?.id} failed:`, err.message);

  // When all retries are exhausted, reset the comment back to the queue
  // so users can re-approve it later
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const { commentId } = job.data as PostingJobData;
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { opportunityId: true },
      });
      if (comment) {
        await prisma.$transaction([
          prisma.comment.update({
            where: { id: commentId },
            data: {
              status: "DRAFT",
              errorMessage: `Posting failed after ${job.attemptsMade} attempts: ${err.message}`,
            },
          }),
          prisma.opportunity.update({
            where: { id: comment.opportunityId },
            data: { status: "PENDING_REVIEW" },
          }),
        ]);
        console.log(
          `[posting] Comment ${commentId} returned to queue after ${job.attemptsMade} exhausted retries`,
        );
      }
    } catch (dbErr) {
      console.error(
        `[posting] Failed to return comment ${commentId} to queue:`,
        dbErr,
      );
    }
  }
});
