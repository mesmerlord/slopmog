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
