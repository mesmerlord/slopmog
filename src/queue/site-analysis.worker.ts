import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { analyzeSite } from "@/services/analysis/site-analyzer";
import type { SiteAnalysisJobData } from "./queues";

const processSiteAnalysis = async (job: Job<SiteAnalysisJobData>) => {
  const { url, campaignId } = job.data;
  console.log(`[site-analysis] Analyzing ${url} for campaign ${campaignId}`);

  const result = await analyzeSite(url);

  // Update campaign with analysis data
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      siteAnalysisData: JSON.parse(JSON.stringify(result)),
      businessName: result.businessName,
      businessDescription: result.description,
      valueProps: result.valueProps,
      targetAudience: result.targetAudience,
      brandTone: result.brandTone,
    },
  });

  console.log(`[site-analysis] Completed analysis for campaign ${campaignId}`);
  return result;
};

const worker = new Worker("site-analysis", processSiteAnalysis, {
  connection: redisConnection,
  concurrency: 3,
});

worker.on("completed", (job) => {
  console.log(`[site-analysis] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[site-analysis] Job ${job?.id} failed:`, err.message);
});
