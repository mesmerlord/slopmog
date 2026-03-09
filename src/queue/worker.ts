import { config } from "dotenv";

// Load environment variables first, before any other imports
if (process.env.NODE_ENV === "production") {
  config({ path: ".env.production" });
} else {
  config();
}

import "./workers/discovery.worker";
import "./workers/generation.worker";
import "./workers/posting.worker";
import "./workers/hv-discovery.worker";
import "./workers/hv-generation.worker";
import "./workers/hv-posting.worker";
import "./workers/health-check.worker";
import "./workers/cron.worker";

import { cronQueue, healthCheckQueue } from "@/queue/queues";

// Register repeatable job schedulers
const setupSchedulers = async () => {
  await cronQueue.upsertJobScheduler(
    "daily-discovery",
    { pattern: "0 6 * * *" },
    { name: "daily-discovery" },
  );
  await cronQueue.upsertJobScheduler(
    "weekly-hv-discovery",
    { pattern: "0 7 * * 1" },
    { name: "weekly-hv-discovery" },
  );
  await healthCheckQueue.upsertJobScheduler(
    "daily-health-check",
    { pattern: "0 8 * * *" },
    { name: "daily-health-check", data: { scope: "all", pipeline: "both" } },
  );
  console.log("Cron schedulers registered (discovery 6AM, hv Mon 7AM, health-check 8AM UTC)");
};

setupSchedulers().catch((err) =>
  console.error("Failed to setup cron schedulers:", err),
);

console.log("Queue worker started");
console.log("Environment:", process.env.NODE_ENV);
console.log("Redis URL:", process.env.REDIS_URL);
console.log("Database URL:", process.env.DATABASE_URL ? "Set" : "Not Set");

// Keep the process running
process.on("SIGTERM", () => {
  console.log("Shutting down queues...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Shutting down queues...");
  process.exit(0);
});
