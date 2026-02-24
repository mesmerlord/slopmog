import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { addToSiteAnalysisQueue, addToDiscoveryQueue } from "./queues";
import type { CampaignJobData } from "./queues";

const processCampaignJob = async (job: Job<CampaignJobData>) => {
  const { campaignId } = job.data;
  console.log(`[campaign] Processing campaign ${campaignId}`);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { keywords: true, subreddits: true },
  });

  if (!campaign) {
    console.log(`[campaign] Campaign ${campaignId} not found`);
    return;
  }

  // Queue site analysis if no analysis data
  if (!campaign.siteAnalysisData && campaign.websiteUrl) {
    await addToSiteAnalysisQueue({
      url: campaign.websiteUrl,
      campaignId,
      userId: campaign.userId,
    });
  }

  // Queue one-time miner sweep
  await addToDiscoveryQueue({ campaignId, mode: "miner" });

  // Queue repeatable scout (every 30 minutes)
  await addToDiscoveryQueue(
    { campaignId, mode: "scout" },
    {
      repeat: {
        every: 30 * 60 * 1000, // 30 minutes
      },
      jobId: `scout-${campaignId}`,
    },
  );

  console.log(`[campaign] Started discovery pipeline for campaign ${campaignId}`);
};

const worker = new Worker("campaign", processCampaignJob, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`[campaign] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[campaign] Job ${job?.id} failed:`, err.message);
});
