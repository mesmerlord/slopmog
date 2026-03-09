import { Queue, DefaultJobOptions, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";

const isProd = process.env.NODE_ENV === "production";

/**
 * Log to both BullMQ job logs and console (console only in non-prod).
 */
export async function jobLog(job: Job, tag: string, message: string) {
  await job.log(message);
  if (!isProd) {
    console.log(`[${tag}] ${message}`);
  }
}

export async function jobWarn(job: Job, tag: string, message: string) {
  await job.log(`WARN: ${message}`);
  if (!isProd) {
    console.warn(`[${tag}] ${message}`);
  }
}

export async function jobError(job: Job, tag: string, message: string) {
  await job.log(`ERROR: ${message}`);
  console.error(`[${tag}] ${message}`);
}

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

export interface HVDiscoveryJobData {
  siteId: string;
  triggeredBy: "manual" | "schedule";
  queryCount?: number;
}

export interface HVGenerationJobData {
  hvOpportunityId: string;
}

export interface HVPostingJobData {
  hvCommentId: string;
}

export const discoveryQueue = createQueue("discovery");
export const generationQueue = createQueue("generation");
export const postingQueue = createQueue("posting");

export interface HealthCheckJobData {
  scope: "all" | "site" | "opportunity";
  siteId?: string;
  opportunityId?: string;
  pipeline?: "regular" | "hv" | "both";
}

export const cronQueue = createQueue("cron");
export const hvDiscoveryQueue = createQueue("hv-discovery");
export const hvGenerationQueue = createQueue("hv-generation");
export const hvPostingQueue = createQueue("hv-posting");
export const healthCheckQueue = createQueue("health-check");
