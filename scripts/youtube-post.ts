/**
 * YouTube Comment Posting Script
 *
 * Posts comments on discovered YouTube opportunities via SocialPlug.
 *
 * Usage:
 *   npx tsx scripts/youtube-post.ts                          # Post to all discovered opportunities
 *   npx tsx scripts/youtube-post.ts --dry-run                # Preview without posting
 *   npx tsx scripts/youtube-post.ts --url <video-url>        # Post to a specific video
 *   npx tsx scripts/youtube-post.ts --comments comments.md   # Use specific comments file
 *   npx tsx scripts/youtube-post.ts --limit 3                # Only post to N videos
 */

import "./lib/env";
import fs from "fs";
import path from "path";
import { submitYouTubeComments } from "./lib/socialplug";

// ─── Config ─────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "data");
const OPPORTUNITIES_FILE = path.join(DATA_DIR, "youtube-opportunities.json");
const DEFAULT_COMMENTS_FILE = path.resolve(__dirname, "../comments.md");
const COMMENTS_PER_VIDEO = 5;  // SocialPlug "5 Comments" tier
const DELAY_BETWEEN_ORDERS_MS = 10_000;  // 10s between orders

// ─── Types ──────────────────────────────────────────────────

interface YouTubeOpportunity {
  videoId: string;
  videoUrl: string;
  title: string;
  channelName: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  matchedKeyword: string;
  discoveredAt: string;
  status: "discovered" | "posted" | "skipped" | "failed";
  existingBrandMention: boolean;
  postedAt?: string;
  postError?: string;
}

// ─── Helpers ────────────────────────────────────────────────

function loadOpportunities(): YouTubeOpportunity[] {
  if (!fs.existsSync(OPPORTUNITIES_FILE)) {
    console.error(`No opportunities file found at ${OPPORTUNITIES_FILE}`);
    console.error("Run youtube-discover.ts first.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(OPPORTUNITIES_FILE, "utf-8"));
}

function saveOpportunities(opps: YouTubeOpportunity[]) {
  fs.writeFileSync(OPPORTUNITIES_FILE, JSON.stringify(opps, null, 2));
}

function loadComments(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    console.error(`Comments file not found: ${filePath}`);
    process.exit(1);
  }

  return fs.readFileSync(filePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/**
 * Pick N random comments from the pool, shuffled.
 * This avoids posting the exact same set every time.
 */
function pickComments(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const specificUrl = args.includes("--url") ? args[args.indexOf("--url") + 1] : null;
  const commentsFile = args.includes("--comments")
    ? path.resolve(args[args.indexOf("--comments") + 1])
    : DEFAULT_COMMENTS_FILE;
  const limit = args.includes("--limit")
    ? parseInt(args[args.indexOf("--limit") + 1], 10)
    : Infinity;

  // Load comments
  const allComments = loadComments(commentsFile);
  console.log(`Loaded ${allComments.length} comments from ${commentsFile}`);

  if (allComments.length < COMMENTS_PER_VIDEO) {
    console.error(`Need at least ${COMMENTS_PER_VIDEO} comments, got ${allComments.length}`);
    process.exit(1);
  }

  // Get targets
  let targets: YouTubeOpportunity[];
  let allOpps: YouTubeOpportunity[];

  if (specificUrl) {
    // Post to a specific URL (doesn't need to be in opportunities file)
    allOpps = [];
    targets = [{
      videoId: specificUrl.match(/[?&]v=([^&]+)/)?.[1] ?? "unknown",
      videoUrl: specificUrl,
      title: "(manual)",
      channelName: "",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      publishedAt: "",
      matchedKeyword: "manual",
      discoveredAt: new Date().toISOString(),
      status: "discovered",
      existingBrandMention: false,
    }];
  } else {
    allOpps = loadOpportunities();
    targets = allOpps
      .filter((o) => o.status === "discovered")
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);
  }

  if (targets.length === 0) {
    console.log("No actionable opportunities found. Run youtube-discover.ts first.");
    return;
  }

  console.log(`\n${dryRun ? "🔍 DRY RUN - " : ""}Posting to ${targets.length} YouTube videos\n`);

  let posted = 0;
  let failed = 0;

  for (const target of targets) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Video: ${target.title.slice(0, 70)}`);
    console.log(`URL:   ${target.videoUrl}`);
    console.log(`Views: ${target.viewCount.toLocaleString()}`);

    const selectedComments = pickComments(allComments, COMMENTS_PER_VIDEO);
    console.log(`\nComments to post (${selectedComments.length}):`);
    selectedComments.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.slice(0, 100)}${c.length > 100 ? "..." : ""}`);
    });

    if (dryRun) {
      console.log("\n  [dry-run] Would submit order here");
      continue;
    }

    try {
      const result = await submitYouTubeComments({
        videoUrl: target.videoUrl,
        comments: selectedComments,
      });

      if (result.success) {
        console.log(`\n  [success] ${result.message}`);
        target.status = "posted";
        target.postedAt = new Date().toISOString();
        posted++;
      } else {
        console.error(`\n  [failed] ${result.error}`);
        target.status = "failed";
        target.postError = result.error;
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  [error] ${msg}`);
      target.status = "failed";
      target.postError = msg;
      failed++;
    }

    // Save after each post so progress isn't lost
    if (allOpps.length > 0) {
      saveOpportunities(allOpps);
    }

    // Delay between orders
    if (targets.indexOf(target) < targets.length - 1) {
      console.log(`\n  Waiting ${DELAY_BETWEEN_ORDERS_MS / 1000}s before next order...`);
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_ORDERS_MS));
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("POSTING SUMMARY");
  console.log("═".repeat(60));
  if (dryRun) {
    console.log(`  Mode: DRY RUN (no orders submitted)`);
    console.log(`  Would have posted to: ${targets.length} videos`);
  } else {
    console.log(`  Posted:  ${posted}`);
    console.log(`  Failed:  ${failed}`);
  }
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
