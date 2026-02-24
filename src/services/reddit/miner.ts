import { redis } from "@/server/utils/redis";
import { searchReddit } from "./client";
import { pMap } from "@/services/shared/parallel";
import type { RedditPost, DiscoveredThread } from "./types";

// ─── Constants ───────────────────────────────────────────────

const SEEN_SET_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const API_CONCURRENCY = 5;

// ─── Helpers ─────────────────────────────────────────────────

const seenKey = (campaignId: string) => `scout:seen:${campaignId}`;

// ─── Batched Redis dedup ─────────────────────────────────────

async function filterSeenPosts(
  campaignId: string,
  posts: RedditPost[],
): Promise<Set<string>> {
  if (posts.length === 0) return new Set();

  const key = seenKey(campaignId);
  const pipeline = redis.pipeline();
  for (const post of posts) {
    pipeline.sismember(key, post.id);
  }
  const results = await pipeline.exec();

  const unseenIds = new Set<string>();
  for (let i = 0; i < posts.length; i++) {
    if (results?.[i]?.[1] === 0) {
      unseenIds.add(posts[i].id);
    }
  }
  return unseenIds;
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

// ─── Log helper ─────────────────────────────────────────────

type LogFn = (msg: string) => Promise<void>;
const noop: LogFn = async () => {};

// ─── Search task type ────────────────────────────────────────

interface SearchTask {
  query: string;
  keyword: string;
  label: string;
}

// ─── Main mine function ──────────────────────────────────────

/**
 * One-time deep sweep: all keywords search Reddit-wide in parallel.
 * No keyword × subreddit cross-product — that's too slow and expensive.
 * Returns unseen, non-archived threads with relevanceScore 0 for LLM scoring.
 */
export async function mineOpportunities(params: {
  campaignId: string;
  subreddits: string[];
  featureKeywords: string[];
  brandKeywords: string[];
  competitorKeywords: string[];
  log?: LogFn;
}): Promise<DiscoveredThread[]> {
  const {
    campaignId,
    featureKeywords,
    brandKeywords,
    competitorKeywords,
    log = noop,
  } = params;

  // Build all search tasks upfront
  const searches: SearchTask[] = [];

  for (const kw of brandKeywords) {
    searches.push({ query: kw, keyword: kw, label: `brand: "${kw}"` });
  }
  for (const kw of featureKeywords) {
    searches.push({ query: kw, keyword: kw, label: `feature: "${kw}"` });
  }
  for (const query of buildCompetitorQueries(competitorKeywords)) {
    const matched = competitorKeywords.find((ck) =>
      query.toLowerCase().includes(ck.toLowerCase()),
    ) ?? query;
    searches.push({ query, keyword: matched, label: `competitor: "${query}"` });
  }

  await log(`Mining: ${searches.length} Reddit-wide searches (${brandKeywords.length} brand, ${featureKeywords.length} feature, ${competitorKeywords.length} competitor) — ${API_CONCURRENCY} parallel`);

  // Run all searches in parallel with concurrency limit
  const allPosts = new Map<string, { post: RedditPost; keyword: string }>();
  let completed = 0;

  await pMap(
    searches,
    async (search) => {
      const results = await searchReddit(search.query);
      let added = 0;
      for (const post of results) {
        if (!allPosts.has(post.id)) {
          allPosts.set(post.id, { post, keyword: search.keyword });
          added++;
        }
      }
      completed++;
      await log(`  [${completed}/${searches.length}] ${search.label} → ${results.length} results, ${added} new`);
    },
    API_CONCURRENCY,
  );

  await log(`All searches done: ${allPosts.size} unique posts`);

  // Batched Redis dedup
  const candidatePosts = Array.from(allPosts.values());
  const unseenIds = await filterSeenPosts(
    campaignId,
    candidatePosts.map((c) => c.post),
  );
  await log(`Dedup: ${unseenIds.size} unseen out of ${candidatePosts.length} total`);

  // Filter archived/locked
  const threads: DiscoveredThread[] = [];
  let archivedCount = 0;

  for (const candidate of candidatePosts) {
    if (!unseenIds.has(candidate.post.id)) continue;
    if (candidate.post.isArchived || candidate.post.isLocked) {
      archivedCount++;
      continue;
    }
    threads.push({
      post: candidate.post,
      matchedKeyword: candidate.keyword,
      relevanceScore: 0,
    });
  }

  if (archivedCount > 0) {
    await log(`Filtered: ${archivedCount} archived/locked removed`);
  }

  await markPostsSeen(
    campaignId,
    threads.map((t) => t.post.id),
  );

  await log(`Done: ${threads.length} threads for LLM scoring`);
  return threads;
}
