import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import type { HVSiteContext, GeneratedQuery } from "./types";

const QuerySchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      category: z.enum(["COMPARISON", "RECOMMENDATION", "REVIEW", "HOW_TO", "PROBLEM_SOLVING"]),
    }),
  ),
});

export async function generateDecisionQueries(
  siteContext: HVSiteContext,
  existingQueries: string[],
  count: number = 10,
): Promise<GeneratedQuery[]> {
  const existingList = existingQueries.length > 0
    ? `\nAlready generated queries (DO NOT repeat these):\n${existingQueries.map((q) => `- ${q}`).join("\n")}`
    : "";

  const result = await chatCompletionJSON({
    model: MODELS.CLAUDE_SONNET,
    messages: [
      {
        role: "system",
        content: `You are an expert at understanding what people search for when they're looking for a product or solution like the one described below.

Your job: generate queries that a potential customer of this business might type into an AI chatbot (ChatGPT, Claude, Gemini, Grok). We want queries where AI models with web search will CITE real Reddit threads and YouTube videos in their answers.

The goal: find threads/videos where this business could naturally be recommended. We'll later post comments in those threads mentioning the business.

CRITICAL RULES:
- EVERY query must be relevant to the business described. A thread surfaced by the query should be one where the business could naturally be mentioned.
- NEVER generate competitor-vs-competitor queries that don't involve the business. "X vs Y" is only useful if X or Y is the business itself, or if the query is about the problem the business solves.
- Focus on the PROBLEMS the business solves, not on competitor tool shopping.
- The best queries are ones where someone is looking for a solution that this business provides.

Categories:
- COMPARISON: The business vs a competitor, or the business's approach vs alternatives
- RECOMMENDATION: "Best tool for [thing the business does]", "What should I use for [problem]?"
- REVIEW: "Has anyone used [business] or similar tools for [use case]?"
- HOW_TO: "How do I [accomplish thing the business helps with]?"
- PROBLEM_SOLVING: "I'm struggling with [problem the business solves]"

Query style:
- Short and natural, 3-12 words
- Mix of questions and fragments
- Think "what would a potential customer type into ChatGPT"
- Include the business name in ~30% of queries, competitor names in ~20% (always paired with the business or its problem space)
- ~50% should be pure problem-space queries about what the business solves`,
      },
      {
        role: "user",
        content: `Generate ${count} queries for this business:

Business: ${siteContext.name} (${siteContext.url})
What it does: ${siteContext.description}
Key value props: ${siteContext.valueProps.join(", ")}
Competitors: ${siteContext.keywordConfig.competitors.join(", ")}
Feature keywords: ${siteContext.keywordConfig.features.join(", ")}

Remember: every query must surface threads where ${siteContext.name} could be naturally recommended. No competitor-vs-competitor queries unless ${siteContext.name} is part of the comparison.
${existingList}

Return JSON: { queries: [{ query: string, category: string }] }`,
      },
    ],
    temperature: 0.7,
    schema: QuerySchema,
  });

  return result.queries;
}
