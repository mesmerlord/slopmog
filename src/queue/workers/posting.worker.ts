import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { PostingJobData } from "@/queue/queues";
import { postingRegistry } from "@/services/posting/provider";

// Register providers (side-effect imports)
import "@/services/posting/upvotemax";
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

async function processPosting(job: Job<PostingJobData>) {
  const { commentId } = job.data;

  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    include: {
      opportunity: true,
      site: true,
    },
  });

  const { opportunity } = comment;

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

  const commentText =
    opportunity.platform === "YOUTUBE" && provider.name === "socialplug"
      ? normalizeSocialPlugYouTubeCommentText(comment.text)
      : comment.text;

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

    console.log(`[posting] Comment ${commentId} posted via ${provider.name} (order: ${result.orderId})`);
  } else if (result.retryable) {
    // Throw to let BullMQ retry with exponential backoff
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
    console.error(`[posting] Comment ${commentId} failed (non-retryable): ${result.error}`);
  }
}

export const postingWorker = new Worker<PostingJobData>(
  "posting",
  processPosting,
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

postingWorker.on("completed", (job) => {
  console.log(`[posting] Job ${job.id} completed`);
});

postingWorker.on("failed", (job, err) => {
  console.error(`[posting] Job ${job?.id} failed:`, err.message);
});
