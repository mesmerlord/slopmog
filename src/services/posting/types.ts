export interface PostCommentParams {
  threadUrl: string;
  commentText: string;
  subreddit: string;
  parentCommentId?: string; // If replying to a comment instead of top-level
}

export interface PostCommentResult {
  success: boolean;
  commentId?: string;
  commentUrl?: string;
  error?: string;
  retryable: boolean;
}

export interface CommentStatus {
  exists: boolean;
  score?: number;
  removed?: boolean;
  replyCount?: number;
}
