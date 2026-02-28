/**
 * Twitter Discovery Script
 *
 * Searches for relevant Twitter accounts via web search, then pulls their
 * tweets via ScrapeCreators and filters for keyword relevance.
 *
 * Usage:
 *   npx tsx scripts/twitter-discover.ts "best ai photo enhancer" "photo restoration tools"
 *   npx tsx scripts/twitter-discover.ts --file keywords.txt
 *   npx tsx scripts/twitter-discover.ts --accounts @user1 @user2   # skip account discovery
 */

import "./lib/env";
import fs from "fs";
import path from "path";
import { getUserTweets, getTwitterProfile, type Tweet } from "./lib/scrape-creators";
import { findTwitterAccounts, scoreTweetBatch } from "./lib/llm";

// ─── Config ─────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "twitter-opportunities.json");
const ACCOUNTS_CACHE_FILE = path.join(DATA_DIR, "twitter-accounts-cache.json");
const MAX_AGE_DAYS = 14;
const MAX_ACCOUNTS = 15;  // Don't scrape more than this many accounts per run

// ─── Types ──────────────────────────────────────────────────

interface TwitterOpportunity {
  tweetId: string;
  tweetUrl: string;
  text: string;
  author: string;
  authorFollowers: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  matchedKeywords: string[];
  discoveredAt: string;
  status: "discovered" | "posted" | "skipped" | "failed";
}

interface AccountsCache {
  keywords: string[];
  accounts: string[];
  fetchedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

function loadExistingOpportunities(): TwitterOpportunity[] {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      return JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return [];
}

function saveOpportunities(opps: TwitterOpportunity[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(opps, null, 2));
}

function loadAccountsCache(): AccountsCache | null {
  try {
    if (fs.existsSync(ACCOUNTS_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(ACCOUNTS_CACHE_FILE, "utf-8")) as AccountsCache;
      // Cache valid for 7 days
      if (daysSince(cache.fetchedAt) < 7) return cache;
    }
  } catch { /* ignore */ }
  return null;
}

function saveAccountsCache(cache: AccountsCache) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Check for direct account mode (skip web search)
  if (args.includes("--accounts")) {
    const accountArgs = args.slice(args.indexOf("--accounts") + 1);
    const usernames = accountArgs.map((a) => a.replace(/^@/, ""));
    await discoverFromAccounts(usernames, []);
    return;
  }

  // Parse keywords
  let keywords: string[] = [];

  if (args.includes("--file")) {
    const filePath = args[args.indexOf("--file") + 1];
    if (!filePath) { console.error("Usage: --file <path>"); process.exit(1); }
    keywords = fs.readFileSync(filePath, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean);
  } else if (args.length > 0) {
    keywords = args;
  } else {
    keywords = [
      "ai photo enhancer",
      "photo restoration tool",
      "ai image upscaler",
    ];
    console.log("No keywords provided, using defaults:", keywords.join(", "));
  }

  // Step 1: Find relevant Twitter accounts (cached)
  console.log(`\n🔍 Finding Twitter accounts for: ${keywords.join(", ")}\n`);

  let accounts: string[];
  const cache = loadAccountsCache();

  if (cache && JSON.stringify(cache.keywords.sort()) === JSON.stringify(keywords.sort())) {
    console.log(`Using cached accounts (${cache.accounts.length} accounts, cached ${cache.fetchedAt})`);
    accounts = cache.accounts;
  } else {
    console.log("Searching web for relevant accounts...");
    accounts = await findTwitterAccounts(keywords);
    console.log(`Found ${accounts.length} accounts: ${accounts.map((a) => `@${a}`).join(", ")}`);
    saveAccountsCache({ keywords, accounts, fetchedAt: new Date().toISOString() });
  }

  // Step 2: Get tweets from those accounts
  await discoverFromAccounts(accounts.slice(0, MAX_ACCOUNTS), keywords);
}

async function discoverFromAccounts(usernames: string[], keywords: string[]) {
  console.log(`\n📡 Scanning ${usernames.length} Twitter accounts...\n`);

  const existing = loadExistingOpportunities();
  const seenIds = new Set(existing.map((o) => o.tweetId));
  const newOpps: TwitterOpportunity[] = [];

  // Step 1: Fetch all profiles + tweets concurrently (batches of 5)
  interface AccountData {
    username: string;
    followerCount: number;
    tweets: Tweet[];
  }

  const accountsData: AccountData[] = [];

  for (let i = 0; i < usernames.length; i += 5) {
    const batch = usernames.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (username) => {
        const profile = await getTwitterProfile(username);
        if (!profile) return null;
        const tweets = await getUserTweets(username);
        return { username, followerCount: profile.followersCount, tweets };
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        accountsData.push(r.value);
        console.log(`  @${r.value.username}: ${r.value.followerCount.toLocaleString()} followers, ${r.value.tweets.length} tweets`);
      }
    }
  }

  // Step 2: Collect all unseen tweets across all accounts
  const allCandidates: Array<{ tweet: Tweet; username: string; followerCount: number }> = [];

  for (const account of accountsData) {
    for (const tweet of account.tweets) {
      if (seenIds.has(tweet.id)) continue;
      if (daysSince(tweet.createdAt) > MAX_AGE_DAYS) continue;
      allCandidates.push({ tweet, username: account.username, followerCount: account.followerCount });
    }
  }

  console.log(`\n  ${allCandidates.length} candidate tweets to score`);

  if (allCandidates.length === 0) {
    console.log("  No new tweets to score");
  } else {
    // Step 3: Score all tweets with Gemini Flash concurrently (batches of 20)
    console.log("  Scoring with Gemini Flash...");

    const BATCH_SIZE = 20;
    const scoringPromises: Promise<void>[] = [];

    for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
      const batch = allCandidates.slice(i, i + BATCH_SIZE);
      const batchInput = batch.map((c) => ({
        id: c.tweet.id,
        text: c.tweet.text,
        author: c.tweet.author || c.username,
      }));

      scoringPromises.push(
        scoreTweetBatch(batchInput, keywords).then((scores) => {
          for (const score of scores) {
            if (!score.relevant || score.score < 0.4) continue;

            const candidate = batch.find((c) => c.tweet.id === score.id);
            if (!candidate) continue;

            const { tweet, username, followerCount } = candidate;

            newOpps.push({
              tweetId: tweet.id,
              tweetUrl: tweet.url,
              text: tweet.text,
              author: tweet.author || username,
              authorFollowers: followerCount,
              likeCount: tweet.likeCount,
              retweetCount: tweet.retweetCount,
              replyCount: tweet.replyCount,
              viewCount: tweet.viewCount,
              createdAt: tweet.createdAt,
              matchedKeywords: [score.postType, `score:${score.score}`],
              discoveredAt: new Date().toISOString(),
              status: "discovered",
            });

            seenIds.add(tweet.id);

            console.log(`  [${score.score.toFixed(1)}] @${tweet.author || username}: ${tweet.text.slice(0, 70).replace(/\n/g, " ")}`);
            console.log(`        ${score.reason}`);
          }
        }),
      );
    }

    await Promise.all(scoringPromises);
  }

  // Save
  const allOpps = [...existing, ...newOpps];
  saveOpportunities(allOpps);

  // Summary
  const actionable = allOpps.filter((o) => o.status === "discovered");
  console.log("\n" + "=".repeat(60));
  console.log("TWITTER DISCOVERY SUMMARY");
  console.log("=".repeat(60));
  console.log(`  New opportunities found:  ${newOpps.length}`);
  console.log(`  Total actionable:         ${actionable.length}`);
  console.log(`  Previously discovered:    ${existing.length}`);
  console.log(`  Saved to: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  if (actionable.length > 0) {
    console.log("\nTop opportunities (by views):");
    actionable
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10)
      .forEach((o, i) => {
        console.log(`  ${i + 1}. [${o.viewCount.toLocaleString()} views] @${o.author}: ${o.text.slice(0, 70).replace(/\n/g, " ")}`);
        console.log(`     ${o.tweetUrl}`);
      });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
