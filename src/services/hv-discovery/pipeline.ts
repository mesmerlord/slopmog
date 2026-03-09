import { prisma } from "@/server/utils/db";
import { hvGenerationQueue, type HVGenerationJobData } from "@/queue/queues";
import { validateRedditThread, validateYouTubeVideo } from "./url-validator";
import { getRedditPostWithComments, getVideoDetails } from "@/services/discovery/scrape-creators";
import { aggregateCitations, computeCitationScore } from "./scorer";
import { Semaphore } from "@/services/shared/parallel";
import type {
  ModelCitationResult,
  EnrichmentData,
  ValidationResult,
  AggregatedCitation,
} from "./types";

const VALIDATION_CONCURRENCY = 8;
const MAX_AUTO_GENERATE = 10;

/** Per-URL running aggregation for live score computation. */
interface UrlAggregationEntry {
  models: Set<string>;
  queries: Set<string>;
  count: number;
}

/** Mutable state shared across streaming callbacks for a single pipeline run. */
export interface PipelineContext {
  siteId: string;
  runId: string;
  allResults: ModelCitationResult[];
  seenUrls: Set<string>;
  validationCache: Map<string, ValidationResult>;
  pendingValidations: Promise<void>[];
  semaphore: Semaphore;
  totalCitations: number;
  opportunitiesCreated: number;
  urlAggregation: Map<string, UrlAggregationEntry>;
  totalQueries: number;
}

export function createPipelineContext(siteId: string, runId: string): PipelineContext {
  return {
    siteId,
    runId,
    allResults: [],
    seenUrls: new Set(),
    validationCache: new Map(),
    pendingValidations: [],
    semaphore: new Semaphore(VALIDATION_CONCURRENCY),
    totalCitations: 0,
    opportunitiesCreated: 0,
    urlAggregation: new Map(),
    totalQueries: 0,
  };
}

/**
 * Save one ModelCitationResult (HVQueryResponse + HVCitations) to DB.
 * Returns the number of citations saved.
 */
export async function saveSearchResult(
  result: ModelCitationResult,
  siteId: string,
): Promise<number> {
  const hvQuery = await prisma.hVQuery.findUnique({
    where: { siteId_query: { siteId, query: result.query } },
  });
  if (!hvQuery) return 0;

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

  let count = 0;
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
      count++;
    } catch {
      // Duplicate or other constraint — skip
    }
  }
  return count;
}

/** Validate + enrich a single Reddit or YouTube URL. */
export async function validateUrl(
  url: string,
  platform: "REDDIT" | "YOUTUBE",
): Promise<ValidationResult> {
  try {
    if (platform === "REDDIT") {
      const postWithComments = await getRedditPostWithComments(url);
      if (postWithComments) {
        const { post } = postWithComments;
        const createdUtc = Number(post.createdAt);
        return {
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
        };
      }
      const result = await validateRedditThread(url);
      return {
        valid: result.valid,
        isLocked: result.isLocked ?? false,
        isArchived: result.isArchived ?? false,
      };
    }

    if (platform === "YOUTUBE") {
      const result = await validateYouTubeVideo(url);
      let enrichment: EnrichmentData | undefined;
      if (result.valid) {
        const details = await getVideoDetails(url);
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
      return { valid: result.valid, isLocked: false, isArchived: false, enrichment };
    }

    return { valid: false, isLocked: false, isArchived: false };
  } catch {
    return { valid: false, isLocked: false, isArchived: false };
  }
}

/** Create or update one HVOpportunity with whatever data is available. */
export async function upsertOpportunity(
  citation: { url: string; externalId: string; platform: "REDDIT" | "YOUTUBE"; domain: string; title?: string },
  validation: ValidationResult,
  siteId: string,
  runId: string,
  citingModels: string[],
  citingQueries: string[],
  citationCount: number,
  citationScore: number,
): Promise<string | null> {
  if (!validation.valid) return null;

  const enrichment = validation.enrichment;
  const enrichedTitle = enrichment?.title ?? citation.title ?? `${citation.platform} ${citation.externalId}`;
  const enrichedSourceContext = enrichment?.sourceContext ?? citation.domain;

  const data = {
    title: enrichedTitle,
    body: enrichment?.body,
    sourceContext: enrichedSourceContext,
    author: enrichment?.author,
    viewCount: enrichment?.viewCount,
    commentCount: enrichment?.commentCount,
    publishedAt: enrichment?.publishedAt,
    citationCount,
    citingModels,
    citingQueries,
    citationScore,
    isLocked: validation.isLocked,
    isArchived: validation.isArchived,
    validatedAt: new Date(),
  };

  const opportunity = await prisma.hVOpportunity.upsert({
    where: { siteId_externalId: { siteId, externalId: citation.externalId } },
    create: {
      siteId,
      discoveryRunId: runId,
      platform: citation.platform,
      status: "DISCOVERED",
      externalId: citation.externalId,
      contentUrl: citation.url,
      ...data,
    },
    update: data,
  });

  return opportunity.id;
}

/** Update running per-URL aggregation with data from a new result. */
function updateAggregation(result: ModelCitationResult, ctx: PipelineContext): void {
  for (const citation of result.citations) {
    if (!citation.platform || !citation.externalId) continue;

    const key = citation.normalizedUrl;
    const existing = ctx.urlAggregation.get(key);

    if (existing) {
      existing.models.add(result.modelLabel);
      existing.queries.add(result.query);
      existing.count++;
    } else {
      ctx.urlAggregation.set(key, {
        models: new Set([result.modelLabel]),
        queries: new Set([result.query]),
        count: 1,
      });
    }
  }
}

/**
 * Per-result streaming callback. Called by `onResult` in `runCitationSearch`.
 * Saves the result, then kicks off validation+upsert for new platform URLs.
 */
export async function processResult(
  result: ModelCitationResult,
  ctx: PipelineContext,
): Promise<void> {
  // 1. Save search result to DB
  const citationsSaved = await saveSearchResult(result, ctx.siteId);
  ctx.totalCitations += citationsSaved;

  // 2. Accumulate for final aggregation
  ctx.allResults.push(result);

  // 3. Update running aggregation
  updateAggregation(result, ctx);

  // 4. For each new Reddit/YouTube URL, kick off validate → upsert
  for (const citation of result.citations) {
    if (!citation.platform || !citation.externalId) continue;

    const key = citation.normalizedUrl;
    if (ctx.seenUrls.has(key)) continue;
    ctx.seenUrls.add(key);

    const platform = citation.platform as "REDDIT" | "YOUTUBE";

    const task = ctx.semaphore.run(async () => {
      const validation = await validateUrl(citation.url, platform);
      ctx.validationCache.set(key, validation);

      if (validation.valid) {
        // Use current aggregation data for a real score
        const agg = ctx.urlAggregation.get(key);
        const citingModels: string[] = [];
        const citingQueries: string[] = [];
        if (agg) {
          agg.models.forEach((m) => citingModels.push(m));
          agg.queries.forEach((q) => citingQueries.push(q));
        } else {
          citingModels.push(result.modelLabel);
          citingQueries.push(result.query);
        }

        const citationCount = agg?.count ?? 1;
        const score = computeCitationScore({
          citingModels,
          totalCitations: citationCount,
          citingQueries,
          totalQueries: ctx.totalQueries || 1,
        });

        await upsertOpportunity(
          {
            url: citation.url,
            externalId: citation.externalId!,
            platform,
            domain: citation.domain,
            title: citation.title,
          },
          validation,
          ctx.siteId,
          ctx.runId,
          citingModels,
          citingQueries,
          citationCount,
          score,
        );
        ctx.opportunitiesCreated++;
      }
    }).catch((err) => {
      console.error(`[hv-pipeline] Validation failed for ${citation.url}:`, err);
    });

    ctx.pendingValidations.push(task);
  }
}

/**
 * After all searches are done, recompute scores via aggregateCitations()
 * and batch-update all opportunity scores.
 */
export async function finalizeScores(
  ctx: PipelineContext,
  totalQueries: number,
): Promise<AggregatedCitation[]> {
  const aggregated = aggregateCitations(ctx.allResults, totalQueries);

  // Batch-update all opportunities with final scores + full citing data
  for (const citation of aggregated) {
    const validation = ctx.validationCache.get(citation.normalizedUrl);
    if (!validation?.valid) continue;

    try {
      await prisma.hVOpportunity.updateMany({
        where: {
          siteId: ctx.siteId,
          externalId: citation.externalId,
        },
        data: {
          citationScore: citation.citationScore,
          citationCount: citation.citationCount,
          citingModels: citation.citingModels,
          citingQueries: citation.citingQueries,
        },
      });
    } catch (err) {
      console.error(`[hv-pipeline] Failed to finalize score for ${citation.url}:`, err);
    }
  }

  return aggregated;
}

/**
 * Query top opportunities by score and queue them for comment generation.
 */
export async function queueTopForGeneration(runId: string): Promise<number> {
  const top = await prisma.hVOpportunity.findMany({
    where: {
      discoveryRunId: runId,
      status: "DISCOVERED",
      hvComments: { none: {} },
    },
    orderBy: { citationScore: "desc" },
    take: MAX_AUTO_GENERATE,
    select: { id: true },
  });

  for (const opp of top) {
    await hvGenerationQueue.add("hv-generate", {
      hvOpportunityId: opp.id,
    } satisfies HVGenerationJobData);
  }

  return top.length;
}
