import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { CampaignJobData } from "./queues";

async function processCampaignJob(job: Job<CampaignJobData>) {
  const { campaignId } = job.data;
  console.log(`[campaign] Processing campaign ${campaignId}`);

  // TODO: Implement campaign processing logic
  // 1. Fetch campaign + keywords from DB
  // 2. Find relevant Reddit threads
  // 3. Generate posts via AI
  // 4. Create CampaignPost records and enqueue post-generation jobs
}

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
