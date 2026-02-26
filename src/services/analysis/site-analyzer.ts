import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import { redis } from "@/server/utils/redis";
import { siteAnalysisSchema, type SiteAnalysisResult } from "./types";

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.origin.replace("www.", "") + parsed.pathname.replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function getCacheKey(url: string): string {
  return `site-analysis:${normalizeUrl(url)}`;
}

/**
 * Fallback: fetch and extract text content from a webpage via simple HTML fetch.
 * Used when web search doesn't return enough useful info.
 */
async function fetchPageContent(url: string): Promise<string | null> {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;

  try {
    const response = await fetch(fullUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "";

    const descMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
      );
    const description = descMatch?.[1]?.trim() || "";

    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 15000) text = text.substring(0, 15000);
    if (text.length < 100) return null;

    let content = "";
    if (title) content += `Page Title: ${title}\n`;
    if (description) content += `Meta Description: ${description}\n`;
    content += `\nPage Content:\n${text}`;
    return content;
  } catch {
    return null;
  }
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

  const fullUrl = url.startsWith("http") ? url : `https://${url}`;

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(fullUrl);
  } catch {
    throw new Error("Invalid URL format. Please enter a valid website address.");
  }

  // Must be http or https
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("URL must start with http:// or https://");
  }

  // Must have a valid-looking hostname (at least one dot, not an IP-only localhost)
  const hostname = parsedUrl.hostname;
  if (!hostname.includes(".") || hostname === "localhost") {
    throw new Error("Please enter a real website URL (e.g. example.com).");
  }

  // Reachability check: make sure the site actually responds before spending LLM credits
  try {
    const probe = await fetch(fullUrl, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!probe.ok && probe.status !== 405) {
      // 405 = Method Not Allowed for HEAD, site exists but doesn't support HEAD — that's fine
      // Try GET as a fallback for servers that reject HEAD
      const getProbe = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!getProbe.ok) {
        throw new Error(`Site returned HTTP ${getProbe.status}`);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP")) throw new Error(`Could not reach ${hostname}: ${msg}`);
    throw new Error(
      `Could not reach ${hostname}. Make sure the website exists and is accessible.`
    );
  }

  const domain = parsedUrl.hostname.replace("www.", "");

  // Try web search first (primary), fall back to HTML fetch if needed
  let fallbackContent: string | null = null;
  let result: SiteAnalysisResult;

  try {
    result = await chatCompletionJSON({
      model: MODELS.GEMINI_FLASH,
      webSearch: {
        id: "web",
        max_results: 5,
        search_prompt: `${domain} website - what does ${domain} do, features, pricing, product information`,
      },
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
Domain: ${domain}

Return JSON with these fields:
- businessName: The EXACT company/product name (pay close attention to spelling — the domain "${domain}" is a strong hint)
- description: 2-3 sentence description of what they do and for whom
- valueProps: Array of 3-5 key value propositions (short phrases)
- targetAudience: Who the ideal customer is (one sentence)
- keyFeatures: Array of main product features
- pricingModel: Brief pricing description (e.g. "Freemium, paid plans from $X/mo") or null if unknown
- primaryKeywords: 5-8 keywords directly related to the product category (e.g. "project management tool", "time tracking app")
- problemKeywords: 5-8 keywords describing problems the product solves (e.g. "team communication issues", "tracking billable hours")
- competitorKeywords: 3-5 competitor or alternative product names people might search for
- brandKeywords: 3-5 brand-related terms — the product name, company name, website domain, common misspellings, and abbreviations people might use when mentioning the brand on Reddit
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
  } catch (e) {
    // Web search failed — fall back to HTML fetch
    console.error(
      `[analyzeSite] Web search failed for ${url}, trying HTML fetch: ${e instanceof Error ? e.message : e}`,
    );

    fallbackContent = await fetchPageContent(url);
    if (!fallbackContent) {
      throw new Error(
        `Could not analyze ${url}: web search and HTML fetch both failed`,
      );
    }

    result = await chatCompletionJSON({
      model: MODELS.GEMINI_FLASH,
      temperature: 0.3,
      schema: siteAnalysisSchema,
      messages: [
        {
          role: "system",
          content: `You are a marketing analyst specializing in Reddit marketing strategy. Analyze the provided website content to extract actionable data for Reddit comment campaigns.

Be specific and practical. Keywords should be things real people would type in Reddit searches or post titles.`,
        },
        {
          role: "user",
          content: `Analyze this website content and return a JSON object.

URL: ${url}
Domain: ${domain}

--- WEBSITE CONTENT ---
${fallbackContent}
--- END CONTENT ---

Return JSON with these fields:
- businessName: The EXACT company/product name as shown in the content above
- description: 2-3 sentence description of what they do and for whom
- valueProps: Array of 3-5 key value propositions (short phrases)
- targetAudience: Who the ideal customer is (one sentence)
- keyFeatures: Array of main product features
- pricingModel: Brief pricing description (e.g. "Freemium, paid plans from $X/mo") or null if unknown
- primaryKeywords: 5-8 keywords directly related to the product category
- problemKeywords: 5-8 keywords describing problems the product solves
- competitorKeywords: 3-5 competitor or alternative product names
- brandKeywords: 3-5 brand-related terms
- longTailKeywords: 5-8 longer search phrases people might post about
- suggestedSubreddits: 5-10 relevant subreddits with:
  - name: subreddit name without "r/" prefix
  - reason: why this subreddit is relevant
  - memberCount: approximate member count if known (or omit)
  - expectedTone: the typical tone in this subreddit ("professional", "casual", "technical", "meme-heavy")
- brandTone: The recommended tone for Reddit comments ("professional", "casual", "technical", or "friendly")

Return ONLY valid JSON, no markdown or explanation.`,
        },
      ],
    });
  }

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));

  return result;
}
