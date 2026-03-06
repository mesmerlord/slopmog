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
        "REVIEW",
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
        content: `You generate search queries that potential customers would type into AI chatbots (ChatGPT, Claude, Gemini, Grok). The AI models will use web search and cite Reddit threads and YouTube videos in their answers — we want to find those threads/videos.

CRITICAL — DIVERSITY RULES:
- Each query must target a DIFFERENT angle. Don't just rephrase the same idea.
- Cover ALL features, use cases, and audiences from the research. Don't fixate on one.
- Vary the query structure: some questions, some fragments, some comparisons, some problem statements.
- Mix specificity levels: some broad ("best AI photo editor"), some narrow ("how to fix grainy photos from phone camera").
- Don't cluster around competitors — spread across the full problem space.
- Real people don't type the same way twice. Make each query feel like a different person asking.

Categories:
- COMPARISON: The business vs a specific competitor, or business approach vs alternatives
- RECOMMENDATION: "Best tool for [specific thing]", "What should I use for [specific problem]?"
- REVIEW: "Has anyone used [tool] for [specific use case]?" or "[tool] review for [niche]"
- HOW_TO: "How do I [specific task the business helps with]?"
- PROBLEM_SOLVING: "I'm struggling with [specific pain point]", "[situation] and need help"

Query style:
- 3-15 words, natural and conversational
- Think "what would someone type into ChatGPT at 11pm trying to solve their problem"
- ~25% include the business name
- ~15% include a competitor name (always in context of the business's problem space)
- ~60% are pure problem-space / use-case queries
- NO generic filler queries like "best tool 2025" — every query should have a specific angle`,
      },
      {
        role: "user",
        content: `Generate ${count} diverse queries for this business.

Business: ${siteContext.name} (${siteContext.url})
Competitors: ${siteContext.keywordConfig.competitors.join(", ") || "none listed"}
Feature keywords: ${siteContext.keywordConfig.features.join(", ") || "none listed"}

Here is detailed research about what this business offers:

${siteResearch}
${existingList}

Generate exactly ${count} queries. Every single one must target a different angle — if I see two queries that would surface the same Reddit thread, you've failed.

Return JSON: { queries: [{ query: string, category: string }] }`,
      },
    ],
    temperature: 0.8,
    schema: QuerySchema,
  });

  return result.queries;
}
