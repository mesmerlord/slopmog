import { requireEnv } from "./env";

const BASE_URL = "https://api.scrapecreators.com/v1";

function headers(): Record<string, string> {
  return {
    "x-api-key": requireEnv("SCRAPE_CREATORS_API_KEY"),
    "Content-Type": "application/json",
  };
}

async function apiGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { method: "GET", headers: headers() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ScrapeCreators ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

// ─── YouTube ────────────────────────────────────────────────

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
  shorts?: Array<Record<string, unknown>>;
  continuationToken?: string;
  [key: string]: unknown;
}

function mapYTVideo(raw: Record<string, unknown>): YouTubeVideo {
  // ScrapeCreators YouTube search response format:
  //   id, url, title, thumbnail, channel: { id, title, handle, thumbnail },
  //   viewCountInt, likeCountInt, commentCountInt,
  //   publishDate, publishedTime, publishedTimeText,
  //   description, lengthSeconds, lengthText
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
  });

  // API may return results under different keys
  const rawVideos = data.results ?? data.videos ?? [];
  if (!Array.isArray(rawVideos)) {
    console.log(`[scrape-creators] Unexpected response shape:`, Object.keys(data));
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
  console.log(`[scrape-creators] Fetching comments for: ${videoUrl}`);

  const data = await apiGet<YTCommentsResponse>("/youtube/comments", { url: videoUrl });
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
    const data = await apiGet<Record<string, unknown>>("/youtube/video", { url: videoUrl });
    return {
      videoId: String(data.videoId ?? data.video_id ?? data.id ?? ""),
      title: String(data.title ?? ""),
      description: String(data.description ?? ""),
      channelName: String(data.channelName ?? data.channel_name ?? data.channelTitle ?? ""),
      viewCount: Number(data.viewCount ?? data.view_count ?? 0),
      likeCount: Number(data.likeCount ?? data.like_count ?? 0),
      commentCount: Number(data.commentCount ?? data.comment_count ?? 0),
      publishedAt: String(data.publishedAt ?? data.published_at ?? ""),
      duration: String(data.duration ?? ""),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    };
  } catch (err) {
    console.error(`[scrape-creators] Failed to get video details:`, err);
    return null;
  }
}

// ─── Twitter ────────────────────────────────────────────────

export interface TwitterProfile {
  username: string;
  name: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  verified: boolean;
  profileImageUrl: string;
}

export async function getTwitterProfile(username: string): Promise<TwitterProfile | null> {
  console.log(`[scrape-creators] Fetching Twitter profile: @${username}`);

  try {
    // API uses "handle" param, returns raw Twitter API format with nested core/legacy
    const data = await apiGet<Record<string, unknown>>("/twitter/profile", { handle: username });
    const core = data.core as Record<string, unknown> | undefined;
    const legacy = data.legacy as Record<string, unknown> | undefined;
    const avatar = data.avatar as Record<string, unknown> | undefined;

    return {
      username: String(core?.screen_name ?? legacy?.screen_name ?? username),
      name: String(core?.name ?? legacy?.name ?? ""),
      bio: String(legacy?.description ?? data.description ?? ""),
      followersCount: Number(legacy?.followers_count ?? data.followers_count ?? 0),
      followingCount: Number(legacy?.friends_count ?? legacy?.following_count ?? 0),
      tweetCount: Number(legacy?.statuses_count ?? data.statuses_count ?? 0),
      verified: Boolean(data.is_blue_verified ?? legacy?.verified ?? false),
      profileImageUrl: String(avatar?.image_url ?? legacy?.profile_image_url_https ?? ""),
    };
  } catch (err) {
    console.error(`[scrape-creators] Failed to get Twitter profile:`, err);
    return null;
  }
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  url: string;
}

interface TweetsResponse {
  tweets?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function mapTweet(raw: Record<string, unknown>): Tweet {
  // ScrapeCreators returns raw Twitter API format:
  //   rest_id, url, views: { count },
  //   legacy: { full_text, created_at, favorite_count, retweet_count, reply_count, ... }
  //   core: { user_results: { result: { legacy: { screen_name } } } }
  const id = String(raw.rest_id ?? raw.id ?? "");
  const legacy = raw.legacy as Record<string, unknown> | undefined;
  const views = raw.views as Record<string, unknown> | undefined;
  const core = raw.core as Record<string, unknown> | undefined;

  // Extract author from nested core.user_results.result.legacy.screen_name
  let author = "";
  if (core) {
    const userResults = core.user_results as Record<string, unknown> | undefined;
    const result = userResults?.result as Record<string, unknown> | undefined;
    const userLegacy = result?.legacy as Record<string, unknown> | undefined;
    author = String(userLegacy?.screen_name ?? "");
  }

  return {
    id,
    text: String(legacy?.full_text ?? raw.full_text ?? raw.text ?? ""),
    author,
    createdAt: String(legacy?.created_at ?? raw.created_at ?? ""),
    likeCount: Number(legacy?.favorite_count ?? raw.favorite_count ?? 0),
    retweetCount: Number(legacy?.retweet_count ?? raw.retweet_count ?? 0),
    replyCount: Number(legacy?.reply_count ?? raw.reply_count ?? 0),
    viewCount: Number(views?.count ?? raw.view_count ?? 0),
    url: String(raw.url ?? (author && id ? `https://x.com/${author}/status/${id}` : "")),
  };
}

export async function getUserTweets(username: string): Promise<Tweet[]> {
  console.log(`[scrape-creators] Fetching tweets for @${username}`);

  try {
    // API uses "handle" param
    const data = await apiGet<TweetsResponse>("/twitter/user-tweets", { handle: username });
    const rawTweets = data.tweets ?? data.results ?? [];
    if (!Array.isArray(rawTweets)) return [];

    return rawTweets.map(mapTweet);
  } catch (err) {
    console.error(`[scrape-creators] Failed to get tweets for @${username}:`, err);
    return [];
  }
}

export async function getTweetDetails(tweetUrl: string): Promise<Tweet | null> {
  console.log(`[scrape-creators] Fetching tweet: ${tweetUrl}`);

  try {
    // Tweet details endpoint also uses raw Twitter format
    const data = await apiGet<Record<string, unknown>>("/twitter/tweet", { url: tweetUrl });
    return mapTweet(data);
  } catch (err) {
    console.error(`[scrape-creators] Failed to get tweet details:`, err);
    return null;
  }
}
