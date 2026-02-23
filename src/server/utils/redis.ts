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

export const redis = new IORedis(getRedisUrl());
