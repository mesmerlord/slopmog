import { redis } from "@/server/utils/redis";
import {
  searchReddit,
  searchSubreddit,
} from "./client";
import type {
  RedditPost,
  DiscoveredThread,
} from "./types";

// ─── Constants ───────────────────────────────────────────────

const SEEN_SET_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const RELEVANCE_THRESHOLD = 0.35;

const QUESTION_STARTERS = [
  "how",
  "what",
  "which",
  "best",
  "recommend",
  "looking for",
  "alternative",
];

// ─── Helpers ─────────────────────────────────────────────────

function seenKey(campaignId: string): string {
  return `scout:seen:${campaignId}`;
}

function isQuestionPost(title: string): boolean {
  const lower = title.toLowerCase().trim();
  if (lower.includes("?")) return true;
  return QUESTION_STARTERS.some((starter) => lower.startsWith(starter));
}

function keywordMatchesText(keyword: string, text: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function computeRelevanceScore(
  post: RedditPost,
  keyword: string,
): number {
  let score = 0;
  const now = Date.now() / 1000;
  const ageSeconds = now - post.createdUtc;
  const ageHours = ageSeconds / 3600;

  // Keyword match in title: +0.3
  if (keywordMatchesText(keyword, post.title)) {
    score += 0.3;
  }

  // Keyword match in body: +0.2
  if (keywordMatchesText(keyword, post.selftext)) {
    score += 0.2;
  }

  // Question post: +0.2
  if (isQuestionPost(post.title)) {
    score += 0.2;
  }

  // Recency bonus
  if (ageHours < 1) {
    score += 0.15;
  } else if (ageHours < 6) {
    score += 0.1;
  } else if (ageHours < 24) {
    score += 0.05;
  }

  // Low comment count (<10): +0.1
  if (post.numComments < 10) {
    score += 0.1;
  }

  // Moderate engagement (score 5-100): +0.05
  if (post.score >= 5 && post.score <= 100) {
    score += 0.05;
  }

  // Penalties
  if (post.isArchived) score -= 0.5;
  if (post.isLocked) score -= 0.5;

  // Very old (>7 days)
  if (ageHours > 7 * 24) {
    score -= 0.2;
  }

  // Very high comments (>50)
  if (post.numComments > 50) {
    score -= 0.1;
  }

  return Math.max(0, Math.round(score * 100) / 100);
}

// ─── Dedup ───────────────────────────────────────────────────

async function filterSeenPosts(
  campaignId: string,
  posts: RedditPost[],
): Promise<RedditPost[]> {
  if (posts.length === 0) return [];

  const key = seenKey(campaignId);
  const unseen: RedditPost[] = [];

  for (const post of posts) {
    const alreadySeen = await redis.sismember(key, post.id);
    if (!alreadySeen) {
      unseen.push(post);
    }
  }

  return unseen;
}

async function markPostsSeen(
  campaignId: string,
  postIds: string[],
): Promise<void> {
  if (postIds.length === 0) return;

  const key = seenKey(campaignId);
  await redis.sadd(key, ...postIds);
  await redis.expire(key, SEEN_SET_TTL_SECONDS);
}

// ─── Query builders ──────────────────────────────────────────

function buildCompetitorQueries(competitors: string[]): string[] {
  const queries: string[] = [];
  for (const competitor of competitors) {
    queries.push(`alternative to ${competitor}`);
    queries.push(`${competitor} vs`);
    queries.push(`switch from ${competitor}`);
  }
  return queries;
}

// ─── Collect results ─────────────────────────────────────────

async function collectResults(
  searches: Array<{ searchFn: () => Promise<RedditPost[]>; keyword: string }>,
  allPosts: Map<string, { post: RedditPost; keyword: string }>,
): Promise<void> {
  for (const search of searches) {
    const results = await search.searchFn();
    for (const post of results) {
      if (!allPosts.has(post.id)) {
        allPosts.set(post.id, { post, keyword: search.keyword });
      }
    }
  }
}

// ─── Main mine function ──────────────────────────────────────

/**
 * Performs a one-time deep sweep across Reddit for historical opportunities.
 * Searches using multiple keyword strategies:
 *   - Primary keywords within targeted subreddits
 *   - Problem/long-tail keywords Reddit-wide
 *   - Competitor keywords with "alternative to" / "vs" / "switch from" patterns
 */
export async function mineOpportunities(params: {
  campaignId: string;
  subreddits: string[];
  keywords: string[];
  problemKeywords: string[];
  longTailKeywords: string[];
  competitorKeywords: string[];
}): Promise<DiscoveredThread[]> {
  const {
    campaignId,
    subreddits,
    keywords,
    problemKeywords,
    longTailKeywords,
    competitorKeywords,
  } = params;

  const allPosts = new Map<string, { post: RedditPost; keyword: string }>();

  // 1. Problem keywords — search Reddit-wide
  const problemSearches = problemKeywords.map((kw) => ({
    searchFn: () => searchReddit(kw),
    keyword: kw,
  }));
  await collectResults(problemSearches, allPosts);

  // 2. Long-tail keywords — search Reddit-wide
  const longTailSearches = longTailKeywords.map((kw) => ({
    searchFn: () => searchReddit(kw),
    keyword: kw,
  }));
  await collectResults(longTailSearches, allPosts);

  // 3. Competitor keywords — search Reddit-wide with variant queries
  const competitorQueries = buildCompetitorQueries(competitorKeywords);
  const competitorSearches = competitorQueries.map((query) => {
    // Find the original competitor keyword for this query
    const matchedCompetitor =
      competitorKeywords.find((ck) =>
        query.toLowerCase().includes(ck.toLowerCase()),
      ) ?? query;

    return {
      searchFn: () => searchReddit(query),
      keyword: matchedCompetitor,
    };
  });
  await collectResults(competitorSearches, allPosts);

  // 4. Primary keywords — search within each targeted subreddit
  const subredditSearches: Array<{
    searchFn: () => Promise<RedditPost[]>;
    keyword: string;
  }> = [];
  for (const sub of subreddits) {
    for (const kw of keywords) {
      subredditSearches.push({
        searchFn: () => searchSubreddit(sub, kw),
        keyword: kw,
      });
    }
  }
  await collectResults(subredditSearches, allPosts);

  // Dedup against previously seen posts
  const candidatePosts = Array.from(allPosts.values());
  const unseenPosts = await filterSeenPosts(
    campaignId,
    candidatePosts.map((c) => c.post),
  );
  const unseenIds = new Set(unseenPosts.map((p) => p.id));

  // Score, filter out archived/locked, and apply threshold
  const threads: DiscoveredThread[] = [];

  for (const candidate of candidatePosts) {
    if (!unseenIds.has(candidate.post.id)) continue;
    if (candidate.post.isArchived || candidate.post.isLocked) continue;

    const relevanceScore = computeRelevanceScore(
      candidate.post,
      candidate.keyword,
    );
    if (relevanceScore < RELEVANCE_THRESHOLD) continue;

    threads.push({
      post: candidate.post,
      matchedKeyword: candidate.keyword,
      relevanceScore,
    });
  }

  // Sort by relevance descending
  threads.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Mark all returned posts as seen
  await markPostsSeen(
    campaignId,
    threads.map((t) => t.post.id),
  );

  return threads;
}
