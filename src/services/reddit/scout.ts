import { redis } from "@/server/utils/redis";
import {
  searchReddit,
  getRecentSubredditPosts,
  getPostComments,
} from "./client";
import { pMap } from "@/services/shared/parallel";
import type {
  RedditPost,
  RedditComment,
  DiscoveredThread,
} from "./types";

// ─── Constants ───────────────────────────────────────────────

const SEEN_SET_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const API_CONCURRENCY = 5;

const QUESTION_STARTERS = [
  "how", "what", "which", "best", "recommend", "looking for", "alternative",
];

// ─── Helpers ─────────────────────────────────────────────────

const seenKey = (campaignId: string) => `scout:seen:${campaignId}`;

const keywordMatchesText = (keyword: string, text: string) =>
  text.toLowerCase().includes(keyword.toLowerCase());

const isQuestionComment = (body: string) => {
  const lower = body.toLowerCase().trim();
  if (lower.includes("?")) return true;
  return QUESTION_STARTERS.some((s) => lower.startsWith(s));
};

function findReplyOpportunity(
  comments: RedditComment[],
  keywords: string[],
): DiscoveredThread["suggestedReplyTarget"] | undefined {
  for (const comment of comments) {
    if (!isQuestionComment(comment.body)) continue;
    const matchedKw = keywords.find((kw) => keywordMatchesText(kw, comment.body));
    if (matchedKw) {
      return {
        commentId: comment.id,
        commentBody: comment.body,
        commentAuthor: comment.author,
        reason: `Comment asks a question relevant to "${matchedKw}"`,
      };
    }
    if (comment.replies.length > 0) {
      const nested = findReplyOpportunity(comment.replies, keywords);
      if (nested) return nested;
    }
  }
  return undefined;
}

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

// ─── Log helper ─────────────────────────────────────────────

type LogFn = (msg: string) => Promise<void>;
const noop: LogFn = async () => {};

// ─── Main scout function ─────────────────────────────────────

/**
 * Recurring discovery: searches Reddit-wide for keywords (parallel),
 * then monitors target subreddits for recent posts matching keywords.
 * No keyword × subreddit cross-product — subreddits are just for
 * quick monitoring of recent posts.
 */
export async function scoutSubreddits(params: {
  campaignId: string;
  subreddits: string[];
  keywords: string[];
  log?: LogFn;
}): Promise<DiscoveredThread[]> {
  const { campaignId, subreddits, keywords, log = noop } = params;
  const allPosts = new Map<string, { post: RedditPost; keyword: string }>();

  // ── Step 1: Reddit-wide keyword searches (parallel) ──────────
  await log(`Step 1: ${keywords.length} Reddit-wide keyword searches — ${API_CONCURRENCY} parallel`);
  let kwCompleted = 0;

  await pMap(
    keywords,
    async (keyword) => {
      const results = await searchReddit(keyword);
      let added = 0;
      for (const post of results) {
        if (!allPosts.has(post.id)) {
          allPosts.set(post.id, { post, keyword });
          added++;
        }
      }
      kwCompleted++;
      await log(`  [${kwCompleted}/${keywords.length}] "${keyword}" → ${results.length} results, ${added} new`);
    },
    API_CONCURRENCY,
  );

  await log(`Step 1 done: ${allPosts.size} unique posts from keyword searches`);

  // ── Step 2: Subreddit monitoring (parallel) ──────────────────
  // Fetch recent posts from each subreddit, match keywords locally in title
  if (subreddits.length > 0) {
    await log(`Step 2: Monitoring ${subreddits.length} subreddits for recent matches`);
    let subCompleted = 0;

    await pMap(
      subreddits,
      async (sub) => {
        const recentPosts = await getRecentSubredditPosts(sub);
        let matched = 0;
        for (const post of recentPosts) {
          if (allPosts.has(post.id)) continue;
          const matchedKw = keywords.find((kw) => keywordMatchesText(kw, post.title));
          if (matchedKw) {
            allPosts.set(post.id, { post, keyword: matchedKw });
            matched++;
          }
        }
        subCompleted++;
        await log(`  [${subCompleted}/${subreddits.length}] r/${sub} → ${recentPosts.length} recent, ${matched} matched`);
      },
      API_CONCURRENCY,
    );
  }

  await log(`Total: ${allPosts.size} unique posts`);

  // ── Step 3: Dedup ─────────────────────────────────────────────
  const candidatePosts = Array.from(allPosts.values());
  const unseenIds = await filterSeenPosts(
    campaignId,
    candidatePosts.map((c) => c.post),
  );
  await log(`Dedup: ${unseenIds.size} unseen out of ${candidatePosts.length}`);

  const threads: DiscoveredThread[] = [];
  for (const candidate of candidatePosts) {
    if (!unseenIds.has(candidate.post.id)) continue;
    if (candidate.post.isArchived || candidate.post.isLocked) continue;
    threads.push({
      post: candidate.post,
      matchedKeyword: candidate.keyword,
      relevanceScore: 0,
    });
  }

  await log(`${threads.length} unseen threads`);

  // ── Step 4: Parallel comment scanning ─────────────────────────
  const topThreads = threads.slice(0, 20);

  if (topThreads.length > 0) {
    await log(`Step 4: Scanning comments on ${topThreads.length} threads — ${API_CONCURRENCY} parallel`);
    let replyTargetsFound = 0;

    await pMap(
      topThreads,
      async (thread) => {
        try {
          const { comments } = await getPostComments(thread.post.url);
          const replyTarget = findReplyOpportunity(comments, keywords);
          if (replyTarget) {
            thread.suggestedReplyTarget = replyTarget;
            replyTargetsFound++;
          }
        } catch {
          // Silently skip failed comment fetches
        }
      },
      API_CONCURRENCY,
    );

    await log(`Found ${replyTargetsFound} reply targets`);
  }

  // Mark seen
  await markPostsSeen(
    campaignId,
    threads.map((t) => t.post.id),
  );

  await log(`Done: ${threads.length} threads for LLM scoring`);
  return threads;
}
