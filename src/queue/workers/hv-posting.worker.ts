import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { type HVPostingJobData, jobLog, jobWarn, jobError } from "@/queue/queues";
import { postingRegistry } from "@/services/posting/provider";
import { hasEnoughCredits, deductCredits } from "@/server/utils/credits";
import { CREDIT_COSTS } from "@/constants/credits";

// Register providers (side-effect imports)
import "@/services/posting/manual";
import "@/services/posting/socialplug";

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

async function processHVPosting(job: Job<HVPostingJobData>) {
  const { hvCommentId } = job.data;

  await jobLog(job, "hv-posting", `Processing HV comment ${hvCommentId}`);

  const comment = await prisma.hVComment.findUniqueOrThrow({
    where: { id: hvCommentId },
    include: {
      hvOpportunity: true,
      site: true,
    },
  });

  const { hvOpportunity: opportunity } = comment;

  await jobLog(
    job, "hv-posting",
    `Platform: ${opportunity.platform} | URL: ${opportunity.contentUrl}`,
  );

  // Update statuses to POSTING
  await prisma.$transaction([
    prisma.hVComment.update({
      where: { id: hvCommentId },
      data: { status: "APPROVED" },
    }),
    prisma.hVOpportunity.update({
      where: { id: opportunity.id },
      data: { status: "POSTING" },
    }),
  ]);

  // Reddit HV uses the manual provider (we post ourselves, verify via health checks)
  // YouTube HV still uses socialplug
  const provider = opportunity.platform === "REDDIT"
    ? postingRegistry.getByName("manual")
    : postingRegistry.getForPlatform(opportunity.platform);

  if (!provider) {
    const msg = `No posting provider registered for ${opportunity.platform}`;
    await jobError(job, "hv-posting", msg);
    await prisma.$transaction([
      prisma.hVComment.update({
        where: { id: hvCommentId },
        data: { status: "FAILED", errorMessage: msg },
      }),
      prisma.hVOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "FAILED" },
      }),
    ]);
    return;
  }

  await jobLog(job, "hv-posting", `Provider selected: ${provider.name}`);

  // Credit pre-check with HV costs
  const platformKey = opportunity.platform.toLowerCase() as "reddit" | "youtube";
  const creditCost = CREDIT_COSTS.highValue[platformKey];
  const creditCheck = await hasEnoughCredits(comment.site.userId, creditCost);
  if (!creditCheck.hasEnough) {
    const msg = `Insufficient credits for HV posting (need ${creditCost}). Available: ${creditCheck.totalCredits}`;
    await jobWarn(job, "hv-posting", `Comment ${hvCommentId}: ${msg}`);
    await prisma.$transaction([
      prisma.hVComment.update({
        where: { id: hvCommentId },
        data: { status: "DRAFT", errorMessage: msg },
      }),
      prisma.hVOpportunity.update({
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

  await jobLog(job, "hv-posting", `Submitting order to ${provider.name}`);

  const result = await provider.createCommentOrder({
    contentUrl: opportunity.contentUrl,
    commentText,
    sourceContext: opportunity.sourceContext,
  });

  if (result.success) {
    await prisma.$transaction([
      prisma.hVComment.update({
        where: { id: hvCommentId },
        data: {
          status: "POSTED",
          providerId: provider.name,
          orderId: result.orderId,
          postedAt: new Date(),
        },
      }),
      prisma.hVOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "POSTED" },
      }),
    ]);

    // Deduct HV credits
    try {
      await deductCredits({
        userId: comment.site.userId,
        amount: creditCost,
        reason: "CAMPAIGN_USAGE",
        reasonExtra: `HV Comment ${hvCommentId} on ${opportunity.platform} (${creditCost} credits)`,
        throwOnInsufficient: false,
      });
    } catch (creditErr) {
      await jobError(job, "hv-posting", `CRITICAL: Failed to deduct credit for HV comment ${hvCommentId}: ${creditErr}`);
    }

    await jobLog(job, "hv-posting", `HV Comment ${hvCommentId} posted via ${provider.name} (order: ${result.orderId})`);
  } else if (result.retryable) {
    await jobWarn(job, "hv-posting", `Retryable failure: ${result.error}`);
    throw new Error(`HV Posting failed (retryable): ${result.error}`);
  } else {
    await prisma.$transaction([
      prisma.hVComment.update({
        where: { id: hvCommentId },
        data: {
          status: "FAILED",
          providerId: provider.name,
          errorMessage: result.error,
        },
      }),
      prisma.hVOpportunity.update({
        where: { id: opportunity.id },
        data: { status: "FAILED" },
      }),
    ]);
    await jobError(job, "hv-posting", `HV Comment ${hvCommentId} failed (non-retryable): ${result.error}`);
  }
}

export const hvPostingWorker = new Worker<HVPostingJobData>(
  "hv-posting",
  processHVPosting,
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

hvPostingWorker.on("completed", (job) => {
  console.log(`[hv-posting] Job ${job.id} completed`);
});

hvPostingWorker.on("failed", async (job, err) => {
  console.error(`[hv-posting] Job ${job?.id} failed:`, err.message);

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const { hvCommentId } = job.data as HVPostingJobData;
    try {
      const comment = await prisma.hVComment.findUnique({
        where: { id: hvCommentId },
        select: { hvOpportunityId: true },
      });
      if (comment) {
        await prisma.$transaction([
          prisma.hVComment.update({
            where: { id: hvCommentId },
            data: {
              status: "DRAFT",
              errorMessage: `Posting failed after ${job.attemptsMade} attempts: ${err.message}`,
            },
          }),
          prisma.hVOpportunity.update({
            where: { id: comment.hvOpportunityId },
            data: { status: "PENDING_REVIEW" },
          }),
        ]);
        console.log(
          `[hv-posting] HV Comment ${hvCommentId} returned to queue after ${job.attemptsMade} exhausted retries`,
        );
      }
    } catch (dbErr) {
      console.error(
        `[hv-posting] Failed to return HV comment ${hvCommentId} to queue:`,
        dbErr,
      );
    }
  }
});
