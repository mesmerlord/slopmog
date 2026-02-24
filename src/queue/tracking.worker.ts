import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { checkCommentPerformance, type TrackingSnapshot } from "@/services/tracking/tracker";
import "@/services/posting/upvotemax"; // Ensure provider is registered
import { addToTrackingQueue } from "./queues";
import type { TrackingJobData } from "./queues";

const processTracking = async (job: Job<TrackingJobData>) => {
  const { opportunityId, checkNumber } = job.data;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });

  if (!opportunity || opportunity.status !== "POSTED" || !opportunity.postedCommentId) {
    return;
  }

  const { status, snapshot, nextCheckDelay } = await checkCommentPerformance(
    opportunity.postedCommentId,
    opportunity.providerUsed || "upvotemax",
    checkNumber,
  );

  // Append snapshot to metadata
  const existingMetadata = (opportunity.metadata as Record<string, unknown>) ?? {};
  const snapshots = (existingMetadata.trackingSnapshots as TrackingSnapshot[]) ?? [];
  snapshots.push(snapshot);

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      metadata: JSON.parse(JSON.stringify({ ...existingMetadata, trackingSnapshots: snapshots })),
    },
  });

  // Check for removal within first hour
  if (status.removed && checkNumber <= 1) {
    console.log(`[tracking] Comment removed quickly for ${opportunityId} — flagging campaign`);
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: JSON.parse(JSON.stringify({ ...existingMetadata, trackingSnapshots: snapshots, removedEarly: true })) },
    });
    return;
  }

  // Schedule next check if applicable
  if (nextCheckDelay && !status.removed) {
    await addToTrackingQueue(
      { opportunityId, checkNumber: checkNumber + 1 },
      { delay: nextCheckDelay },
    );
    console.log(`[tracking] Next check (#${checkNumber + 1}) for ${opportunityId} in ${Math.round(nextCheckDelay / 3600000)}h`);
  } else {
    console.log(`[tracking] Tracking complete for ${opportunityId} (${snapshots.length} snapshots)`);
  }
};

const worker = new Worker("tracking", processTracking, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`[tracking] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[tracking] Job ${job?.id} failed:`, err.message);
});
