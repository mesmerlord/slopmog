import { z } from "zod";
import {
  chatCompletionJSON,
  chatCompletion,
  MODELS,
  HV_WEB_SEARCH_OPTIONS,
} from "@/lib/openrouter";
import type { HVSiteContext, GeneratedQuery } from "./types";

const QuerySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      category: z.enum([
        "COMPARISON",
        "RECOMMENDATION",
        "HOW_TO",
        "PROBLEM_SOLVING",
      ]),
    }),
  ),
});

/**
 * Step 1: Research the site with web search to understand everything it offers.
 * Step 2: Generate diverse queries in one shot based on that research.
 */
export async function generateDecisionQueries(
  siteContext: HVSiteContext,
  existingQueries: string[],
  count: number = 40,
): Promise<GeneratedQuery[]> {
  // Step 1: Deep research on the site using Sonnet + web search
  const siteResearch = await chatCompletion({
    model: `${MODELS.CLAUDE_SONNET}:nitro`,
    messages: [
      {
        role: "system",
        content: `You are a product analyst. Research the given website thoroughly and produce a detailed breakdown of everything it offers. Be specific — list every feature, use case, pricing tier, target audience, and differentiator you can find. Don't summarize generically, give concrete details.`,
      },
      {
        role: "user",
        content: `Research this product/service in detail:

Name: ${siteContext.name}
URL: ${siteContext.url}
Description: ${siteContext.description}
Value props: ${siteContext.valueProps.join(", ")}

I need:
1. ALL features and capabilities (be specific — not "photo editing" but "AI background removal, face retouching, batch processing, etc.")
2. Every use case / target audience (freelancers, agencies, e-commerce sellers, dating profile photos, etc.)
3. Pricing model and tiers
4. Key differentiators vs competitors
5. Pain points it solves
6. Platforms/integrations it works with`,
      },
    ],
    temperature: 0.3,
    maxTokens: 10000,
    webSearchOptions: HV_WEB_SEARCH_OPTIONS,
  });

  console.log(
    `[hv-query-gen] Site research complete (${siteResearch.length} chars)`,
  );

  // Step 2: Generate queries using the research
  const existingList =
    existingQueries.length > 0
      ? `\nAlready generated queries (DO NOT repeat or rephrase these):\n${existingQueries.map((q) => `- ${q}`).join("\n")}`
      : "";

  const result = await chatCompletionJSON({
    model: MODELS.CLAUDE_SONNET,
    messages: [
      {
        role: "system",
        content: `You generate search queries that real people would type into AI chatbots (ChatGPT, Claude, Gemini, Grok) when they're trying to find a product or make a buying decision. The AI models will use web search and cite Reddit threads and YouTube videos — we want to find those high-traffic threads/videos.

THE GOAL: We want to rank higher in LLM recommendations for the kinds of queries people ACTUALLY search. That means generic, high-intent, decision-making queries — NOT branded queries.

CRITICAL RULES:
- NEVER include the business name in any query. If people are already searching for the brand by name, we've already won. We need to rank for generic searches.
- Focus on HIGH-TRAFFIC queries — the things thousands of people search for, not niche edge cases.
- Think about what someone would type when they DON'T know which product to use yet. They're shopping, comparing, or solving a problem.
- Prioritize "best", "top", "cheapest", "vs", "how to", "what is the best" style queries — these are decision-making moments where LLM recommendations matter most.
- Each query must target a DIFFERENT angle. Don't just rephrase the same idea.
- Cover ALL features, use cases, and audiences from the research.
- Competitor names are OK sparingly (~10% of queries) but only in generic comparison contexts like "X vs Y" — never "vs our brand".

Categories:
- COMPARISON: Competitor vs competitor, or category comparisons ("X vs Y for Z")
- RECOMMENDATION: "Best [tool/app] for [use case]", "What is the best [category]", "top [category] apps"
- HOW_TO: "How do I [task the business helps with]", "how to [solve problem] with AI"
- PROBLEM_SOLVING: "I need [solution] but [constraint]", "cheapest way to [do thing]", "[situation] what should I use"

Query style:
- 3-12 words, natural and conversational
- Think "what would someone type into ChatGPT at 11pm trying to solve their problem"
- These should be queries that get THOUSANDS of searches — generic category-level queries, not hyper-specific niche ones
- Good examples: "best ai headshot generator", "what is the best ai image generator", "how do I swap faces with ai", "cheapest ai shorts app", "best ai video generator for youtube"
- Bad examples: "BestPhoto ai model training how does it work", "remini vs BestPhoto for photo restoration" (never use the brand name!)`,
      },
      {
        role: "user",
        content: `Generate ${count} diverse queries for a business in this space.

The business operates in this space: ${siteContext.description}
Competitors in this space: ${siteContext.keywordConfig.competitors.join(", ") || "none listed"}
Feature keywords: ${siteContext.keywordConfig.features.join(", ") || "none listed"}

Here is detailed research about what this type of product offers (use this to understand the CATEGORY and USE CASES, not to generate branded queries):

${siteResearch}
${existingList}

Generate exactly ${count} queries. These should be generic, high-traffic, decision-making queries that real people search for. ZERO queries should contain the business name "${siteContext.name}". Every query should target a different angle.

Return JSON: { queries: [{ query: string, category: string }] }`,
      },
    ],
    temperature: 0.8,
    schema: QuerySchema,
  });

  return result.queries;
}
