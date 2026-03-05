import { fetchWithRetry, type RateLimitConfig } from "@/services/shared/http";
import { cacheGet, cacheSet } from "@/services/shared/cache";

const BASE_URL = "https://api.scrapecreators.com/v1";

const RATE_LIMIT: RateLimitConfig = {
  key: "scrapecreators",
  maxRequests: 30,
  windowMs: 60_000,
};

const CACHE_TTL_SEARCH = 6 * 60 * 60; // 6 hours for search results
const CACHE_TTL_DETAIL = 7 * 24 * 60 * 60; // 7 days for detail endpoints

function getApiKey(): string {
  const key = process.env.SCRAPE_CREATORS_API_KEY;
  if (!key) throw new Error("SCRAPE_CREATORS_API_KEY is not set");
  return key;
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function apiGet<T>(path: string, params: Record<string, string | undefined>, cacheTtl?: number): Promise<T> {
  const url = buildUrl(path, params);

  if (cacheTtl) {
    const cached = cacheGet<T>(url);
    if (cached) {
      console.log(`[scrape-creators] Cache hit: ${path}`);
      return cached;
    }
  }

  const data = await fetchWithRetry<T>(url, {
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
    },
    rateLimit: RATE_LIMIT,
  });

  if (cacheTtl) {
    cacheSet(url, data, cacheTtl);
  }

  return data;
}

// ─── Reddit ──────────────────────────────────────────────────

export interface RedditPost {
  id: string;
  title: string;
  body: string;
  subreddit: string;
  author: string;
  score: number;
  numComments: number;
  subredditSubscribers: number;
  url: string;
  permalink: string;
  createdAt: string;
}

interface RedditSearchResponse {
  posts?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  after?: string;
  [key: string]: unknown;
}

function mapRedditPost(raw: Record<string, unknown>): RedditPost {
  const id = String(raw.id ?? raw.name ?? "");
  const subreddit = String(raw.subreddit ?? raw.subreddit_name ?? raw.subredditName ?? "");
  const permalink = String(raw.permalink ?? raw.url ?? "");

  return {
    id,
    title: String(raw.title ?? ""),
    body: String(raw.body ?? raw.selftext ?? raw.text ?? ""),
    subreddit,
    author: String(raw.author ?? raw.authorName ?? ""),
    score: Number(raw.score ?? raw.ups ?? 0),
    numComments: Number(raw.numComments ?? raw.num_comments ?? raw.commentCount ?? 0),
    subredditSubscribers: Number(raw.subreddit_subscribers ?? raw.subredditSubscribers ?? 0),
    url: permalink.startsWith("http")
      ? permalink
      : `https://www.reddit.com${permalink}`,
    permalink,
    createdAt: String(raw.createdAt ?? raw.created_at ?? raw.created_utc ?? ""),
  };
}

export interface RedditSearchResult {
  posts: RedditPost[];
  after?: string;
}

export async function searchReddit(
  query: string,
  options?: { sort?: string; timeframe?: string; after?: string },
): Promise<RedditSearchResult> {
  console.log(`[scrape-creators] Reddit search: "${query}"${options?.after ? ` (after: ${options.after})` : ""}`);

  const data = await apiGet<RedditSearchResponse>("/reddit/search", {
    query,
    sort: options?.sort ?? "comment_count",
    timeframe: options?.timeframe ?? "day",
    after: options?.after,
  }, options?.after ? undefined : CACHE_TTL_SEARCH);

  const rawPosts = data.posts ?? data.results ?? [];
  if (!Array.isArray(rawPosts)) {
    console.log(`[scrape-creators] Unexpected Reddit response shape:`, Object.keys(data));
    return { posts: [], after: undefined };
  }

  const posts = rawPosts.map(mapRedditPost);
  console.log(`[scrape-creators] Found ${posts.length} Reddit posts for "${query}"`);
  return { posts, after: data.after ?? undefined };
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  createdAt: string;
  isTopLevel: boolean;
}

interface RedditCommentsResponse {
  comments?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export async function getRedditComments(postUrl: string): Promise<RedditComment[]> {
  console.log(`[scrape-creators] Fetching Reddit comments: ${postUrl}`);

  const data = await apiGet<RedditCommentsResponse>("/reddit/post/comments", {
    url: postUrl,
  }, CACHE_TTL_DETAIL);

  const rawComments = data.comments ?? [];
  if (!Array.isArray(rawComments)) return [];

  return rawComments.map((c) => ({
    id: String(c.id ?? c.name ?? ""),
    author: String(c.author ?? ""),
    body: String(c.body ?? c.text ?? ""),
    score: Number(c.score ?? c.ups ?? 0),
    createdAt: String(c.createdAt ?? c.created_at ?? c.created_utc ?? ""),
    isTopLevel: Boolean(c.isTopLevel ?? c.is_top_level ?? !c.parent_id?.toString().startsWith("t1_")),
  }));
}

// ─── Reddit post + comments (combined endpoint) ─────────────

interface RedditPostCommentsResponse {
  post?: Record<string, unknown>;
  comments?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface RedditPostWithComments {
  post: RedditPost;
  comments: RedditComment[];
}

/**
 * Fetches a Reddit post and its comments in a single API call.
 * The /reddit/post/comments endpoint returns both `post` and `comments`.
 */
export async function getRedditPostWithComments(postUrl: string): Promise<RedditPostWithComments | null> {
  console.log(`[scrape-creators] Fetching Reddit post + comments: ${postUrl}`);

  try {
    const data = await apiGet<RedditPostCommentsResponse>("/reddit/post/comments", {
      url: postUrl,
    }, CACHE_TTL_DETAIL);

    const rawPost = data.post;
    const post = rawPost ? mapRedditPost(rawPost) : null;
    if (!post) return null;

    const rawComments = data.comments ?? [];
    const comments = Array.isArray(rawComments)
      ? rawComments.map((c) => ({
          id: String(c.id ?? c.name ?? ""),
          author: String(c.author ?? ""),
          body: String(c.body ?? c.text ?? ""),
          score: Number(c.score ?? c.ups ?? 0),
          createdAt: String(c.createdAt ?? c.created_at ?? c.created_utc ?? ""),
          isTopLevel: Boolean(c.isTopLevel ?? c.is_top_level ?? !c.parent_id?.toString().startsWith("t1_")),
        }))
      : [];

    return { post, comments };
  } catch (err) {
    console.error(`[scrape-creators] Failed to get Reddit post + comments:`, err);
    return null;
  }
}

// ─── YouTube (re-exported from scripts pattern) ──────────────

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  url: string;
  thumbnail: string;
}

interface YTSearchResponse {
  success?: boolean;
  videos?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  shorts?: Array<Record<string, unknown>>;
  continuationToken?: string;
  [key: string]: unknown;
}

function mapYTVideo(raw: Record<string, unknown>): YouTubeVideo {
  const videoId = String(raw.id ?? "");
  const channel = raw.channel as Record<string, unknown> | undefined;
  const channelName = channel ? String(channel.title ?? "") : String(raw.channel ?? "");
  const channelId = channel ? String(channel.id ?? "") : "";

  return {
    videoId,
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    channelName,
    channelId,
    viewCount: Number(raw.viewCountInt ?? raw.viewCount ?? 0),
    likeCount: Number(raw.likeCountInt ?? raw.likeCount ?? 0),
    commentCount: Number(raw.commentCountInt ?? raw.commentCount ?? 0),
    publishedAt: String(raw.publishDate ?? raw.publishedTime ?? ""),
    url: String(raw.url ?? (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "")),
    thumbnail: String(raw.thumbnail ?? ""),
  };
}

export async function searchYouTube(query: string): Promise<YouTubeVideo[]> {
  console.log(`[scrape-creators] YouTube search: "${query}"`);

  const data = await apiGet<YTSearchResponse>("/youtube/search", {
    query,
    includeExtras: "true",
  }, CACHE_TTL_SEARCH);

  const rawVideos = data.results ?? data.videos ?? [];
  if (!Array.isArray(rawVideos)) {
    console.log(`[scrape-creators] Unexpected YouTube response shape:`, Object.keys(data));
    return [];
  }

  const videos = rawVideos.map(mapYTVideo);
  console.log(`[scrape-creators] Found ${videos.length} YouTube videos for "${query}"`);
  return videos;
}

export interface YouTubeComment {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  isReply: boolean;
}

interface YTCommentsResponse {
  comments?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export async function getYouTubeComments(videoUrl: string): Promise<YouTubeComment[]> {
  console.log(`[scrape-creators] Fetching YouTube comments: ${videoUrl}`);

  const data = await apiGet<YTCommentsResponse>("/youtube/video/comments", {
    url: videoUrl,
  }, CACHE_TTL_DETAIL);

  const rawComments = data.comments ?? [];

  return rawComments.map((c) => ({
    id: String(c.id ?? c.commentId ?? ""),
    author: String(c.author ?? c.authorDisplayName ?? ""),
    text: String(c.text ?? c.textDisplay ?? c.body ?? ""),
    likeCount: Number(c.likeCount ?? c.like_count ?? c.likes ?? 0),
    publishedAt: String(c.publishedAt ?? c.published_at ?? ""),
    isReply: Boolean(c.isReply ?? c.is_reply ?? false),
  }));
}

export interface YouTubeVideoDetails {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  duration: string;
  tags: string[];
}

export async function getVideoDetails(videoUrl: string): Promise<YouTubeVideoDetails | null> {
  console.log(`[scrape-creators] Fetching video details: ${videoUrl}`);

  try {
    const data = await apiGet<Record<string, unknown>>("/youtube/video", {
      url: videoUrl,
    }, CACHE_TTL_DETAIL);

    const channel = data.channel as Record<string, unknown> | undefined;
    const channelName = channel ? String(channel.title ?? "") : String(data.channelName ?? data.channel_name ?? data.channelTitle ?? "");

    return {
      videoId: String(data.id ?? data.videoId ?? data.video_id ?? ""),
      title: String(data.title ?? ""),
      description: String(data.description ?? ""),
      channelName,
      viewCount: Number(data.viewCountInt ?? data.viewCount ?? data.view_count ?? 0),
      likeCount: Number(data.likeCountInt ?? data.likeCount ?? data.like_count ?? 0),
      commentCount: Number(data.commentCountInt ?? data.commentCount ?? data.comment_count ?? 0),
      publishedAt: String(data.publishDate ?? data.publishedAt ?? data.published_at ?? ""),
      duration: String(data.durationFormatted ?? data.duration ?? ""),
      tags: Array.isArray(data.keywords) ? data.keywords.map(String) : Array.isArray(data.tags) ? data.tags.map(String) : [],
    };
  } catch (err) {
    console.error(`[scrape-creators] Failed to get video details:`, err);
    return null;
  }
}
