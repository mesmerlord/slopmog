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

export async function waitForRateLimit(config: RateLimitConfig): Promise<void> {
  const check = await checkRateLimit(config);
  if (!check.allowed) {
    await new Promise((resolve) => setTimeout(resolve, check.resetMs + 100));
    return waitForRateLimit(config);
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
    await waitForRateLimit(rateLimit);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOpts);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter
          ? Number(retryAfter) * 1000
          : computeBackoff(attempt, config);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${body}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxRetries) {
        const delayMs = computeBackoff(attempt, config);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError ?? new Error("fetchWithRetry failed");
}

function computeBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = delay * 0.2 * Math.random();
  return Math.min(delay + jitter, config.maxDelayMs);
}
