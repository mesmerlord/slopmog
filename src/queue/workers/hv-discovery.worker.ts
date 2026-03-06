import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { HVDiscoveryJobData } from "@/queue/queues";
import { hvGenerationQueue, jobLog, jobWarn, jobError, type HVGenerationJobData } from "@/queue/queues";
import { generateDecisionQueries } from "@/services/hv-discovery/query-generator";
import { runCitationSearch } from "@/services/hv-discovery/citation-searcher";
import { aggregateCitations } from "@/services/hv-discovery/scorer";
import { validateRedditThread, validateYouTubeVideo } from "@/services/hv-discovery/url-validator";
import { getRedditPostWithComments, getVideoDetails } from "@/services/discovery/scrape-creators";
import type { HVSiteContext, ModelCitationResult } from "@/services/hv-discovery/types";
import { pMap } from "@/services/shared/parallel";

const MAX_AUTO_GENERATE = 5;

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

interface EnrichmentData {
  contentUrl?: string;
  title?: string;
  body?: string;
  sourceContext?: string;
  author?: string;
  viewCount?: number;
  commentCount?: number;
  publishedAt?: Date;
}

interface ValidationResult {
  valid: boolean;
  isLocked: boolean;
  isArchived: boolean;
  enrichment?: EnrichmentData;
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

    // 5. Fire ALL queries across all models in parallel
    await jobLog(job, "hv-discovery", `Searching ${savedQueries.length} queries across all models in parallel...`);

    const allResults = await runCitationSearch(savedQueries);

    if (await isHVRunCancelled(run.id)) {
      await jobLog(job, "hv-discovery", `Run cancelled — stopping after search`);
      return;
    }

    // 6. Save responses and citations to DB
    let totalCitations = 0;
    for (const result of allResults) {
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

    await jobLog(job, "hv-discovery", `Saved ${totalCitations} citations from ${allResults.length} model responses`);

    // 7. Aggregate and score all citations
    const aggregated = aggregateCitations(allResults, savedQueries.length);

    await jobLog(job, "hv-discovery", `Found ${aggregated.length} unique Reddit/YouTube URLs — validating...`);

    // 8. Validate URLs in parallel (concurrency-limited to avoid hammering scrapers)
    const VALIDATION_CONCURRENCY = 8;
    const validationCache = new Map<string, ValidationResult>();

    const validateOne = async (citation: typeof aggregated[number]): Promise<void> => {
      try {
        if (citation.platform === "REDDIT") {
          const postWithComments = await getRedditPostWithComments(citation.url);
          if (postWithComments) {
            const { post } = postWithComments;
            const createdUtc = Number(post.createdAt);
            validationCache.set(citation.normalizedUrl, {
              valid: true,
              isLocked: false,
              isArchived: false,
              enrichment: {
                title: post.title || undefined,
                body: post.body || undefined,
                sourceContext: post.subreddit ? `r/${post.subreddit}` : undefined,
                author: post.author || undefined,
                commentCount: post.numComments || undefined,
                publishedAt: createdUtc > 0 ? new Date(createdUtc * 1000) : undefined,
              },
            });
          } else {
            const result = await validateRedditThread(citation.url);
            validationCache.set(citation.normalizedUrl, {
              valid: result.valid,
              isLocked: result.isLocked ?? false,
              isArchived: result.isArchived ?? false,
            });
          }
        } else if (citation.platform === "YOUTUBE") {
          const result = await validateYouTubeVideo(citation.url);
          let enrichment: EnrichmentData | undefined;
          if (result.valid) {
            const details = await getVideoDetails(citation.url);
            if (details) {
              enrichment = {
                title: details.title || undefined,
                body: details.description || undefined,
                sourceContext: details.channelName || undefined,
                author: details.channelName || undefined,
                viewCount: details.viewCount || undefined,
                commentCount: details.commentCount || undefined,
                publishedAt: details.publishedAt ? new Date(details.publishedAt) : undefined,
              };
            }
          }
          validationCache.set(citation.normalizedUrl, { valid: result.valid, isLocked: false, isArchived: false, enrichment });
        } else {
          validationCache.set(citation.normalizedUrl, { valid: false, isLocked: false, isArchived: false });
        }
      } catch {
        validationCache.set(citation.normalizedUrl, { valid: false, isLocked: false, isArchived: false });
      }
    };

    await pMap(aggregated, (c) => validateOne(c).catch(() => {}), VALIDATION_CONCURRENCY);

    await jobLog(job, "hv-discovery", `Validation done — ${Array.from(validationCache.values()).filter((v) => v.valid).length}/${aggregated.length} valid`);

    // 9. Create/update opportunities
    let opportunitiesCreated = 0;
    const queuedOpportunityIds = new Set<string>();

    for (const citation of aggregated) {
      const validation = validationCache.get(citation.normalizedUrl);
      if (!validation?.valid) continue;

      try {
        const enrichment = validation.enrichment;
        const enrichedTitle = enrichment?.title ?? citation.title ?? `${citation.platform} ${citation.externalId}`;
        const enrichedSourceContext = enrichment?.sourceContext ?? citation.domain;

        const opportunity = await prisma.hVOpportunity.upsert({
          where: { siteId_externalId: { siteId, externalId: citation.externalId } },
          create: {
            siteId,
            discoveryRunId: run.id,
            platform: citation.platform,
            status: "DISCOVERED",
            externalId: citation.externalId,
            contentUrl: citation.url,
            title: enrichedTitle,
            body: enrichment?.body,
            sourceContext: enrichedSourceContext,
            author: enrichment?.author,
            viewCount: enrichment?.viewCount,
            commentCount: enrichment?.commentCount,
            publishedAt: enrichment?.publishedAt,
            citationCount: citation.citationCount,
            citingModels: citation.citingModels,
            citingQueries: citation.citingQueries,
            citationScore: citation.citationScore,
            isLocked: validation.isLocked,
            isArchived: validation.isArchived,
            validatedAt: new Date(),
          },
          update: {
            title: enrichedTitle,
            body: enrichment?.body,
            sourceContext: enrichedSourceContext,
            author: enrichment?.author,
            viewCount: enrichment?.viewCount,
            commentCount: enrichment?.commentCount,
            publishedAt: enrichment?.publishedAt,
            citationCount: citation.citationCount,
            citingModels: citation.citingModels,
            citingQueries: citation.citingQueries,
            citationScore: citation.citationScore,
            isLocked: validation.isLocked,
            isArchived: validation.isArchived,
            validatedAt: new Date(),
          },
        });

        opportunitiesCreated++;

        // Queue generation for top opportunities
        if (
          queuedOpportunityIds.size < MAX_AUTO_GENERATE &&
          !queuedOpportunityIds.has(opportunity.id) &&
          opportunity.status === "DISCOVERED"
        ) {
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

    // Update run counts
    await prisma.hVDiscoveryRun.update({
      where: { id: run.id },
      data: {
        queriesUsed: savedQueries,
        citationsFound: totalCitations,
        opportunitiesCreated,
      },
    });

    await jobLog(job, "hv-discovery", `${opportunitiesCreated} opportunities created, ${queuedOpportunityIds.size} queued for generation`);

    // 6. Final pass: ensure top MAX_AUTO_GENERATE have generation queued
    // Some may have been missed if they only crossed the threshold in later queries
    if (await isHVRunCancelled(run.id)) {
      await jobLog(job, "hv-discovery", `Run cancelled — skipping backfill and completion`);
      return;
    }

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

    // 7. Mark run complete (skip if already cancelled)
    if (!(await isHVRunCancelled(run.id))) {
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
    }

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
