import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { PostingJobData } from "@/queue/queues";
import { postingRegistry } from "@/services/posting/provider";

// Register providers (side-effect imports)
import "@/services/posting/upvotemax";
import "@/services/posting/socialplug";

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

  const result = await provider.createCommentOrder({
    contentUrl: opportunity.contentUrl,
    commentText: comment.text,
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
