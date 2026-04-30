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

interface NativeWebSearchOptions {
  search_context_size: "low" | "medium" | "high";
}

interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean | WebSearchPlugin;
  webSearchOptions?: NativeWebSearchOptions;
}

interface UrlCitationAnnotation {
  type: "url_citation";
  url_citation: {
    url: string;
    title?: string;
    content?: string;
    start_index?: number;
    end_index?: number;
  };
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
  const {
    model,
    messages,
    temperature = 0.7,
    maxTokens,
    webSearch,
    webSearchOptions,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  if (webSearchOptions) {
    body.web_search_options = webSearchOptions;
    body.plugins = [{ id: "web", max_results: 20 }];
  } else if (webSearch) {
    const plugin: WebSearchPlugin =
      typeof webSearch === "object" ? webSearch : { id: "web" };
    body.plugins = [plugin];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
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
      const errMsg = error instanceof Error ? error.message : String(error);
      // Don't retry on 4xx client errors (except 429 rate limit)
      const is4xx = /OpenRouter 4\d\d/.test(errMsg) && !/OpenRouter 429/.test(errMsg);
      if (is4xx) {
        throw new Error(`OpenRouter client error (not retryable): ${errMsg}`);
      }
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(
        `Failed to get valid JSON after ${maxRetries} attempts: ${errMsg}`,
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
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

function deduplicateCitationUrls(
  citations: ParsedCitationUrl[],
): ParsedCitationUrl[] {
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
  const {
    model,
    messages,
    temperature = 0.7,
    maxTokens,
    webSearch,
    webSearchOptions,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  if (webSearchOptions) {
    body.web_search_options = webSearchOptions;
    body.plugins = [{ id: "web", max_results: 20 }];
  } else if (webSearch) {
    const plugin: WebSearchPlugin =
      typeof webSearch === "object" ? webSearch : { id: "web" };
    body.plugins = [plugin];
  }

  console.log(
    `[openrouter-request] model=${body.model} | has_web_search_options=${!!body.web_search_options} | has_plugins=${!!body.plugins} | body_keys=${Object.keys(body).join(",")}`,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter ${response.status}: ${response.statusText} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const msg = data.choices?.[0]?.message;
  const content = msg?.content ?? "";

  // Log raw response shape for debugging
  console.log(
    `[openrouter-citations] model=${model} | annotations=${msg?.annotations?.length ?? "undefined"} | content_length=${content.length} | keys=${Object.keys(msg ?? {}).join(",")}`,
  );
  if (msg && !msg.annotations?.length) {
    // Log the raw message keys to see if citations come under a different field
    const rawMsg = msg as Record<string, unknown>;
    const extraKeys = Object.keys(rawMsg).filter(
      (k) => !["role", "content", "annotations"].includes(k),
    );
    if (extraKeys.length) {
      console.log(
        `[openrouter-citations] Extra message fields: ${extraKeys.map((k) => `${k}=${JSON.stringify(rawMsg[k])?.slice(0, 200)}`).join(" | ")}`,
      );
    }
  }

  // Extract citations from annotations only (OpenRouter web search — deterministic, real URLs)
  const annotationCitations: ParsedCitationUrl[] = (msg?.annotations ?? [])
    .filter(
      (a): a is UrlCitationAnnotation =>
        a.type === "url_citation" && !!a.url_citation?.url,
    )
    .map((a) => ({ url: a.url_citation.url, title: a.url_citation.title }));

  const citations = deduplicateCitationUrls(annotationCitations);

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
  CLAUDE_OPUS: "anthropic/claude-opus-4.7",
  CLAUDE_SONNET: "anthropic/claude-sonnet-4-6",
  CLAUDE_HAIKU: "anthropic/claude-haiku-4-5-20251001",
} as const;

export const HV_ONLINE_MODELS = {
  GEMINI_ONLINE: "google/gemini-3.1-pro-preview",
  GEMINI_FAST: "google/gemini-3-flash-preview",
  CLAUDE_ONLINE: "anthropic/claude-sonnet-4-6",
  CLAUDE_FAST: "anthropic/claude-haiku-4.5",
  GPT_ONLINE: "openai/gpt-5.3-chat",
  GPT_FAST: "openai/gpt-5-mini",
  GROK_ONLINE: "x-ai/grok-4.1-fast",
} as const;

/** Which models to actually use for HV citation search */
export const HV_ACTIVE_MODELS = [
  HV_ONLINE_MODELS.GEMINI_FAST,
  HV_ONLINE_MODELS.CLAUDE_FAST,
  HV_ONLINE_MODELS.GPT_FAST,
  HV_ONLINE_MODELS.GROK_ONLINE,
] as const;

/** Native web search config for HV citation search — high context for max citations */
export const HV_WEB_SEARCH_OPTIONS: NativeWebSearchOptions = {
  search_context_size: "high",
};

export const HV_MODEL_LABELS: Record<string, string> = {
  [HV_ONLINE_MODELS.GEMINI_ONLINE]: "gemini",
  [HV_ONLINE_MODELS.GEMINI_FAST]: "gemini-flash",
  [HV_ONLINE_MODELS.CLAUDE_ONLINE]: "claude",
  [HV_ONLINE_MODELS.CLAUDE_FAST]: "claude-haiku",
  [HV_ONLINE_MODELS.GPT_ONLINE]: "gpt",
  [HV_ONLINE_MODELS.GPT_FAST]: "gpt-mini",
  [HV_ONLINE_MODELS.GROK_ONLINE]: "grok",
};
