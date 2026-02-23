import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { PostingJobData } from "./queues";

async function processPostingJob(job: Job<PostingJobData>) {
  const { postId } = job.data;
  console.log(`[posting] Posting ${postId} to Reddit`);

  // TODO: Implement posting logic
  // 1. Fetch CampaignPost from DB
  // 2. Post comment to Reddit thread
  // 3. Update CampaignPost with postUrl and status
}

const worker = new Worker("posting", processPostingJob, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on("completed", (job) => {
  console.log(`[posting] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[posting] Job ${job?.id} failed:`, err.message);
});
