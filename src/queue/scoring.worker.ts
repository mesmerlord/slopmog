import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { addToPostGenerationQueue } from "./queues";
import { scoreWithLLM } from "@/services/scoring/llm-scorer";
import type { ScoringJobData } from "./queues";

const SCORE_THRESHOLD = 0.4;

const processScoring = async (job: Job<ScoringJobData>) => {
  const { opportunityId } = job.data;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { campaign: true },
  });

  if (!opportunity || opportunity.status !== "DISCOVERED") {
    return;
  }

  // Score with LLM
  const { relevance, reasoning, postType } = await scoreWithLLM({
    postTitle: opportunity.title,
    postBody: opportunity.postBody,
    subreddit: opportunity.subreddit,
    matchedKeyword: opportunity.matchedKeyword,
    businessName: opportunity.campaign.businessName ?? "Unknown",
    businessDescription: opportunity.campaign.businessDescription ?? "",
    valueProps: (opportunity.campaign.valueProps as string[]) ?? [],
  });

  console.log(`[scoring] Opportunity ${opportunityId} scored ${relevance.toFixed(2)} — ${reasoning.slice(0, 80)}`);

  if (relevance < SCORE_THRESHOLD) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        relevanceScore: relevance,
        relevanceReasoning: reasoning,
        postType,
        scoredAt: new Date(),
        status: "SKIPPED",
      },
    });
    return;
  }

  const automationMode = opportunity.campaign.automationMode;

  if (automationMode === "AUTOPILOT") {
    // Fully automated: approve + generate + auto-post
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        relevanceScore: relevance,
        relevanceReasoning: reasoning,
        postType,
        scoredAt: new Date(),
        status: "APPROVED",
      },
    });
    await addToPostGenerationQueue({ opportunityId });
    console.log(`[scoring] Opportunity ${opportunityId} auto-approved (autopilot)`);
  } else {
    // FULL_MANUAL and SEMI_AUTO: user must approve the opportunity first
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        relevanceScore: relevance,
        relevanceReasoning: reasoning,
        postType,
        scoredAt: new Date(),
        status: "PENDING_REVIEW",
      },
    });
    console.log(`[scoring] Opportunity ${opportunityId} pending review (${automationMode}, relevance ${relevance.toFixed(2)})`);
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
