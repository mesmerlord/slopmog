import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";

export interface ScoreInput {
  externalId: string;
  title: string;
  body?: string;
  sourceContext: string;
  platform: "REDDIT" | "YOUTUBE";
}

export interface SiteContext {
  name: string;
  description: string;
  valueProps: string[];
  keywords: string[];
}

export interface ScoredItem {
  externalId: string;
  relevant: boolean;
  relevanceScore: number;
  postType: string;
  scoreReason: string;
}

const ScoreBatchSchema = z.array(
  z.object({
    index: z.number(),
    relevant: z.boolean(),
    relevanceScore: z.number().min(0).max(1),
    postType: z.string(),
    scoreReason: z.string(),
  }),
);

const BATCH_SIZE = 20;
const MIN_SCORE = 0.6;

export async function scoreOpportunityBatch(
  items: ScoreInput[],
  siteContext: SiteContext,
): Promise<ScoredItem[]> {
  if (items.length === 0) return [];

  const results: ScoredItem[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await scoreBatch(batch, siteContext);
    results.push(...batchResults);
  }

  return results;
}

async function scoreBatch(
  items: ScoreInput[],
  siteContext: SiteContext,
): Promise<ScoredItem[]> {
  const itemList = items
    .map((item, i) => {
      const content = item.body
        ? `${item.title}\n${item.body.slice(0, 300)}`
        : item.title;
      return `[${i}] (${item.platform} - ${item.sourceContext}) ${content}`;
    })
    .join("\n\n");

  try {
    const scores = await chatCompletionJSON({
      model: MODELS.GEMINI_FLASH,
      messages: [
        {
          role: "system",
          content: `You score content for relevance to a brand.

Brand: ${siteContext.name}
What they do: ${siteContext.description}
Value props: ${siteContext.valueProps.join(", ")}
Target keywords: ${siteContext.keywords.join(", ")}

For each item, determine:
- relevant: true if we could naturally reply mentioning the brand (questions, comparisons, recommendations, complaints, discussions about the problem space)
- relevanceScore: 0.0-1.0 (0.8+ = great fit, 0.5-0.8 = decent, <0.4 = skip)
- postType: "question" | "recommendation" | "comparison" | "discussion" | "showcase" | "complaint" | "other"
- scoreReason: one short sentence explaining why

Be generous - if there's ANY angle to naturally mention the brand, mark it relevant. But skip completely unrelated content.

Return a JSON array with objects containing: index, relevant, relevanceScore, postType, scoreReason`,
        },
        {
          role: "user",
          content: `Score these items:\n\n${itemList}`,
        },
      ],
      temperature: 0.1,
      schema: ScoreBatchSchema,
    });

    return scores.map((score) => {
      const item = items[score.index];
      return {
        externalId: item.externalId,
        relevant: score.relevant && score.relevanceScore >= MIN_SCORE,
        relevanceScore: score.relevanceScore,
        postType: score.postType,
        scoreReason: score.scoreReason,
      };
    });
  } catch (err) {
    console.error("[scorer] Failed to score batch, marking all as low-relevance:", err);
    return items.map((item) => ({
      externalId: item.externalId,
      relevant: false,
      relevanceScore: 0.3,
      postType: "other",
      scoreReason: "Scoring failed",
    }));
  }
}
