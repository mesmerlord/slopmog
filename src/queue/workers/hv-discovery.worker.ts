import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { HVDiscoveryJobData } from "@/queue/queues";
import { hvGenerationQueue, jobLog, jobWarn, jobError, type HVGenerationJobData } from "@/queue/queues";
import { generateDecisionQueries } from "@/services/hv-discovery/query-generator";
import { runCitationSearch } from "@/services/hv-discovery/citation-searcher";
import { aggregateCitations } from "@/services/hv-discovery/scorer";
import { validateRedditThread, validateYouTubeVideo } from "@/services/hv-discovery/url-validator";
import type { HVSiteContext, ModelCitationResult } from "@/services/hv-discovery/types";

const MAX_AUTO_GENERATE = 5;

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

interface ValidationResult {
  valid: boolean;
  isLocked: boolean;
  isArchived: boolean;
}

async function processHVDiscovery(job: Job<HVDiscoveryJobData>) {
  const { siteId, queryCount = 10 } = job.data;

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

    // Save new queries
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

    // 5. Process queries one at a time — surface opportunities incrementally
    const allResultsSoFar: ModelCitationResult[] = [];
    let totalCitations = 0;
    let opportunitiesCreated = 0;
    const queuedOpportunityIds = new Set<string>();
    // Cache URL validation results to avoid re-fetching across iterations
    const validationCache = new Map<string, ValidationResult>();

    for (let qi = 0; qi < savedQueries.length; qi++) {
      const query = savedQueries[qi];
      const queryNum = qi + 1;

      await jobLog(job, "hv-discovery", `[${queryNum}/${savedQueries.length}] Searching: "${query.slice(0, 60)}${query.length > 60 ? "..." : ""}"`);

      // Run 4 model calls for this single query in parallel
      const queryResults = await runCitationSearch([query]);

      // Save responses and citations for this query
      for (const result of queryResults) {
        try {
          const hvQuery = await prisma.hVQuery.findUnique({
            where: { siteId_query: { siteId, query: result.query } },
          });
          if (!hvQuery) continue;

          const response = await prisma.hVQueryResponse.upsert({
            where: { queryId_model: { queryId: hvQuery.id, model: result.model } },
            create: {
              queryId: hvQuery.id,
              model: result.model,
              responseText: result.responseText.slice(0, 50000),
              tokensUsed: result.tokensUsed,
            },
            update: {
              responseText: result.responseText.slice(0, 50000),
              tokensUsed: result.tokensUsed,
            },
          });

          for (const citation of result.citations) {
            try {
              await prisma.hVCitation.create({
                data: {
                  responseId: response.id,
                  url: citation.url,
                  domain: citation.domain,
                  title: citation.title,
                  platform: citation.platform,
                },
              });
              totalCitations++;
            } catch {
              // Duplicate or other constraint, skip
            }
          }
        } catch (err) {
          await jobWarn(job, "hv-discovery", `Failed to save response for model ${result.model}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      allResultsSoFar.push(...queryResults);

      // Re-aggregate ALL citations collected so far
      // Use savedQueries.length (not queryNum) so scores are stable relative to the full run
      const aggregated = aggregateCitations(allResultsSoFar, savedQueries.length);

      // Validate and upsert opportunities incrementally
      let newThisQuery = 0;
      for (const citation of aggregated) {
        try {
          // Check validation cache first
          let validation = validationCache.get(citation.normalizedUrl);

          if (!validation) {
            if (citation.platform === "REDDIT") {
              const result = await validateRedditThread(citation.url);
              validation = {
                valid: result.valid,
                isLocked: result.isLocked ?? false,
                isArchived: result.isArchived ?? false,
              };
            } else if (citation.platform === "YOUTUBE") {
              const result = await validateYouTubeVideo(citation.url);
              validation = { valid: result.valid, isLocked: false, isArchived: false };
            } else {
              validation = { valid: false, isLocked: false, isArchived: false };
            }
            validationCache.set(citation.normalizedUrl, validation);
          }

          if (!validation.valid) continue;

          const opportunity = await prisma.hVOpportunity.upsert({
            where: { siteId_externalId: { siteId, externalId: citation.externalId } },
            create: {
              siteId,
              discoveryRunId: run.id,
              platform: citation.platform,
              status: "DISCOVERED",
              externalId: citation.externalId,
              contentUrl: citation.url,
              title: citation.title ?? `${citation.platform} ${citation.externalId}`,
              sourceContext: citation.domain,
              citationCount: citation.citationCount,
              citingModels: citation.citingModels,
              citingQueries: citation.citingQueries,
              citationScore: citation.citationScore,
              isLocked: validation.isLocked,
              isArchived: validation.isArchived,
              validatedAt: new Date(),
            },
            update: {
              citationCount: citation.citationCount,
              citingModels: citation.citingModels,
              citingQueries: citation.citingQueries,
              citationScore: citation.citationScore,
              isLocked: validation.isLocked,
              isArchived: validation.isArchived,
              validatedAt: new Date(),
            },
          });

          // Track new opportunities (created = DISCOVERED means we just made it)
          if (opportunity.status === "DISCOVERED") {
            newThisQuery++;
          }

          // Queue generation for top opportunities as they emerge
          if (
            queuedOpportunityIds.size < MAX_AUTO_GENERATE &&
            !queuedOpportunityIds.has(opportunity.id) &&
            opportunity.status === "DISCOVERED"
          ) {
            // Check it doesn't already have a comment from a previous run
            const existingComment = await prisma.hVComment.count({
              where: { hvOpportunityId: opportunity.id },
            });

            if (existingComment === 0) {
              await hvGenerationQueue.add("hv-generate", {
                hvOpportunityId: opportunity.id,
              } satisfies HVGenerationJobData);
              queuedOpportunityIds.add(opportunity.id);
            }
          }
        } catch (err) {
          await jobWarn(job, "hv-discovery", `Failed to save opportunity for ${citation.url}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      opportunitiesCreated = aggregated.filter((c) => validationCache.get(c.normalizedUrl)?.valid).length;

      // Update run counts progressively
      await prisma.hVDiscoveryRun.update({
        where: { id: run.id },
        data: {
          queriesUsed: savedQueries.slice(0, queryNum),
          citationsFound: totalCitations,
          opportunitiesCreated,
        },
      });

      await jobLog(job, "hv-discovery", `[${queryNum}/${savedQueries.length}] ${newThisQuery > 0 ? `+${newThisQuery} new` : "no new"} opportunities (${opportunitiesCreated} total, ${queuedOpportunityIds.size} generating)`);
    }

    // 6. Final pass: ensure top MAX_AUTO_GENERATE have generation queued
    // Some may have been missed if they only crossed the threshold in later queries
    if (queuedOpportunityIds.size < MAX_AUTO_GENERATE) {
      const topUnqueued = await prisma.hVOpportunity.findMany({
        where: {
          discoveryRunId: run.id,
          status: "DISCOVERED",
          id: { notIn: Array.from(queuedOpportunityIds) },
          hvComments: { none: {} },
        },
        orderBy: { citationScore: "desc" },
        take: MAX_AUTO_GENERATE - queuedOpportunityIds.size,
        select: { id: true },
      });

      for (const opp of topUnqueued) {
        await hvGenerationQueue.add("hv-generate", {
          hvOpportunityId: opp.id,
        } satisfies HVGenerationJobData);
        queuedOpportunityIds.add(opp.id);
      }

      if (topUnqueued.length > 0) {
        await jobLog(job, "hv-discovery", `Final pass: backfilled ${topUnqueued.length} opportunities for generation`);
      }
    }

    // 7. Mark run complete
    await prisma.hVDiscoveryRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        queriesUsed: savedQueries,
        citationsFound: totalCitations,
        opportunitiesCreated,
        completedAt: new Date(),
      },
    });

    await jobLog(job, "hv-discovery", `HV discovery completed: ${totalCitations} citations, ${opportunitiesCreated} opportunities, ${queuedOpportunityIds.size} generating`);
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
