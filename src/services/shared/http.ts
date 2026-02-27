import { redis } from "@/server/utils/redis";

// ─── Rate Limiter (Redis sliding window) ────────────────────

export interface RateLimitConfig {
  key: string;
  maxRequests: number;
  windowMs: number;
}

export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  resetMs: number;
}> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const redisKey = `ratelimit:${config.key}`;

  // Remove expired entries, add current, count window — all atomic
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zcard(redisKey);
  const results = await pipeline.exec();

  const currentCount = (results?.[1]?.[1] as number) ?? 0;

  if (currentCount >= config.maxRequests) {
    // Find oldest entry to compute reset time
    const oldest = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const resetMs = oldest.length >= 2
      ? Math.max(0, Number(oldest[1]) + config.windowMs - now)
      : config.windowMs;
    return { allowed: false, remaining: 0, resetMs };
  }

  // Add this request
  await redis.zadd(redisKey, now, `${now}:${Math.random()}`);
  await redis.pexpire(redisKey, config.windowMs);

  return {
    allowed: true,
    remaining: config.maxRequests - currentCount - 1,
    resetMs: config.windowMs,
  };
}

// ─── Rate Limit Error ────────────────────────────────────────

export class RateLimitError extends Error {
  resetMs: number;
  constructor(message: string, resetMs: number) {
    super(message);
    this.name = "RateLimitError";
    this.resetMs = resetMs;
  }
}

// ─── Retry Config ───────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

// ─── Fetch with Retry ───────────────────────────────────────

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit & {
    retry?: Partial<RetryConfig>;
    rateLimit?: RateLimitConfig;
  } = {},
): Promise<T> {
  const { retry: retryOpts, rateLimit, ...fetchOpts } = options;
  const config = { ...DEFAULT_RETRY, ...retryOpts };

  if (rateLimit) {
    const maxRateLimitWaits = 3;
    for (let rlAttempt = 0; rlAttempt <= maxRateLimitWaits; rlAttempt++) {
      const check = await checkRateLimit(rateLimit);
      if (check.allowed) break;

      if (rlAttempt === maxRateLimitWaits) {
        throw new RateLimitError(
          `Rate limited on ${rateLimit.key} after ${maxRateLimitWaits} waits`,
          check.resetMs,
        );
      }

      // Add jitter to stagger concurrent waiters and prevent thundering herd
      const jitterMs = Math.floor(Math.random() * 3000);
      const waitMs = check.resetMs + jitterMs;
      console.log(`[http] Rate limited on ${rateLimit.key}, waiting ${Math.round(waitMs / 1000)}s (attempt ${rlAttempt + 1}/${maxRateLimitWaits})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  let lastError: Error | null = null;
  const urlPath = new URL(url).pathname;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[http] Retry ${attempt}/${config.maxRetries} for ${fetchOpts.method ?? "GET"} ${urlPath}`);
      }

      const response = await fetch(url, fetchOpts);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter
          ? Number(retryAfter) * 1000
          : computeBackoff(attempt, config);
        console.log(`[http] 429 on ${urlPath}, retrying in ${Math.round(delayMs / 1000)}s`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[http] ${response.status} ${response.statusText} on ${fetchOpts.method ?? "GET"} ${urlPath}: ${body.slice(0, 200)}`);
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${body}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxRetries) {
        const delayMs = computeBackoff(attempt, config);
        console.log(`[http] Error on ${urlPath}, retrying in ${Math.round(delayMs / 1000)}s: ${lastError.message.slice(0, 100)}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(`[http] All retries exhausted for ${fetchOpts.method ?? "GET"} ${urlPath}: ${lastError?.message}`);
  throw lastError ?? new Error("fetchWithRetry failed");
}

function computeBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = delay * 0.2 * Math.random();
  return Math.min(delay + jitter, config.maxDelayMs);
}
