import {
  getRedditComments,
  getYouTubeComments,
  type RedditComment,
  type YouTubeComment,
} from "@/services/discovery/scrape-creators";

export interface RedditValidationResult {
  valid: boolean;
  title?: string;
  subreddit?: string;
  commentCount?: number;
  isLocked?: boolean;
  isArchived?: boolean;
  threadAge?: number; // days
  reason?: string;
}

export interface YouTubeValidationResult {
  valid: boolean;
  title?: string;
  channelName?: string;
  commentCount?: number;
  reason?: string;
}

export async function validateRedditThread(
  url: string,
): Promise<RedditValidationResult> {
  try {
    const comments = await getRedditComments(url);

    // If we can fetch comments, the thread is accessible
    // We can't easily detect locked/archived from just comments,
    // but having comment access is a good sign
    return {
      valid: true,
      commentCount: comments.length,
      isLocked: false,
      isArchived: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Common failure patterns
    if (msg.includes("404") || msg.includes("not found")) {
      return { valid: false, reason: "Thread not found or deleted" };
    }
    if (msg.includes("403") || msg.includes("forbidden")) {
      return { valid: false, reason: "Thread is private or quarantined" };
    }

    return { valid: false, reason: `Validation failed: ${msg}` };
  }
}

export async function validateYouTubeVideo(
  url: string,
): Promise<YouTubeValidationResult> {
  try {
    const comments = await getYouTubeComments(url);

    return {
      valid: true,
      commentCount: comments.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("404") || msg.includes("not found")) {
      return { valid: false, reason: "Video not found or deleted" };
    }
    if (msg.includes("disabled")) {
      return { valid: false, reason: "Comments are disabled" };
    }

    return { valid: false, reason: `Validation failed: ${msg}` };
  }
}
