export interface PostCommentParams {
  threadUrl: string;
  commentText: string;
  subreddit: string;
  parentCommentId?: string; // If replying to a comment instead of top-level
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  cost?: number;
  balance?: number;
  error?: string;
  retryable: boolean;
}

export type OrderStatus = "pending" | "running" | "completed" | "failed" | "unknown";

export interface OrderStatusResult {
  status: OrderStatus;
  error?: string;
}

// Kept for tracking — represents what we know about a posted comment
export interface CommentStatus {
  exists: boolean;
  score?: number;
  removed?: boolean;
  replyCount?: number;
}
