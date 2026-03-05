import {
  chatCompletionWithCitations,
  HV_ONLINE_MODELS,
  HV_MODEL_LABELS,
} from "@/lib/openrouter";
import { extractCitations } from "./citation-parser";
import type { ModelCitationResult } from "./types";

const ALL_MODELS = Object.values(HV_ONLINE_MODELS);

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
        content: `You are a helpful assistant that provides thorough, well-researched recommendations. When answering questions about tools, products, or services, include specific recommendations with links to relevant sources like Reddit discussions, YouTube reviews, and product pages. Be comprehensive and cite your sources.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    temperature: 0.3,
    maxTokens: 4096,
  });

  const citations = extractCitations(result.content, result.citations);

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
  models: string[] = ALL_MODELS,
  onProgress?: (completed: number, total: number) => void,
): Promise<ModelCitationResult[]> {
  // Fire all query×model combinations in parallel — OpenRouter handles the concurrency
  const calls: Array<{ query: string; model: string }> = [];
  for (const query of queries) {
    for (const model of models) {
      calls.push({ query, model });
    }
  }

  let completed = 0;
  const total = calls.length;

  const settled = await Promise.allSettled(
    calls.map((c) =>
      searchModelForQuery(c.query, c.model).then((result) => {
        completed++;
        onProgress?.(completed, total);
        return result;
      }),
    ),
  );

  const results: ModelCitationResult[] = [];
  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      console.error(`[hv-citation-searcher] Call failed:`, result.reason);
    }
  });

  return results;
}
