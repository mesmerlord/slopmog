import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { addToPostGenerationQueue } from "./queues";
import type { ScoringJobData } from "./queues";

const SCORE_THRESHOLD = 0.35;

const processScoring = async (job: Job<ScoringJobData>) => {
  const { opportunityId } = job.data;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { campaign: true },
  });

  if (!opportunity || opportunity.status !== "DISCOVERED") {
    return;
  }

  // Relevance score was already computed during discovery
  const score = opportunity.relevanceScore;

  if (score < SCORE_THRESHOLD) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "SKIPPED" },
    });
    console.log(`[scoring] Opportunity ${opportunityId} scored ${score.toFixed(2)} — below threshold, skipped`);
    return;
  }

  const automationMode = opportunity.campaign.automationMode;

  if (automationMode === "AUTOPILOT") {
    // Auto-approve and enqueue generation
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "APPROVED" },
    });
    await addToPostGenerationQueue({ opportunityId });
    console.log(`[scoring] Opportunity ${opportunityId} auto-approved (autopilot)`);
  } else {
    // SEMI_AUTO or FULL_MANUAL: wait for user approval
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "PENDING_REVIEW" },
    });
    console.log(`[scoring] Opportunity ${opportunityId} pending review (score: ${score.toFixed(2)})`);
  }
};

const worker = new Worker("scoring", processScoring, {
  connection: redisConnection,
  concurrency: 10,
});

worker.on("completed", (job) => {
  console.log(`[scoring] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[scoring] Job ${job?.id} failed:`, err.message);
});
