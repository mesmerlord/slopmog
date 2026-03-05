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
        content: `You are an expert at understanding what people ACTUALLY discuss in online communities (Reddit, YouTube, forums) around a given industry.

Your job: given a business, generate search queries that will surface the Reddit threads and YouTube videos where that business's category is being actively discussed. These queries get sent to AI chatbots with web search — we want queries that make those chatbots CITE real community discussions.

The key insight: the best threads to find are NOT "recommend me a tool" threads. They're the organic discussions where people talk about real problems, share experiences, debate approaches, and mention tools naturally along the way. Those threads are what AI models cite most.

Categories (think of these as the TYPES of discussions happening in the community):
- COMPARISON: Community debates and comparisons between specific approaches or tools
- RECOMMENDATION: Threads where people share what's working for them
- REVIEW: Experience reports, "I tried X, here's what happened"
- HOW_TO: People figuring out how to accomplish something, sharing workflows
- PROBLEM_SOLVING: People troubleshooting, asking for help with real problems

Think about what's ACTUALLY being discussed on Reddit and YouTube in this business's space:
- What problems are people venting about?
- What comparisons come up repeatedly?
- What workflows are people sharing?
- What's the current hot debate or trend?
- What are beginners asking about?
- What are experienced people recommending to beginners?

Query style:
- Short and natural, 3-12 words
- Mix of questions and fragments
- Think "what would someone type into ChatGPT" not "what would a blog post be titled"
- Include specific tool/brand names from the competitor list naturally
- Some queries should be about the PROBLEM SPACE (not tool shopping) because those threads often have the richest discussions`,
      },
      {
        role: "user",
        content: `Generate ${count} queries for this business's space:

Business: ${siteContext.name}
What it does: ${siteContext.description}
Key value props: ${siteContext.valueProps.join(", ")}
Competitors: ${siteContext.keywordConfig.competitors.join(", ")}
Feature keywords: ${siteContext.keywordConfig.features.join(", ")}

Think about what real discussions exist on Reddit and YouTube around these topics. Generate queries that will surface those threads — not "recommend me a tool" queries, but queries about the actual problems, debates, and workflows people discuss in this space.
${existingList}

Return JSON: { queries: [{ query: string, category: string }] }`,
      },
    ],
    temperature: 0.7,
    schema: QuerySchema,
  });

  return result.queries;
}
