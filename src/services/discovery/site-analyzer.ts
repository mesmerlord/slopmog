import { z } from "zod";
import { chatCompletionJSON, MODELS } from "@/lib/openrouter";
import { cacheGet, cacheSet } from "@/services/shared/cache";

const CACHE_TTL = 24 * 60 * 60; // 24 hours

const KeywordConfigSchema = z.object({
  features: z.array(z.string()).min(3).max(10),
  competitors: z.array(z.string()).min(1).max(8),
  brand: z.array(z.string()).min(1).max(3),
  reddit: z.array(z.string()).min(3).max(10),
  youtube: z.array(z.string()).min(3).max(10),
});

const SiteAnalysisSchema = z.object({
  name: z.string(),
  description: z.string(),
  valueProps: z.array(z.string()).min(1).max(8),
  keywordConfig: KeywordConfigSchema,
  brandTone: z.enum(["professional", "casual", "technical", "fun"]),
});

export type KeywordConfig = z.infer<typeof KeywordConfigSchema>;
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
  const cacheKey = `site-analysis-v2:${url}`;
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
        content: `You analyze websites to extract brand information for social media marketing. You need to generate keywords that will find real conversations about topics related to this product. Return JSON only.`,
      },
      {
        role: "user",
        content: `Analyze this website and extract marketing keywords.

URL: ${url}

Website content:
${text}

Return JSON with:
- name: the business/product name
- description: 2-3 sentence summary
- valueProps: 3-5 key value propositions
- brandTone: one of "professional", "casual", "technical", "fun"
- keywordConfig: an object with these 5 categories:

  1. "features" (5-10 keywords): SHORT feature-based keywords that describe what this product does. These are generic category terms, NOT long-tail questions. Examples for an AI photo editor: "ai image generator", "ai photo editor", "background remover", "image upscaler", "photo restoration", "ai headshot generator". Keep them 2-4 words max.

  2. "competitors" (3-8 keywords): Names of direct competitors and well-known alternatives. Use their actual product/brand names. Examples for an AI photo editor: "midjourney", "dall-e", "canva ai", "remove.bg", "topaz photo ai", "runway ml". These let us find posts where people discuss alternatives.

  3. "brand" (1-3 keywords): The product's own name and common variations. This catches mentions of the brand itself. Examples: "bestphoto", "bestphoto.ai", "best photo ai".

  4. "reddit" (5-10 keywords): Reddit-optimized search terms. Reddit users search differently — they use short phrases, category terms, and comparison queries. Examples: "ai photo editor", "best ai image generator", "midjourney alternative", "ai headshot", "remove background ai", "upscale image quality". NO long questions. NO "how to" phrases. Keep it 2-5 words.

  5. "youtube" (5-10 keywords): YouTube-optimized search terms. YouTube searches tend to be slightly more descriptive and action-oriented. Examples: "ai photo editor tutorial", "best ai image generator 2024", "midjourney vs dall-e", "ai headshot generator review", "remove background from photo ai". Can be slightly longer than Reddit keywords but still concise.

IMPORTANT: Do NOT generate long-tail questions like "how to make X without Y" or "best tool for creating Z for beginners". Those are blog SEO keywords, not social media search keywords. Keep everything SHORT and feature-focused.`,
      },
    ],
    temperature: 0.3,
    schema: SiteAnalysisSchema,
  });

  cacheSet(cacheKey, result, CACHE_TTL);
  console.log(`[site-analyzer] Analysis complete for ${url}: ${result.name} (${result.keywordConfig.features.length} features, ${result.keywordConfig.competitors.length} competitors)`);
  return result;
}
