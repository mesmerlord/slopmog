import { fetchWithRetry, type RateLimitConfig } from "@/services/shared/http";
import type {
  RedditPost,
  RedditComment,
  SubredditInfo,
} from "./types";

// ─── Config ──────────────────────────────────────────────────

const SCRAPECREATORS_BASE_URL = "https://api.scrapecreators.com/v1";

function getApiKey(): string {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) throw new Error("SCRAPECREATORS_API_KEY is not set");
  return key;
}

const RATE_LIMIT: RateLimitConfig = {
  key: "scrapecreators",
  maxRequests: 30,
  windowMs: 60_000, // 30 requests per minute
};

// ─── Response mappers (snake_case → camelCase) ───────────────

function mapPost(raw: Record<string, unknown>): RedditPost {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    selftext: String(raw.selftext ?? raw.self_text ?? ""),
    author: String(raw.author ?? ""),
    subreddit: String(raw.subreddit ?? ""),
    score: Number(raw.score ?? 0),
    numComments: Number(raw.num_comments ?? raw.numComments ?? 0),
    url: String(raw.url ?? ""),
    permalink: String(raw.permalink ?? ""),
    createdUtc: Number(raw.created_utc ?? raw.createdUtc ?? 0),
    isArchived: Boolean(raw.is_archived ?? raw.isArchived ?? false),
    isLocked: Boolean(raw.is_locked ?? raw.isLocked ?? false),
    linkFlair: raw.link_flair ?? raw.link_flair_text ?? raw.linkFlair
      ? String(raw.link_flair ?? raw.link_flair_text ?? raw.linkFlair)
      : null,
  };
}

function mapComment(
  raw: Record<string, unknown>,
  postAuthor: string,
): RedditComment {
  const replies = Array.isArray(raw.replies)
    ? (raw.replies as Record<string, unknown>[]).map((r) =>
        mapComment(r, postAuthor),
      )
    : [];

  return {
    id: String(raw.id ?? ""),
    body: String(raw.body ?? ""),
    author: String(raw.author ?? ""),
    score: Number(raw.score ?? 0),
    createdUtc: Number(raw.created_utc ?? raw.createdUtc ?? 0),
    parentId: String(raw.parent_id ?? raw.parentId ?? ""),
    depth: Number(raw.depth ?? 0),
    replies,
    isOp: String(raw.author ?? "") === postAuthor,
  };
}

function mapSubredditInfo(raw: Record<string, unknown>): SubredditInfo {
  const rawRules = raw.rules;
  const rules = Array.isArray(rawRules)
    ? rawRules.map((r) =>
        typeof r === "string" ? r : String((r as Record<string, unknown>).short_name ?? (r as Record<string, unknown>).title ?? r),
      )
    : [];

  return {
    name: String(raw.name ?? raw.display_name ?? ""),
    subscribers: Number(raw.subscribers ?? raw.subscriber_count ?? 0),
    description: String(raw.description ?? ""),
    publicDescription: String(
      raw.public_description ?? raw.publicDescription ?? "",
    ),
    rules,
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
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

async function apiGet<T>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  return fetchWithRetry<T>(buildUrl(path, params), {
    method: "GET",
    headers: headers(),
    rateLimit: RATE_LIMIT,
    retry: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 15000 },
  });
}

// ─── Public API ──────────────────────────────────────────────

/** Search within a specific subreddit */
export async function searchSubreddit(
  subreddit: string,
  query: string,
  sort: "relevance" | "new" | "hot" = "relevance",
): Promise<RedditPost[]> {
  try {
    const data = await apiGet<{ posts?: unknown[]; data?: unknown[] }>(
      "/reddit/subreddit/search",
      { name: subreddit, query, sort },
    );
    const posts = (data.posts ?? data.data ?? []) as Record<string, unknown>[];
    return posts.map(mapPost);
  } catch (error) {
    console.error(
      `[reddit/client] searchSubreddit failed for r/${subreddit} q="${query}":`,
      error,
    );
    return [];
  }
}

/** Get recent posts from a subreddit */
export async function getSubredditPosts(
  subreddit: string,
  sort: "new" | "hot" | "rising" = "new",
): Promise<RedditPost[]> {
  try {
    const data = await apiGet<{ posts?: unknown[]; data?: unknown[] }>(
      "/reddit/subreddit/posts",
      { name: subreddit, sort },
    );
    const posts = (data.posts ?? data.data ?? []) as Record<string, unknown>[];
    return posts.map(mapPost);
  } catch (error) {
    console.error(
      `[reddit/client] getSubredditPosts failed for r/${subreddit}:`,
      error,
    );
    return [];
  }
}

/** Search Reddit-wide */
export async function searchReddit(query: string): Promise<RedditPost[]> {
  try {
    const data = await apiGet<{ posts?: unknown[]; data?: unknown[] }>(
      "/reddit/search",
      { query },
    );
    const posts = (data.posts ?? data.data ?? []) as Record<string, unknown>[];
    return posts.map(mapPost);
  } catch (error) {
    console.error(
      `[reddit/client] searchReddit failed for q="${query}":`,
      error,
    );
    return [];
  }
}

/** Get post details with comments */
export async function getPostComments(
  postUrl: string,
): Promise<{ post: RedditPost; comments: RedditComment[] }> {
  const data = await apiGet<Record<string, unknown>>(
    "/reddit/post/comments",
    { url: postUrl },
  );

  const rawPost = (data.post ?? data) as Record<string, unknown>;
  const post = mapPost(rawPost);

  const rawComments = (data.comments ?? []) as Record<string, unknown>[];
  const comments = rawComments.map((c) => mapComment(c, post.author));

  return { post, comments };
}

/** Get subreddit info */
export async function getSubredditInfo(
  subreddit: string,
): Promise<SubredditInfo> {
  const data = await apiGet<Record<string, unknown>>(
    "/reddit/subreddit/info",
    { name: subreddit },
  );

  const raw = (data.data ?? data) as Record<string, unknown>;
  return mapSubredditInfo(raw);
}
