import {
  chatCompletionWithCitations,
  HV_ACTIVE_MODELS,
  HV_MODEL_LABELS,
  HV_WEB_SEARCH_OPTIONS,
} from "@/lib/openrouter";
import { extractCitations } from "./citation-parser";
import type { ModelCitationResult } from "./types";

const DEFAULT_MODELS: string[] = [...HV_ACTIVE_MODELS];

export async function searchModelForQuery(
  query: string,
  model: string,
): Promise<ModelCitationResult> {
  const modelLabel = HV_MODEL_LABELS[model] ?? model;

  const result = await chatCompletionWithCitations({
    model,
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that provides thorough, well-researched recommendations. When answering questions about tools, products, or services, include specific recommendations with links to sources. Cite as many relevant sources as possible including Reddit threads, YouTube videos, blog posts, and review sites. Be comprehensive.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    temperature: 0.3,
    maxTokens: 4096,
    webSearchOptions: HV_WEB_SEARCH_OPTIONS,
  });

  const citations = extractCitations(result.content, result.citations);
  const platformCitations = citations.filter((c) => c.platform !== null);

  console.log(
    `[hv-citation-searcher] ${modelLabel} | "${query}" → ${result.citations.length} URLs from search, ${citations.length} unique, ${platformCitations.length} Reddit/YouTube`,
  );

  return {
    model,
    modelLabel,
    query,
    responseText: result.content,
    citations,
    tokensUsed: result.usage.totalTokens,
  };
}

export async function runCitationSearch(
  queries: string[],
  models: string[] = DEFAULT_MODELS,
  onResult?: (result: ModelCitationResult) => void | Promise<void>,
): Promise<ModelCitationResult[]> {
  const calls: Array<{ query: string; model: string }> = [];
  for (const query of queries) {
    for (const model of models) {
      calls.push({ query, model });
    }
  }

  let completed = 0;
  let failedCount = 0;
  const total = calls.length;
  const results: ModelCitationResult[] = [];

  const settled = await Promise.allSettled(
    calls.map((c) =>
      searchModelForQuery(c.query, c.model).then(async (result) => {
        completed++;
        results.push(result);
        await onResult?.(result);
        return result;
      }),
    ),
  );

  settled.forEach((result) => {
    if (result.status === "rejected") {
      failedCount++;
      console.error(`[hv-citation-searcher] Call failed:`, result.reason);
    }
  });

  const totalUrls = results.reduce((sum, r) => sum + r.citations.length, 0);
  const platformUrls = results.reduce(
    (sum, r) => sum + r.citations.filter((c) => c.platform !== null).length,
    0,
  );
  console.log(
    `[hv-citation-searcher] Done: ${results.length}/${total} calls succeeded (${failedCount} failed) → ${totalUrls} total URLs, ${platformUrls} Reddit/YouTube`,
  );

  return results;
}
