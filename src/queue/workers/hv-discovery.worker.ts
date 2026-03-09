import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { HVDiscoveryJobData } from "@/queue/queues";
import { jobLog, jobWarn, jobError } from "@/queue/queues";
import { generateDecisionQueries } from "@/services/hv-discovery/query-generator";
import { runCitationSearch } from "@/services/hv-discovery/citation-searcher";
import type { HVSiteContext } from "@/services/hv-discovery/types";
import {
  createPipelineContext,
  processResult,
  finalizeScores,
  queueTopForGeneration,
} from "@/services/hv-discovery/pipeline";

async function isHVRunCancelled(runId: string): Promise<boolean> {
  const run = await prisma.hVDiscoveryRun.findUnique({ where: { id: runId }, select: { status: true } });
  return run?.status === "CANCELLED";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseSiteKeywordConfig(keywordConfig: unknown): HVSiteContext["keywordConfig"] {
  const raw = keywordConfig && typeof keywordConfig === "object"
    ? keywordConfig as Record<string, unknown>
    : {};

  return {
    features: readStringArray(raw.features),
    competitors: readStringArray(raw.competitors),
    brand: readStringArray(raw.brand),
  };
}

async function processHVDiscovery(job: Job<HVDiscoveryJobData>) {
  const { siteId, queryCount = 40 } = job.data;

  await jobLog(job, "hv-discovery", `Starting HV discovery for site ${siteId}`);

  // 1. Load site context
  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      description: true,
      valueProps: true,
      url: true,
      brandTone: true,
      keywordConfig: true,
    },
  });

  const siteContext: HVSiteContext = {
    id: site.id,
    name: site.name,
    description: site.description,
    valueProps: site.valueProps,
    url: site.url,
    brandTone: site.brandTone,
    keywordConfig: parseSiteKeywordConfig(site.keywordConfig),
  };

  // 2. Create HVDiscoveryRun
  const run = await prisma.hVDiscoveryRun.create({
    data: {
      siteId,
      status: "RUNNING",
      queriesUsed: [],
    },
  });

  try {
    // 3. Load existing queries for dedup
    const existingQueries = await prisma.hVQuery.findMany({
      where: { siteId },
      select: { query: true },
    });
    const existingQueryTexts = existingQueries.map((q) => q.query);

    await jobLog(job, "hv-discovery", `Found ${existingQueryTexts.length} existing queries`);

    // 4. Generate decision queries
    await jobLog(job, "hv-discovery", `Generating ${queryCount} decision queries...`);
    const generatedQueries = await generateDecisionQueries(
      siteContext,
      existingQueryTexts,
      queryCount,
    );

    const savedQueries: string[] = [];
    for (const gq of generatedQueries) {
      try {
        await prisma.hVQuery.upsert({
          where: { siteId_query: { siteId, query: gq.query } },
          create: { siteId, query: gq.query, category: gq.category },
          update: {},
        });
        savedQueries.push(gq.query);
      } catch (err) {
        await jobWarn(job, "hv-discovery", `Failed to save query: "${gq.query}" – ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await jobLog(job, "hv-discovery", `Saved ${savedQueries.length} queries`);

    // 5. Initialize pipeline state and run streaming search
    const ctx = createPipelineContext(siteId, run.id);
    ctx.totalQueries = savedQueries.length;

    await jobLog(job, "hv-discovery", `Searching ${savedQueries.length} queries across all models (streaming)...`);

    await runCitationSearch(savedQueries, undefined, async (result) => {
      try {
        await processResult(result, ctx);
      } catch (err) {
        await jobWarn(job, "hv-discovery", `Failed to process result for ${result.model}/"${result.query}": ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    if (await isHVRunCancelled(run.id)) {
      await jobLog(job, "hv-discovery", `Run cancelled — stopping after search`);
      return;
    }

    // 6. Wait for all pending validations to finish
    await jobLog(job, "hv-discovery", `Search done — waiting for ${ctx.pendingValidations.length} pending validations...`);
    await Promise.allSettled(ctx.pendingValidations);

    await jobLog(job, "hv-discovery", `Saved ${ctx.totalCitations} citations, ${ctx.opportunitiesCreated} opportunities so far`);

    // 7. Finalize scores — recompute via aggregateCitations and batch-update
    await jobLog(job, "hv-discovery", `Finalizing citation scores...`);
    const aggregated = await finalizeScores(ctx, savedQueries.length);

    await jobLog(job, "hv-discovery", `Scored ${aggregated.length} unique URLs`);

    // 8. Queue top opportunities for generation
    if (await isHVRunCancelled(run.id)) {
      await jobLog(job, "hv-discovery", `Run cancelled — skipping generation queue`);
      return;
    }

    const queued = await queueTopForGeneration(run.id);
    await jobLog(job, "hv-discovery", `Queued ${queued} opportunities for generation`);

    // 9. Update run counts
    await prisma.hVDiscoveryRun.update({
      where: { id: run.id },
      data: {
        queriesUsed: savedQueries,
        citationsFound: ctx.totalCitations,
        opportunitiesCreated: ctx.opportunitiesCreated,
      },
    });

    // 10. Mark run complete
    if (!(await isHVRunCancelled(run.id))) {
      await prisma.hVDiscoveryRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          queriesUsed: savedQueries,
          citationsFound: ctx.totalCitations,
          opportunitiesCreated: ctx.opportunitiesCreated,
          completedAt: new Date(),
        },
      });
    }

    await jobLog(job, "hv-discovery", `HV discovery completed: ${ctx.totalCitations} citations, ${ctx.opportunitiesCreated} opportunities, ${queued} generating`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await jobError(job, "hv-discovery", `Run ${run.id} failed: ${errorMessage}`);

    await prisma.hVDiscoveryRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    throw err;
  }
}

export const hvDiscoveryWorker = new Worker<HVDiscoveryJobData>(
  "hv-discovery",
  processHVDiscovery,
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

hvDiscoveryWorker.on("completed", (job) => {
  jobLog(job, "hv-discovery", `Job ${job.id} completed`);
});

hvDiscoveryWorker.on("failed", (job, err) => {
  if (job) {
    jobError(job, "hv-discovery", `Job ${job.id} failed: ${err.message}`);
  } else {
    console.error(`[hv-discovery] Job failed (no job ref): ${err.message}`);
  }
});
