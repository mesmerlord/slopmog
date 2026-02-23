import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { PostGenerationJobData } from "./queues";

async function processPostGenerationJob(job: Job<PostGenerationJobData>) {
  const { campaignId, postId } = job.data;
  console.log(`[post-generation] Generating post ${postId} for campaign ${campaignId}`);

  // TODO: Implement post generation logic
  // 1. Fetch campaign context + keyword
  // 2. Generate Reddit comment via AI
  // 3. Update CampaignPost with generated content
  // 4. Optionally enqueue posting job
}

const worker = new Worker("post-generation", processPostGenerationJob, {
  connection: redisConnection,
  concurrency: 10,
});

worker.on("completed", (job) => {
  console.log(`[post-generation] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[post-generation] Job ${job?.id} failed:`, err.message);
});
