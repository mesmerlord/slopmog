import { redis } from "@/server/utils/redis";
import {
  getSubredditPosts,
  searchSubreddit,
  getPostComments,
} from "./client";
import type {
  RedditPost,
  RedditComment,
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

function isQuestionComment(body: string): boolean {
  const lower = body.toLowerCase().trim();
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

function findReplyOpportunity(
  comments: RedditComment[],
  keywords: string[],
): DiscoveredThread["suggestedReplyTarget"] | undefined {
  for (const comment of comments) {
    if (!isQuestionComment(comment.body)) continue;

    const matchedKw = keywords.find((kw) =>
      keywordMatchesText(kw, comment.body),
    );
    if (matchedKw) {
      return {
        commentId: comment.id,
        commentBody: comment.body,
        commentAuthor: comment.author,
        reason: `Comment asks a question relevant to keyword "${matchedKw}"`,
      };
    }

    // Recurse into replies
    if (comment.replies.length > 0) {
      const nested = findReplyOpportunity(comment.replies, keywords);
      if (nested) return nested;
    }
  }

  return undefined;
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

// ─── Main scout function ─────────────────────────────────────

/**
 * Actively polls subreddits for new posts matching campaign keywords.
 * Deduplicates via Redis so the same post is never returned twice.
 */
export async function scoutSubreddits(params: {
  campaignId: string;
  subreddits: string[];
  keywords: string[];
}): Promise<DiscoveredThread[]> {
  const { campaignId, subreddits, keywords } = params;
  const allPosts = new Map<string, { post: RedditPost; keyword: string }>();

  // Fetch recent posts + keyword searches for each subreddit
  for (const sub of subreddits) {
    // Get recent posts
    const recentPosts = await getSubredditPosts(sub, "new");
    for (const post of recentPosts) {
      const matchedKw = keywords.find(
        (kw) =>
          keywordMatchesText(kw, post.title) ||
          keywordMatchesText(kw, post.selftext),
      );
      if (matchedKw && !allPosts.has(post.id)) {
        allPosts.set(post.id, { post, keyword: matchedKw });
      }
    }

    // Search by each keyword within the subreddit
    for (const keyword of keywords) {
      const searchResults = await searchSubreddit(sub, keyword);
      for (const post of searchResults) {
        if (!allPosts.has(post.id)) {
          allPosts.set(post.id, { post, keyword });
        }
      }
    }
  }

  // Dedup against previously seen posts
  const candidatePosts = Array.from(allPosts.values());
  const unseenPosts = await filterSeenPosts(
    campaignId,
    candidatePosts.map((c) => c.post),
  );
  const unseenIds = new Set(unseenPosts.map((p) => p.id));

  // Score and filter
  const threads: DiscoveredThread[] = [];

  for (const candidate of candidatePosts) {
    if (!unseenIds.has(candidate.post.id)) continue;

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

  // For top threads, scan comments for reply opportunities
  const topThreads = threads
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 20);

  for (const thread of topThreads) {
    try {
      const { comments } = await getPostComments(thread.post.url);
      const replyTarget = findReplyOpportunity(comments, keywords);
      if (replyTarget) {
        thread.suggestedReplyTarget = replyTarget;
      }
    } catch (error) {
      // Non-critical: we still return the thread without reply target
      console.error(
        `[reddit/scout] Failed to fetch comments for ${thread.post.id}:`,
        error,
      );
    }
  }

  // Mark all returned posts as seen
  await markPostsSeen(
    campaignId,
    topThreads.map((t) => t.post.id),
  );

  return topThreads;
}
