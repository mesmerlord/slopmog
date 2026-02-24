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
export const siteAnalysisQueue = createQueue("site-analysis");
export const discoveryQueue = createQueue("discovery");
export const scoringQueue = createQueue("scoring");
export const postGenerationQueue = createQueue("post-generation");
export const postingQueue = createQueue("posting");
export const trackingQueue = createQueue("tracking");

// ─── Job data types ──────────────────────────────────────────

export interface CampaignJobData {
  campaignId: string;
}

export interface SiteAnalysisJobData {
  url: string;
  campaignId: string;
  userId: string;
}

export interface DiscoveryJobData {
  campaignId: string;
  mode: "scout" | "miner";
}

export interface ScoringJobData {
  opportunityId: string;
}

export interface PostGenerationJobData {
  opportunityId: string;
}

export interface PostingJobData {
  opportunityId: string;
}

export interface TrackingJobData {
  opportunityId: string;
  checkNumber: number;
}

// ─── Helper functions to enqueue jobs ────────────────────────

export const addToSiteAnalysisQueue = async (data: SiteAnalysisJobData, opts?: JobsOptions) => {
  console.log("[queue] Adding site analysis job:", data.url);
  return siteAnalysisQueue.add("site-analysis", data, opts);
};

export const addToDiscoveryQueue = async (data: DiscoveryJobData, opts?: JobsOptions) => {
  console.log("[queue] Adding discovery job:", data.campaignId, data.mode);
  return discoveryQueue.add(`discovery-${data.mode}`, data, opts);
};

export const addToScoringQueue = async (data: ScoringJobData, opts?: JobsOptions) => {
  return scoringQueue.add("scoring", data, opts);
};

export const addToPostGenerationQueue = async (data: PostGenerationJobData, opts?: JobsOptions) => {
  console.log("[queue] Adding post generation job:", data.opportunityId);
  return postGenerationQueue.add("post-generation", data, opts);
};

export const addToPostingQueue = async (data: PostingJobData, opts?: JobsOptions) => {
  console.log("[queue] Adding posting job:", data.opportunityId);
  return postingQueue.add("posting", data, opts);
};

export const addToTrackingQueue = async (data: TrackingJobData, opts?: JobsOptions) => {
  return trackingQueue.add("tracking", data, opts);
};

// ─── Legacy helpers (keeping for backwards compat) ───────────

export const addToCampaignQueue = async ({
  campaignId,
  opts,
}: {
  campaignId: string;
  opts?: JobsOptions;
}) => {
  console.log("Adding to campaign queue:", campaignId);
  return campaignQueue.add("campaign", { campaignId }, opts);
};
