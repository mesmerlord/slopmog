import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import { redis } from "@/server/utils/redis";
import { siteAnalysisSchema, type SiteAnalysisResult } from "./types";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Strip trailing slash, www prefix, and query params for cache key
    return parsed.origin.replace("www.", "") + parsed.pathname.replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function getCacheKey(url: string): string {
  return `site-analysis:${normalizeUrl(url)}`;
}

export async function analyzeSite(url: string): Promise<SiteAnalysisResult> {
  // Check cache
  const cacheKey = getCacheKey(url);
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return siteAnalysisSchema.parse(JSON.parse(cached));
    } catch {
      // Cache corrupted, proceed with fresh analysis
    }
  }

  const result = await chatCompletionJSON({
    model: MODELS.GEMINI_FLASH,
    webSearch: true,
    temperature: 0.3,
    schema: siteAnalysisSchema,
    messages: [
      {
        role: "system",
        content: `You are a marketing analyst specializing in Reddit marketing strategy. Analyze websites to extract actionable data for Reddit comment campaigns.

Your analysis will be used to:
1. Understand what the business does and who it serves
2. Generate keywords that people searching for this type of solution would use on Reddit
3. Identify subreddits where potential customers hang out
4. Determine the right tone for comments

Be specific and practical. Keywords should be things real people would type in Reddit searches or post titles.`,
      },
      {
        role: "user",
        content: `Analyze this website and return a JSON object with the following structure:

URL: ${url}

Return JSON with these fields:
- businessName: The company/product name
- description: 2-3 sentence description of what they do and for whom
- valueProps: Array of 3-5 key value propositions (short phrases)
- targetAudience: Who the ideal customer is (one sentence)
- keyFeatures: Array of main product features
- pricingModel: Brief pricing description (e.g. "Freemium, paid plans from $X/mo") or null if unknown
- primaryKeywords: 5-8 keywords directly related to the product category (e.g. "project management tool", "time tracking app")
- problemKeywords: 5-8 keywords describing problems the product solves (e.g. "team communication issues", "tracking billable hours")
- competitorKeywords: 3-5 competitor or alternative product names people might search for
- longTailKeywords: 5-8 longer search phrases people might post about (e.g. "best tool for managing remote team tasks", "how to track time across multiple projects")
- suggestedSubreddits: 5-10 relevant subreddits with:
  - name: subreddit name without "r/" prefix
  - reason: why this subreddit is relevant
  - memberCount: approximate member count if known (or omit)
  - expectedTone: the typical tone in this subreddit ("professional", "casual", "technical", "meme-heavy")
- brandTone: The recommended tone for Reddit comments about this brand ("professional", "casual", "technical", or "friendly")

Return ONLY valid JSON, no markdown or explanation.`,
      },
    ],
  });

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));

  return result;
}
