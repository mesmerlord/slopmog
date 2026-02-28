/**
 * YouTube Discovery Script
 *
 * Searches YouTube for videos matching keywords and saves opportunities.
 *
 * Usage:
 *   npx tsx scripts/youtube-discover.ts "best ai photo enhancer" "photo restoration tools 2025"
 *   npx tsx scripts/youtube-discover.ts --file keywords.txt
 */

import "./lib/env";
import fs from "fs";
import path from "path";
import { searchYouTube, getYouTubeComments, type YouTubeVideo } from "./lib/scrape-creators";

// ─── Config ─────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "youtube-opportunities.json");
const MIN_VIEWS = 500;        // Skip videos with very low views
const MAX_AGE_DAYS = 90;      // Skip videos older than this

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
}

// ─── Helpers ────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

function loadExistingOpportunities(): YouTubeOpportunity[] {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return [];
}

function saveOpportunities(opps: YouTubeOpportunity[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(opps, null, 2));
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse keywords from args or file
  let keywords: string[] = [];

  if (args.includes("--file")) {
    const filePath = args[args.indexOf("--file") + 1];
    if (!filePath) {
      console.error("Usage: --file <path-to-keywords.txt>");
      process.exit(1);
    }
    keywords = fs.readFileSync(filePath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } else if (args.length > 0) {
    keywords = args;
  } else {
    // Default keywords for bestphotoai
    keywords = [
      "best ai photo enhancer",
      "ai photo restoration tools",
      "best ai image enhancer 2025",
      "photo restoration ai comparison",
      "top ai photo tools",
    ];
    console.log("No keywords provided, using defaults:", keywords.join(", "));
  }

  console.log(`\n🔍 Searching YouTube for ${keywords.length} keywords...\n`);

  const existing = loadExistingOpportunities();
  const seenIds = new Set(existing.map((o) => o.videoId));
  const newOpps: YouTubeOpportunity[] = [];

  for (const keyword of keywords) {
    console.log(`\n── Keyword: "${keyword}" ──`);

    try {
      const videos = await searchYouTube(keyword);

      for (const video of videos) {
        // Skip if already discovered
        if (seenIds.has(video.videoId)) {
          console.log(`  [skip] Already discovered: ${video.title.slice(0, 60)}`);
          continue;
        }

        // Skip low-view videos
        if (video.viewCount < MIN_VIEWS) {
          console.log(`  [skip] Low views (${video.viewCount}): ${video.title.slice(0, 60)}`);
          continue;
        }

        // Skip old videos
        if (daysSince(video.publishedAt) > MAX_AGE_DAYS) {
          console.log(`  [skip] Too old: ${video.title.slice(0, 60)}`);
          continue;
        }

        // Check for existing brand mentions in comments
        let existingBrandMention = false;
        try {
          const comments = await getYouTubeComments(video.url);
          existingBrandMention = comments.some((c) =>
            c.text.toLowerCase().includes("bestphotoai")
          );
          if (existingBrandMention) {
            console.log(`  [info] Brand already mentioned in comments: ${video.title.slice(0, 60)}`);
          }
        } catch {
          // Comments fetch may fail, that's OK
        }

        const opp: YouTubeOpportunity = {
          videoId: video.videoId,
          videoUrl: video.url,
          title: video.title,
          channelName: video.channelName,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          publishedAt: video.publishedAt,
          matchedKeyword: keyword,
          discoveredAt: new Date().toISOString(),
          status: existingBrandMention ? "skipped" : "discovered",
          existingBrandMention,
        };

        newOpps.push(opp);
        seenIds.add(video.videoId);

        console.log(`  [new] ${video.title.slice(0, 60)}`);
        console.log(`         Views: ${video.viewCount.toLocaleString()} | Comments: ${video.commentCount} | Channel: ${video.channelName}`);
      }
    } catch (err) {
      console.error(`  [error] Search failed for "${keyword}":`, err instanceof Error ? err.message : err);
    }

    // Small delay between searches to be polite
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Merge and save
  const allOpps = [...existing, ...newOpps];
  saveOpportunities(allOpps);

  // Summary
  const actionable = allOpps.filter((o) => o.status === "discovered");
  console.log("\n" + "═".repeat(60));
  console.log("DISCOVERY SUMMARY");
  console.log("═".repeat(60));
  console.log(`  New opportunities found:  ${newOpps.filter((o) => o.status === "discovered").length}`);
  console.log(`  Skipped (brand exists):   ${newOpps.filter((o) => o.status === "skipped").length}`);
  console.log(`  Total actionable:         ${actionable.length}`);
  console.log(`  Previously discovered:    ${existing.length}`);
  console.log(`  Saved to: ${OUTPUT_FILE}`);
  console.log("═".repeat(60));

  if (actionable.length > 0) {
    console.log("\nTop opportunities:");
    actionable
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10)
      .forEach((o, i) => {
        console.log(`  ${i + 1}. [${o.viewCount.toLocaleString()} views] ${o.title.slice(0, 70)}`);
        console.log(`     ${o.videoUrl}`);
      });
    console.log(`\nRun: npx tsx scripts/youtube-post.ts`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
