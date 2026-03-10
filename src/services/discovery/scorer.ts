import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import { pMap } from "@/services/shared/parallel";

export interface ScoreInput {
  externalId: string;
  title: string;
  body?: string;
  sourceContext: string;
  platform: "REDDIT" | "YOUTUBE" | "TWITTER";
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

const TriageSchema = z.array(z.number().int().min(0));

const BATCH_SIZE = 20;
const SCORE_BATCH_CONCURRENCY = 3;
const MIN_SCORE = 0.75;

/**
 * Fast title-only triage: reorders items so most promising ones are scored first.
 * Does NOT filter — returns all items in a better order.
 * Skips if ≤5 items (not worth the call). Graceful degradation on failure.
 */
export async function triageByTitle(
  items: ScoreInput[],
  siteContext: SiteContext,
): Promise<ScoreInput[]> {
  if (items.length <= 5) return items;

  try {
    const titleList = items.map((item, i) => `[${i}] ${item.title}`).join("\n");

    const ranked = await chatCompletionJSON({
      model: MODELS.GEMINI_FLASH,
      messages: [
        {
          role: "system",
          content: `You rank content titles by relevance to a brand. Return a JSON array of indices sorted from most to least relevant.

Brand: ${siteContext.name}
What they do: ${siteContext.description}
Keywords: ${siteContext.keywords.join(", ")}

Return ALL indices — just reorder them. Most relevant first.`,
        },
        {
          role: "user",
          content: `Rank these by relevance:\n\n${titleList}`,
        },
      ],
      temperature: 0,
      schema: TriageSchema,
    });

    // Rebuild items in ranked order, appending any missing indices at the end
    const seen = new Set<number>();
    const reordered: ScoreInput[] = [];
    for (const idx of ranked) {
      if (idx >= 0 && idx < items.length && !seen.has(idx)) {
        seen.add(idx);
        reordered.push(items[idx]);
      }
    }
    for (let i = 0; i < items.length; i++) {
      if (!seen.has(i)) reordered.push(items[i]);
    }
    return reordered;
  } catch (err) {
    console.error("[scorer] triageByTitle failed, using original order:", err);
    return items;
  }
}

export async function scoreOpportunityBatch(
  items: ScoreInput[],
  siteContext: SiteContext,
): Promise<ScoredItem[]> {
  if (items.length === 0) return [];

  const batches: ScoreInput[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  const scoredBatches = await pMap(
    batches,
    (batch) => scoreBatch(batch, siteContext),
    SCORE_BATCH_CONCURRENCY,
  );

  return scoredBatches.flat();
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
          content: `You score content for relevance to a brand. Your job is to find threads where mentioning the brand would feel NATURAL and HELPFUL — not forced or spammy.

Brand: ${siteContext.name}
What they do: ${siteContext.description}
Value props: ${siteContext.valueProps.join(", ")}
Target keywords: ${siteContext.keywords.join(", ")}

For each item, determine:
- relevant: true ONLY if a reply mentioning the brand would genuinely help the poster or readers. The post must be about the brand's problem space, not just tangentially related.
- relevanceScore: 0.0-1.0
  - 0.9+ = perfect fit — poster is explicitly asking for or comparing solutions the brand provides
  - 0.75-0.9 = strong fit — discussion is directly about the problem space, brand mention would be natural
  - 0.5-0.75 = weak fit — loosely related topic, brand mention would feel forced
  - <0.5 = not relevant — different domain, meta discussion, memes, or off-topic
- postType: "question" | "recommendation" | "comparison" | "discussion" | "showcase" | "complaint" | "other"
- scoreReason: one short sentence explaining why

SCORE LOW (mark irrelevant) for:
- Generic industry news/announcements with no discussion angle
- Memes, jokes, or meta posts about the subreddit itself
- Posts where the topic only shares a keyword but is about a completely different domain
- Showcase/self-promo posts where commenting would feel like hijacking
- Posts already resolved or with accepted answers

SCORE HIGH for:
- "What tool should I use for X?" or "Looking for recommendations"
- "How do I solve [problem the brand solves]?"
- Comparisons between competitors in the brand's space
- Complaints about a competitor's product
- Discussions about workflows/processes the brand improves

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
