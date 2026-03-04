import { Queue, DefaultJobOptions } from "bullmq";
import { redisConnection } from "@/server/utils/redis";

export interface DiscoveryJobData {
  siteId: string;
  triggeredBy: "manual" | "schedule";
  keywordOverrides?: string[];
}

export interface GenerationJobData {
  opportunityId: string;
}

export interface PostingJobData {
  commentId: string;
}

export const defaultQueueConfig: DefaultJobOptions = {
  attempts: 3,
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

export const discoveryQueue = createQueue("discovery");
export const generationQueue = createQueue("generation");
export const postingQueue = createQueue("posting");
