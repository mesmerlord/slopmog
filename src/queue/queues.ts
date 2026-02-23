import { DefaultJobOptions, JobsOptions, Queue } from "bullmq";
import { redisConnection } from "@/server/utils/redis";

// ─── Default config ──────────────────────────────────────────

export const defaultQueueConfig: DefaultJobOptions = {
  attempts: 10,
  backoff: {
    type: "exponential",
    delay: 30000,
  },
  keepLogs: 100,
};

export function createQueue(name: string) {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions: defaultQueueConfig,
  });
}

// ─── Queue definitions ───────────────────────────────────────

export const campaignQueue = createQueue("campaign");
export const postGenerationQueue = createQueue("post-generation");
export const postingQueue = createQueue("posting");

// ─── Job data types ──────────────────────────────────────────

export interface CampaignJobData {
  campaignId: string;
}

export interface PostGenerationJobData {
  campaignId: string;
  postId: string;
}

export interface PostingJobData {
  postId: string;
}

// ─── Helper functions to enqueue jobs ────────────────────────

export const addToCampaignQueue = async ({
  campaignId,
  opts,
}: {
  campaignId: string;
  opts?: JobsOptions;
}) => {
  console.log("Adding to campaign queue:", campaignId);
  const job = await campaignQueue.add("campaign", { campaignId }, opts);
  console.log("Added campaign job:", job.id);
  return job;
};

export const addToPostGenerationQueue = async ({
  campaignId,
  postId,
  opts,
}: {
  campaignId: string;
  postId: string;
  opts?: JobsOptions;
}) => {
  console.log("Adding to post-generation queue:", postId);
  const job = await postGenerationQueue.add(
    "post-generation",
    { campaignId, postId },
    opts
  );
  console.log("Added post-generation job:", job.id);
  return job;
};

export const addToPostingQueue = async ({
  postId,
  opts,
}: {
  postId: string;
  opts?: JobsOptions;
}) => {
  console.log("Adding to posting queue:", postId);
  const job = await postingQueue.add("posting", { postId }, opts);
  console.log("Added posting job:", job.id);
  return job;
};
