import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/utils/db";
import {
  healthCheckQueue,
  jobLog,
  jobError,
  type HealthCheckJobData,
} from "@/queue/queues";
import { checkUrlBatch } from "@/services/health-check/checker";
import type { UrlCheckBatch, HealthCheckMetadata } from "@/services/health-check/types";

const TAG = "health-check";
const DELAY_BETWEEN_URLS_MS = 2500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Load all POSTED opportunities with POSTED comments.
 * Returns batches grouped by contentUrl.
 */
async function loadBatches(data: HealthCheckJobData): Promise<UrlCheckBatch[]> {
  const batchMap = new Map<string, UrlCheckBatch>();

  // --- Regular pipeline ---
  if (data.pipeline !== "hv") {
    const regularWhere: Record<string, unknown> = { status: "POSTED" };
    if (data.scope === "site" && data.siteId) regularWhere.siteId = data.siteId;
    if (data.scope === "opportunity" && data.opportunityId) regularWhere.id = data.opportunityId;

    const regularOpps = await prisma.opportunity.findMany({
      where: regularWhere,
      select: {
        id: true,
        contentUrl: true,
        platform: true,
        comments: {
          where: { status: "POSTED" },
          select: { id: true, text: true },
        },
      },
    });

    for (const opp of regularOpps) {
      if (opp.comments.length === 0) continue;

      const existing = batchMap.get(opp.contentUrl);
      const entry = {
        opportunityId: opp.id,
        pipeline: "regular" as const,
        comments: opp.comments.map((c) => ({ commentId: c.id, text: c.text })),
      };

      if (existing) {
        existing.entries.push(entry);
      } else {
        batchMap.set(opp.contentUrl, {
          contentUrl: opp.contentUrl,
          platform: opp.platform as "REDDIT" | "YOUTUBE",
          entries: [entry],
        });
      }
    }
  }

  // --- HV pipeline ---
  if (data.pipeline !== "regular") {
    const hvWhere: Record<string, unknown> = { status: "POSTED" };
    if (data.scope === "site" && data.siteId) hvWhere.siteId = data.siteId;
    if (data.scope === "opportunity" && data.opportunityId) hvWhere.id = data.opportunityId;

    const hvOpps = await prisma.hVOpportunity.findMany({
      where: hvWhere,
      select: {
        id: true,
        contentUrl: true,
        platform: true,
        hvComments: {
          where: { status: "POSTED" },
          select: { id: true, text: true },
        },
      },
    });

    for (const opp of hvOpps) {
      if (opp.hvComments.length === 0) continue;

      const existing = batchMap.get(opp.contentUrl);
      const entry = {
        opportunityId: opp.id,
        pipeline: "hv" as const,
        comments: opp.hvComments.map((c) => ({ commentId: c.id, text: c.text })),
      };

      if (existing) {
        existing.entries.push(entry);
      } else {
        batchMap.set(opp.contentUrl, {
          contentUrl: opp.contentUrl,
          platform: opp.platform as "REDDIT" | "YOUTUBE",
          entries: [entry],
        });
      }
    }
  }

  return Array.from(batchMap.values());
}

async function mergeHealthCheckMetadata(
  opportunityId: string,
  pipeline: "regular" | "hv",
  healthCheck: HealthCheckMetadata,
) {
  if (pipeline === "regular") {
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { metadata: true },
    });
    const existing = (opp?.metadata as Record<string, unknown>) ?? {};
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { metadata: { ...existing, healthCheck } as unknown as Prisma.InputJsonValue },
    });
  } else {
    const opp = await prisma.hVOpportunity.findUnique({
      where: { id: opportunityId },
      select: { metadata: true },
    });
    const existing = (opp?.metadata as Record<string, unknown>) ?? {};
    await prisma.hVOpportunity.update({
      where: { id: opportunityId },
      data: { metadata: { ...existing, healthCheck } as unknown as Prisma.InputJsonValue },
    });
  }
}

async function processHealthCheck(job: Job<HealthCheckJobData>) {
  const data = job.data;
  await jobLog(job, TAG, `Starting health check — scope: ${data.scope}, pipeline: ${data.pipeline ?? "both"}`);

  const batches = await loadBatches(data);
  const totalUrls = batches.length;
  const totalEntries = batches.reduce((acc, b) => acc + b.entries.length, 0);

  await jobLog(job, TAG, `Loaded ${totalUrls} unique URLs, ${totalEntries} opportunities`);

  if (totalUrls === 0) {
    await jobLog(job, TAG, "No posted opportunities with posted comments found");
    return;
  }

  let processedUrls = 0;
  let totalVisible = 0;
  let totalDeleted = 0;
  let totalUncertain = 0;
  let totalErrors = 0;

  for (const batch of batches) {
    if (processedUrls > 0) {
      await delay(DELAY_BETWEEN_URLS_MS);
    }

    try {
      const results = await checkUrlBatch(batch);

      for (const entry of batch.entries) {
        const healthCheck = results.get(entry.opportunityId);
        if (!healthCheck) continue;

        await mergeHealthCheckMetadata(entry.opportunityId, entry.pipeline, healthCheck);

        if (healthCheck.error) {
          totalErrors++;
        } else {
          totalVisible += healthCheck.visibleCount;
          totalDeleted += healthCheck.deletedCount;
          totalUncertain += healthCheck.uncertainCount;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await jobError(job, TAG, `Failed to check URL ${batch.contentUrl}: ${msg}`);
      totalErrors++;
    }

    processedUrls++;
    if (processedUrls % 10 === 0) {
      await jobLog(job, TAG, `Progress: ${processedUrls}/${totalUrls} URLs`);
      await job.updateProgress(Math.round((processedUrls / totalUrls) * 100));
    }
  }

  await jobLog(
    job,
    TAG,
    `Done — ${totalVisible} visible, ${totalDeleted} deleted, ${totalUncertain} uncertain, ${totalErrors} errors`,
  );
}

export const healthCheckWorker = new Worker<HealthCheckJobData>(
  "health-check",
  processHealthCheck,
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

healthCheckWorker.on("completed", (job) => {
  console.log(`[${TAG}] Job ${job.id} completed`);
});

healthCheckWorker.on("failed", (job, err) => {
  console.error(`[${TAG}] Job ${job?.id} failed:`, err.message);
});

