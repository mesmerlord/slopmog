import { z } from "zod";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean; // Appends :online suffix for web-grounded models
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
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

function resolveModel(model: string, webSearch?: boolean): string {
  return webSearch ? `${model}:online` : model;
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<string> {
  const { model, messages, temperature = 0.7, maxTokens, webSearch } = options;

  const body: Record<string, unknown> = {
    model: resolveModel(model, webSearch),
    messages,
    temperature,
  };
  if (maxTokens) body.max_tokens = maxTokens;

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

// ─── Model Constants ────────────────────────────────────────

export const MODELS = {
  GEMINI_FLASH: "google/gemini-3-flash-preview",
  CLAUDE_OPUS: "anthropic/claude-opus-4-6",
} as const;
