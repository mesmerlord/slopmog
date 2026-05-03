import IORedis from "ioredis";

function getRedisUrl() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return "redis://localhost:6406/0";
}

export const redisConnection = new IORedis(getRedisUrl(), {
  maxRetriesPerRequest: null, // Required for BullMQ
});

redisConnection.on("error", (err) => {
  console.error("[redis] BullMQ connection error:", err.message);
});

export const redis = new IORedis(getRedisUrl());

redis.on("error", (err) => {
  console.error("[redis] Connection error:", err.message);
});

// Admin impersonation helpers
const IMPERSONATION_PREFIX = "impersonate:";
const DEFAULT_IMPERSONATION_TTL = 5 * 60; // 5 minutes in seconds

export interface ImpersonationData {
  targetUserId: string;
  targetUserEmail: string | null;
  targetUserName: string | null;
  startedAt: number;
}

export async function startImpersonation(
  adminUserId: string,
  targetUserId: string,
  targetUserEmail: string | null,
  targetUserName: string | null,
  ttlSeconds: number = DEFAULT_IMPERSONATION_TTL,
): Promise<void> {
  const data: ImpersonationData = {
    targetUserId,
    targetUserEmail,
    targetUserName,
    startedAt: Date.now(),
  };
  await redis.setex(
    `${IMPERSONATION_PREFIX}${adminUserId}`,
    ttlSeconds,
    JSON.stringify(data),
  );
}

export async function stopImpersonation(adminUserId: string): Promise<void> {
  await redis.del(`${IMPERSONATION_PREFIX}${adminUserId}`);
}

export async function getImpersonation(
  adminUserId: string,
): Promise<ImpersonationData | null> {
  try {
    const data = await redis.get(`${IMPERSONATION_PREFIX}${adminUserId}`);
    if (!data) return null;
    return JSON.parse(data) as ImpersonationData;
  } catch {
    return null;
  }
}
