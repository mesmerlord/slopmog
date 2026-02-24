import { fetchWithRetry, type RateLimitConfig } from "@/services/shared/http";
import { cacheGet, cacheSet } from "@/services/shared/cache";
import type { RedditPost, RedditComment, SubredditInfo } from "./types";

// ─── Config ──────────────────────────────────────────────────

const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com/v1";

function getApiKey(): string {
  const key = process.env.SCRAPE_CREATORS_API_KEY;
  if (!key) throw new Error("SCRAPE_CREATORS_API_KEY is not set");
  return key;
}

const RATE_LIMIT: RateLimitConfig = {
  key: "scrapecreators",
  maxRequests: 30,
  windowMs: 60_000, // 30 requests per minute
};

// ─── Response mappers ────────────────────────────────────────

/**
 * Maps posts from GET /reddit/search and GET /reddit/post/comments.
 * These endpoints return standard Reddit API format with fields like
 * score, created_utc, selftext, author, subreddit (string), archived, locked.
 */
function mapStandardPost(raw: Record<string, unknown>): RedditPost {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    selftext: String(raw.selftext ?? ""),
    author: String(raw.author ?? ""),
    subreddit: String(raw.subreddit ?? ""),
    score: Number(raw.score ?? 0),
    numComments: Number(raw.num_comments ?? 0),
    url: String(raw.url ?? ""),
    permalink: String(raw.permalink ?? ""),
    createdUtc: Number(raw.created_utc ?? 0),
    isArchived: Boolean(raw.archived ?? false),
    isLocked: Boolean(raw.locked ?? false),
    linkFlair: raw.link_flair_text ? String(raw.link_flair_text) : null,
  };
}

/**
 * Maps posts from GET /reddit/subreddit/search.
 * This endpoint returns a different format:
 *   - "votes" instead of "score"
 *   - "created_at_iso" instead of "created_utc"
 *   - "subreddit" is an object { id, name, nsfw, ... } not a string
 *   - "id" has "t3_" prefix
 *   - No selftext, author, archived, or locked fields
 */
function mapSubredditSearchPost(raw: Record<string, unknown>): RedditPost {
  const rawId = String(raw.id ?? "");
  const id = rawId.startsWith("t3_") ? rawId.slice(3) : rawId;

  const subredditObj = raw.subreddit as Record<string, unknown> | undefined;
  const subredditName = subredditObj ? String(subredditObj.name ?? "") : "";

  const createdIso = String(raw.created_at_iso ?? "");
  const createdUtc = createdIso
    ? Math.floor(new Date(createdIso).getTime() / 1000)
    : 0;

  return {
    id,
    title: String(raw.title ?? ""),
    selftext: "", // Not available from subreddit/search
    author: "", // Not available from subreddit/search
    subreddit: subredditName,
    score: Number(raw.votes ?? 0),
    numComments: Number(raw.num_comments ?? 0),
    url: String(raw.url ?? ""),
    permalink: String(raw.permalink ?? ""),
    createdUtc,
    isArchived: false, // Not available from subreddit/search
    isLocked: false, // Not available from subreddit/search
    linkFlair: null, // Not available from subreddit/search
  };
}

/**
 * Maps comments from GET /reddit/post/comments.
 * Replies are nested as { items: [...], more: { has_more, cursor } }.
 */
function mapComment(
  raw: Record<string, unknown>,
  postAuthor: string,
): RedditComment {
  const repliesObj = raw.replies as Record<string, unknown> | undefined;
  const replyItems =
    repliesObj && Array.isArray(repliesObj.items)
      ? (repliesObj.items as Record<string, unknown>[]).map((r) =>
          mapComment(r, postAuthor),
        )
      : [];

  return {
    id: String(raw.id ?? ""),
    body: String(raw.body ?? ""),
    author: String(raw.author ?? ""),
    score: Number(raw.score ?? raw.ups ?? 0),
    createdUtc: Number(raw.created_utc ?? 0),
    parentId: String(raw.parent_id ?? ""),
    depth: Number(raw.depth ?? 0),
    replies: replyItems,
    isOp: Boolean(raw.is_submitter ?? false),
  };
}

// ─── API helpers ─────────────────────────────────────────────

function buildUrl(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(`${SCRAPECREATORS_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, value);
  });
  return url.toString();
}

function headers(): Record<string, string> {
  return {
    "x-api-key": getApiKey(),
    "Content-Type": "application/json",
  };
}

async function apiGet<T>(
  path: string,
  params: Record<string, string | undefined>,
  cacheTtl?: number,
): Promise<T> {
  const url = buildUrl(path, params);

  if (cacheTtl) {
    const cached = cacheGet<T>(url);
    if (cached !== null) {
      console.log(`[cache hit] ${path}`);
      return cached;
    }
  }

  const data = await fetchWithRetry<T>(url, {
    method: "GET",
    headers: headers(),
    rateLimit: RATE_LIMIT,
    retry: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 15000 },
  });

  if (cacheTtl) {
    cacheSet(url, data, cacheTtl);
  }

  return data;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Search within a specific subreddit for posts.
 * Endpoint: GET /v1/reddit/subreddit/search
 *
 * Note: Posts from this endpoint lack selftext and author fields.
 * SubredditInfo is extracted from the first result's subreddit object.
 */
export async function searchSubreddit(
  subreddit: string,
  query: string,
  options?: {
    sort?: "relevance" | "hot" | "top" | "new" | "comments";
    timeframe?: "all" | "year" | "month" | "week" | "day" | "hour";
  },
): Promise<{ posts: RedditPost[]; subredditInfo: SubredditInfo | null }> {
  try {
    const data = await apiGet<{
      posts?: Record<string, unknown>[];
    }>(
      "/reddit/subreddit/search",
      {
        subreddit,
        query: query || undefined, // Don't send empty string
        filter: "posts",
        sort: options?.sort,
        timeframe: options?.timeframe,
      },
      3600, // 1 hour cache
    );

    const rawPosts = data.posts ?? [];
    const posts = rawPosts.map(mapSubredditSearchPost);

    // Extract subreddit info from the first result's subreddit object
    let subredditInfo: SubredditInfo | null = null;
    if (rawPosts.length > 0 && rawPosts[0].subreddit) {
      const subObj = rawPosts[0].subreddit as Record<string, unknown>;
      subredditInfo = {
        name: String(subObj.name ?? ""),
        subscribers: Number(subObj.weekly_visitors ?? 0),
        description: String(subObj.description ?? ""),
      };
    }

    return { posts, subredditInfo };
  } catch (error) {
    console.error(
      `[reddit/client] searchSubreddit failed for r/${subreddit} q="${query}":`,
      error,
    );
    return { posts: [], subredditInfo: null };
  }
}

/**
 * Get recent posts from a subreddit (sorted by new).
 * Uses GET /v1/reddit/subreddit/search with sort=new.
 *
 * Note: /reddit/subreddit/posts endpoint does not exist.
 */
export async function getRecentSubredditPosts(
  subreddit: string,
): Promise<RedditPost[]> {
  const { posts } = await searchSubreddit(subreddit, "", { sort: "new" });
  return posts;
}

/**
 * Search Reddit-wide for posts.
 * Endpoint: GET /v1/reddit/search
 */
export async function searchReddit(
  query: string,
  options?: {
    sort?: "relevance" | "new" | "top" | "comment_count";
    timeframe?: "all" | "day" | "week" | "month" | "year";
  },
): Promise<RedditPost[]> {
  try {
    const data = await apiGet<{
      posts?: Record<string, unknown>[];
    }>(
      "/reddit/search",
      {
        query,
        sort: options?.sort,
        timeframe: options?.timeframe,
      },
      3600, // 1 hour cache
    );

    return (data.posts ?? []).map(mapStandardPost);
  } catch (error) {
    console.error(
      `[reddit/client] searchReddit failed for q="${query}":`,
      error,
    );
    return [];
  }
}

/**
 * Get post details with comments and basic subreddit info.
 * Endpoint: GET /v1/reddit/post/comments
 *
 * SubredditInfo is extracted from the post's subreddit_subscribers field.
 */
export async function getPostComments(postUrl: string): Promise<{
  post: RedditPost;
  comments: RedditComment[];
  subredditInfo: SubredditInfo | null;
}> {
  const data = await apiGet<{
    post: Record<string, unknown>;
    comments: Record<string, unknown>[];
  }>(
    "/reddit/post/comments",
    { url: postUrl },
    1800, // 30 min cache
  );

  const post = mapStandardPost(data.post);
  const comments = (data.comments ?? []).map((c) =>
    mapComment(c, post.author),
  );

  // Extract basic subreddit info from the raw post data
  const subredditInfo: SubredditInfo | null = post.subreddit
    ? {
        name: post.subreddit,
        subscribers: Number(data.post.subreddit_subscribers ?? 0),
        description: "",
      }
    : null;

  return { post, comments, subredditInfo };
}
