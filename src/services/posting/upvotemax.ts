import { fetchWithRetry } from "@/services/shared/http";
import type { PostingProvider } from "./provider";
import { postingRegistry } from "./provider";
import type { PostCommentParams, PostCommentResult, CommentStatus } from "./types";

interface UpvoteMaxResponse {
  success: boolean;
  comment_id?: string;
  comment_url?: string;
  error?: string;
  error_code?: string;
}

interface UpvoteMaxStatusResponse {
  exists: boolean;
  score?: number;
  removed?: boolean;
  reply_count?: number;
}

function getConfig() {
  const apiKey = process.env.UPVOTEMAX_API_KEY;
  const baseUrl = process.env.UPVOTEMAX_BASE_URL;
  if (!apiKey || !baseUrl) {
    throw new Error("UPVOTEMAX_API_KEY and UPVOTEMAX_BASE_URL must be set");
  }
  return { apiKey, baseUrl };
}

const RATE_LIMIT = {
  key: "upvotemax",
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 10 per hour — conservative for natural patterns
};

const upvoteMaxProvider: PostingProvider = {
  name: "upvotemax",

  async postComment(params: PostCommentParams): Promise<PostCommentResult> {
    const { apiKey, baseUrl } = getConfig();

    try {
      const response = await fetchWithRetry<UpvoteMaxResponse>(
        `${baseUrl}/api/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            thread_url: params.threadUrl,
            comment_text: params.commentText,
            subreddit: params.subreddit,
            parent_comment_id: params.parentCommentId ?? null,
          }),
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 2, baseDelayMs: 5000, maxDelayMs: 30000 },
        },
      );

      if (response.success) {
        return {
          success: true,
          commentId: response.comment_id,
          commentUrl: response.comment_url,
          retryable: false,
        };
      }

      // Determine if error is retryable
      const retryable = response.error_code !== "BANNED" &&
        response.error_code !== "SUBREDDIT_RESTRICTED" &&
        response.error_code !== "INVALID_THREAD";

      return {
        success: false,
        error: response.error || "Unknown error from UpvoteMax",
        retryable,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
        retryable: !message.includes("401") && !message.includes("403"),
      };
    }
  },

  async checkCommentStatus(commentId: string): Promise<CommentStatus> {
    const { apiKey, baseUrl } = getConfig();

    try {
      const response = await fetchWithRetry<UpvoteMaxStatusResponse>(
        `${baseUrl}/api/comments/${commentId}/status`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          rateLimit: RATE_LIMIT,
          retry: { maxRetries: 1, baseDelayMs: 2000, maxDelayMs: 10000 },
        },
      );

      return {
        exists: response.exists,
        score: response.score,
        removed: response.removed,
        replyCount: response.reply_count,
      };
    } catch {
      return { exists: false, removed: true };
    }
  },

  async isAvailable(): Promise<boolean> {
    try {
      getConfig(); // Will throw if env vars missing
      return true;
    } catch {
      return false;
    }
  },

  async getRemainingCapacity(): Promise<number> {
    // Could check UpvoteMax API for remaining quota
    // For now, return a default
    return 100;
  },
};

// Register on import
postingRegistry.register(upvoteMaxProvider);

export { upvoteMaxProvider };
