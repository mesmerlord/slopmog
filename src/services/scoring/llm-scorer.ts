import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";

const scoringResultSchema = z.object({
  relevance: z.number().min(0).max(1),
  reasoning: z.string(),
  postType: z.enum(["showcase", "question", "discussion"]),
});

type ScoringResult = z.infer<typeof scoringResultSchema>;

interface ScoreInput {
  postTitle: string;
  postBody: string | null;
  subreddit: string;
  matchedKeyword: string;
  businessName: string;
  businessDescription: string;
  valueProps: string[];
}

/**
 * Uses Gemini Flash to score how relevant a Reddit thread is for a business.
 * Returns a 0-1 relevance score and a brief reasoning.
 */
export async function scoreWithLLM(input: ScoreInput): Promise<ScoringResult> {
  const valuePropsStr = input.valueProps.length > 0
    ? `Key value props: ${input.valueProps.join(", ")}`
    : "";

  return chatCompletionJSON({
    model: MODELS.GEMINI_FLASH,
    temperature: 0.1,
    schema: scoringResultSchema,
    messages: [
      {
        role: "system",
        content: `You are a Reddit marketing relevance scorer. Given a Reddit post and a business description, score how relevant this post is for the business to leave a helpful comment on.

Score from 0 to 1:
- 0.8-1.0: Perfect fit — someone is explicitly asking for what this business offers
- 0.6-0.8: Strong fit — the topic is directly related and a mention would feel natural
- 0.4-0.6: Decent fit — related topic but the mention might feel a bit forced
- 0.2-0.4: Weak fit — tangentially related, would likely feel like spam
- 0.0-0.2: Not relevant — unrelated topic

Consider:
1. Is someone in this thread looking for what the business offers?
2. Would mentioning the product feel natural and helpful, not spammy?
3. Is the post actually seeking recommendations or discussing the problem space?
4. Would a real human naturally bring up this product in this conversation?

Also classify the post type:
- "showcase": OP is sharing/launching something they built (e.g. "I built X", "Check out my project", "Just launched X")
- "question": OP is asking a question, seeking recommendations, or requesting help (e.g. "What's the best X?", "How do I Y?", "Looking for Z")
- "discussion": General discussion, news, opinion, or anything else

Return JSON with "relevance" (number 0-1), "reasoning" (1-2 sentence explanation), and "postType" ("showcase", "question", or "discussion").`,
      },
      {
        role: "user",
        content: `Business: ${input.businessName}
Description: ${input.businessDescription}
${valuePropsStr}

Reddit post in r/${input.subreddit}:
Title: ${input.postTitle}
Body: ${input.postBody?.slice(0, 2000) || "(no body text)"}

Matched keyword: "${input.matchedKeyword}"

Score this post's relevance for the business. Return JSON only.`,
      },
    ],
  });
}
