import type { ParsedCitation, AggregatedCitation, ModelCitationResult } from "./types";

interface ScoreInput {
  citingModels: string[];
  totalCitations: number;
  citingQueries: string[];
  totalQueries: number;
}

export function computeCitationScore(input: ScoreInput): number {
  const { citingModels, totalCitations, citingQueries, totalQueries } = input;

  // Model diversity (60% weight): 1 model=0.25, 2=0.55, 3=0.80, 4=1.0
  const modelScoreMap: Record<number, number> = { 1: 0.25, 2: 0.55, 3: 0.8, 4: 1.0 };
  const modelCount = Math.min(citingModels.length, 4);
  const modelScore = modelScoreMap[modelCount] ?? 0;

  // Query diversity (25% weight): normalized by total queries
  const queryScore = totalQueries > 0
    ? Math.min(citingQueries.length / totalQueries, 1)
    : 0;

  // Citation frequency (15% weight): log-scaled
  const frequencyScore = Math.min(Math.log2(totalCitations + 1) / Math.log2(16), 1);

  return modelScore * 0.6 + queryScore * 0.25 + frequencyScore * 0.15;
}

export function aggregateCitations(
  allResults: ModelCitationResult[],
  totalQueries: number,
): AggregatedCitation[] {
  // Group by normalizedUrl for Reddit/YouTube only
  const urlMap = new Map<string, {
    url: string;
    normalizedUrl: string;
    title?: string;
    domain: string;
    platform: "REDDIT" | "YOUTUBE";
    externalId: string;
    models: Set<string>;
    queries: Set<string>;
    count: number;
  }>();

  for (const result of allResults) {
    for (const citation of result.citations) {
      // Only aggregate actionable platform citations
      if (!citation.platform || !citation.externalId) continue;

      const key = citation.normalizedUrl;
      const existing = urlMap.get(key);

      if (existing) {
        existing.models.add(result.modelLabel);
        existing.queries.add(result.query);
        existing.count++;
        if (citation.title && !existing.title) {
          existing.title = citation.title;
        }
      } else {
        urlMap.set(key, {
          url: citation.url,
          normalizedUrl: citation.normalizedUrl,
          title: citation.title,
          domain: citation.domain,
          platform: citation.platform as "REDDIT" | "YOUTUBE",
          externalId: citation.externalId,
          models: new Set([result.modelLabel]),
          queries: new Set([result.query]),
          count: 1,
        });
      }
    }
  }

  const aggregated: AggregatedCitation[] = [];
  const entries = Array.from(urlMap.values());
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const citingModels: string[] = [];
    const citingQueries: string[] = [];
    entry.models.forEach((m) => citingModels.push(m));
    entry.queries.forEach((q) => citingQueries.push(q));

    aggregated.push({
      url: entry.url,
      normalizedUrl: entry.normalizedUrl,
      title: entry.title,
      domain: entry.domain,
      platform: entry.platform,
      externalId: entry.externalId,
      citationCount: entry.count,
      citingModels,
      citingQueries,
      citationScore: computeCitationScore({
        citingModels,
        totalCitations: entry.count,
        citingQueries,
        totalQueries,
      }),
    });
  }

  // Sort by citation score descending
  aggregated.sort((a, b) => b.citationScore - a.citationScore);

  return aggregated;
}
