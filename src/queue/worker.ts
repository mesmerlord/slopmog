import { config } from "dotenv";

// Load environment variables first, before any other imports
if (process.env.NODE_ENV === "production") {
  config({ path: ".env.production" });
} else {
  config();
}

// Import after environment variables are loaded
import "./campaign.worker";
import "./post-generation.worker";
import "./posting.worker";

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
