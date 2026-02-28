import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import { cacheGet, cacheSet } from "@/services/shared/cache";

const CACHE_TTL = 24 * 60 * 60; // 24 hours

const SiteAnalysisSchema = z.object({
  name: z.string(),
  description: z.string(),
  valueProps: z.array(z.string()).min(1).max(8),
  keywords: z.array(z.string()).min(3).max(15),
  brandTone: z.enum(["professional", "casual", "technical", "fun"]),
});

export type SiteAnalysisResult = z.infer<typeof SiteAnalysisSchema>;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function analyzeSite(url: string): Promise<SiteAnalysisResult> {
  const cacheKey = `site-analysis:${url}`;
  const cached = cacheGet<SiteAnalysisResult>(cacheKey);
  if (cached) {
    console.log(`[site-analyzer] Cache hit for ${url}`);
    return cached;
  }

  console.log(`[site-analyzer] Analyzing ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SlopMog/1.0)" },
    });
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const text = stripHtml(html).slice(0, 8000);

  const result = await chatCompletionJSON({
    model: MODELS.GEMINI_FLASH,
    messages: [
      {
        role: "system",
        content: `You analyze websites to extract brand information for marketing purposes. Return JSON only.`,
      },
      {
        role: "user",
        content: `Analyze this website content and extract:
- name: the business/product name
- description: 2-3 sentence summary of what the business does
- valueProps: 3-5 key value propositions (what makes them unique/good)
- keywords: 8-12 problem-space search terms people would use when they need this product (NOT brand names, but problems/topics like "best email marketing tool", "how to automate social media"). These should be terms someone would search on Reddit or YouTube when they have the problem this product solves.
- brandTone: one of "professional", "casual", "technical", "fun"

URL: ${url}

Website content:
${text}`,
      },
    ],
    temperature: 0.3,
    schema: SiteAnalysisSchema,
  });

  cacheSet(cacheKey, result, CACHE_TTL);
  console.log(`[site-analyzer] Analysis complete for ${url}: ${result.name}`);
  return result;
}
