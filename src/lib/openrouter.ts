import { z } from "zod";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface WebSearchPlugin {
  id: "web";
  max_results?: number;
  search_prompt?: string;
}

interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean | WebSearchPlugin;
}

interface UrlCitationAnnotation {
  type: "url_citation";
  url: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      annotations?: UrlCitationAnnotation[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://slopmog.com",
    "X-Title": "SlopMog",
  };
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<string> {
  const { model, messages, temperature = 0.7, maxTokens, webSearch } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  if (webSearch) {
    const plugin: WebSearchPlugin =
      typeof webSearch === "object" ? webSearch : { id: "web" };
    body.plugins = [plugin];
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter ${response.status}: ${response.statusText} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned empty response");
  return content;
}

/**
 * Chat completion that parses the response as JSON.
 * Strips markdown code blocks, retries up to 3x with exponential backoff,
 * and validates against a Zod schema.
 */
export async function chatCompletionJSON<T>(
  options: ChatCompletionOptions & { schema: z.ZodType<T> },
): Promise<T> {
  const { schema, ...completionOpts } = options;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const raw = await chatCompletion(completionOpts);
      const cleaned = stripMarkdownCodeBlocks(raw);
      const parsed = JSON.parse(cleaned);
      return schema.parse(parsed);
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(
        `Failed to get valid JSON after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Unreachable but satisfies TS
  throw new Error("chatCompletionJSON failed");
}

function stripMarkdownCodeBlocks(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return match ? match[1].trim() : text.trim();
}

// ─── Citation-aware completion ──────────────────────────────

export interface ParsedCitationUrl {
  url: string;
  title?: string;
}

export interface ChatCompletionWithCitationsResult {
  content: string;
  citations: ParsedCitationUrl[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

function extractMarkdownLinks(content: string): ParsedCitationUrl[] {
  const regex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  const results: ParsedCitationUrl[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    results.push({ url: match[2], title: match[1] || undefined });
  }
  return results;
}

function deduplicateCitationUrls(citations: ParsedCitationUrl[]): ParsedCitationUrl[] {
  const seen = new Map<string, ParsedCitationUrl>();
  for (const c of citations) {
    const normalized = c.url.replace(/\/+$/, "").toLowerCase();
    if (!seen.has(normalized)) {
      seen.set(normalized, c);
    } else if (c.title && !seen.get(normalized)!.title) {
      seen.set(normalized, c);
    }
  }
  return Array.from(seen.values());
}

export async function chatCompletionWithCitations(
  options: ChatCompletionOptions,
): Promise<ChatCompletionWithCitationsResult> {
  const { model, messages, temperature = 0.7, maxTokens, webSearch } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  if (webSearch) {
    const plugin: WebSearchPlugin =
      typeof webSearch === "object" ? webSearch : { id: "web" };
    body.plugins = [plugin];
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter ${response.status}: ${response.statusText} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const msg = data.choices?.[0]?.message;
  const content = msg?.content ?? "";

  // Extract citations from annotations (OpenRouter standardized format)
  const annotationCitations: ParsedCitationUrl[] = (msg?.annotations ?? [])
    .filter((a): a is UrlCitationAnnotation => a.type === "url_citation" && !!a.url)
    .map((a) => ({ url: a.url, title: a.title }));

  // Also extract markdown links from content as fallback
  const markdownCitations = extractMarkdownLinks(content);

  const citations = deduplicateCitationUrls([...annotationCitations, ...markdownCitations]);

  return {
    content,
    citations,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

// ─── Model Constants ────────────────────────────────────────

export const MODELS = {
  GEMINI_FLASH: "google/gemini-3-flash-preview",
  CLAUDE_OPUS: "anthropic/claude-opus-4-6",
  CLAUDE_SONNET: "anthropic/claude-sonnet-4-6",
  CLAUDE_HAIKU: "anthropic/claude-haiku-4-5-20251001",
} as const;

export const HV_ONLINE_MODELS = {
  GEMINI_ONLINE: "google/gemini-3.1-pro-preview:online",
  CLAUDE_ONLINE: "anthropic/claude-sonnet-4-6:online",
  GPT_ONLINE: "openai/gpt-5.3-chat:online",
  GROK_ONLINE: "x-ai/grok-4.1-fast:online",
} as const;

export const HV_MODEL_LABELS: Record<string, string> = {
  [HV_ONLINE_MODELS.GEMINI_ONLINE]: "gemini",
  [HV_ONLINE_MODELS.CLAUDE_ONLINE]: "claude",
  [HV_ONLINE_MODELS.GPT_ONLINE]: "gpt",
  [HV_ONLINE_MODELS.GROK_ONLINE]: "grok",
};
