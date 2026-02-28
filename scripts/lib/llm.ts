import { requireEnv } from "./env";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function getHeaders() {
  return {
    Authorization: `Bearer ${requireEnv("OPENROUTER_API_KEY")}`,
    "Content-Type": "application/json",
  };
}

interface ChatOptions {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  webSearch?: boolean;
}

export async function chat(opts: ChatOptions): Promise<string> {
  const { model = "google/gemini-3-flash-preview", messages, temperature = 0.3, webSearch } = opts;

  const body: Record<string, unknown> = { model, messages, temperature };
  if (webSearch) body.plugins = [{ id: "web" }];

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned empty response");
  return content;
}

/** Parse JSON from LLM response, stripping markdown code fences */
export function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const cleaned = match ? match[1].trim() : text.trim();
  return JSON.parse(cleaned);
}

// ─── Batch Tweet Relevance Scoring ──────────────────────────

export interface ScoredTweet {
  id: string;
  relevant: boolean;
  score: number;       // 0-1
  reason: string;
  postType: "question" | "recommendation" | "comparison" | "discussion" | "showcase" | "other";
}

/**
 * Score a batch of tweets for relevance using Gemini Flash.
 * Sends all tweets in one call to minimize latency/cost.
 */
export async function scoreTweetBatch(
  tweets: Array<{ id: string; text: string; author: string }>,
  keywords: string[],
): Promise<ScoredTweet[]> {
  if (tweets.length === 0) return [];

  const tweetList = tweets
    .map((t, i) => `[${i}] @${t.author}: ${t.text.slice(0, 300)}`)
    .join("\n\n");

  const content = await chat({
    messages: [
      {
        role: "system",
        content: `You score tweets for relevance to a brand that does: ${keywords.join(", ")}.

For each tweet, determine:
- relevant: true if we could naturally reply mentioning our product (questions, comparisons, recommendations, complaints about competitors, showcases of related work)
- score: 0.0-1.0 (0.8+ = great fit, 0.5-0.8 = decent, <0.5 = skip)
- reason: one short sentence why
- postType: "question" | "recommendation" | "comparison" | "discussion" | "showcase" | "other"

Return ONLY a JSON array matching the tweet indices. Be generous - if there's ANY angle to naturally reply, mark it relevant.`,
      },
      {
        role: "user",
        content: `Score these tweets:\n\n${tweetList}`,
      },
    ],
    temperature: 0.1,
  });

  try {
    return parseJSON<ScoredTweet[]>(content).map((s, i) => ({
      ...s,
      id: tweets[i].id,
    }));
  } catch {
    console.error("[llm] Failed to parse tweet scores, marking all as relevant");
    return tweets.map((t) => ({
      id: t.id,
      relevant: true,
      score: 0.5,
      reason: "scoring failed",
      postType: "other" as const,
    }));
  }
}

/**
 * Use web search to find Twitter/X accounts relevant to given keywords.
 * Returns an array of usernames (without @).
 */
export async function findTwitterAccounts(keywords: string[]): Promise<string[]> {
  const keywordList = keywords.join(", ");

  const content = await chat({
    messages: [
      {
        role: "user",
        content: `Search the web for Twitter/X accounts that frequently post about: ${keywordList}. I need real accounts that exist on X/Twitter. Return ONLY a JSON array of strings containing Twitter usernames (without @). Find 15-20 accounts. Include: tech reviewers, tool comparison accounts, relevant influencers, and brand accounts. Only return accounts you found in actual search results.`,
      },
    ],
    webSearch: true,
    temperature: 0.1,
  });

  return parseJSON<string[]>(content);
}
