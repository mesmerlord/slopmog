import type { Platform } from "@prisma/client";

export interface HVSiteContext {
  id: string;
  name: string;
  description: string;
  valueProps: string[];
  url: string;
  brandTone: string;
  keywordConfig: {
    features: string[];
    competitors: string[];
    brand: string[];
  };
}

export interface GeneratedQuery {
  query: string;
  category: "COMPARISON" | "RECOMMENDATION" | "REVIEW" | "HOW_TO" | "PROBLEM_SOLVING";
}

export interface ParsedCitation {
  url: string;
  title?: string;
  domain: string;
  platform: Platform | null;
  externalId: string | null;
  normalizedUrl: string;
}

export interface ModelCitationResult {
  model: string;
  modelLabel: string;
  query: string;
  responseText: string;
  citations: ParsedCitation[];
  tokensUsed: number;
}

export interface AggregatedCitation {
  url: string;
  normalizedUrl: string;
  title?: string;
  domain: string;
  platform: Platform;
  externalId: string;
  citationCount: number;
  citingModels: string[];
  citingQueries: string[];
  citationScore: number;
}
