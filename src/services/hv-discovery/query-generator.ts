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
        content: `You generate decision-making questions that real people would ask an AI chatbot when researching a purchase or tool decision. These questions should be the kind that AI models (ChatGPT, Claude, Gemini, Grok) would answer by citing specific products, Reddit threads, and YouTube reviews.

Categories:
- COMPARISON: "X vs Y" or "best X for Y" comparisons
- RECOMMENDATION: "What do you recommend for..." or "I need a tool that..."
- REVIEW: "Is X worth it?" or "What do people think about..."
- HOW_TO: "How do I accomplish X?" where tools are part of the answer
- PROBLEM_SOLVING: "I have this problem, what should I use?"

Rules:
- Questions must feel natural, like a real person typing into ChatGPT
- Mix casual and detailed questions
- Include competitor names where relevant
- Focus on decision-intent queries, not informational ones
- Each query should be 1-2 sentences max`,
      },
      {
        role: "user",
        content: `Generate ${count} decision-making queries for this business:

Business: ${siteContext.name}
Description: ${siteContext.description}
Value Props: ${siteContext.valueProps.join(", ")}
URL: ${siteContext.url}
Features keywords: ${siteContext.keywordConfig.features.join(", ")}
Competitors: ${siteContext.keywordConfig.competitors.join(", ")}
${existingList}

Return JSON: { queries: [{ query: string, category: string }] }`,
      },
    ],
    temperature: 0.9,
    schema: QuerySchema,
  });

  return result.queries;
}
