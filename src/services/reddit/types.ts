export interface RedditPost {
  id: string; // Reddit's post ID (e.g. "1abc123")
  title: string;
  selftext: string; // Post body text
  author: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string; // Full Reddit URL
  permalink: string; // /r/sub/comments/id/slug
  createdUtc: number; // Unix timestamp
  isArchived: boolean;
  isLocked: boolean;
  linkFlair: string | null;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  createdUtc: number;
  parentId: string; // "t1_xxx" for comment, "t3_xxx" for post
  depth: number;
  replies: RedditComment[];
  isOp: boolean; // Is the comment author the same as the post author
}

export interface SubredditInfo {
  name: string;
  subscribers: number;
  description: string;
  publicDescription: string;
  rules: string[];
}

export interface DiscoveredThread {
  post: RedditPost;
  matchedKeyword: string;
  relevanceScore: number;
  suggestedReplyTarget?: {
    // If replying to a comment is better than top-level
    commentId: string;
    commentBody: string;
    commentAuthor: string;
    reason: string;
  };
}

export interface PostContext {
  post: RedditPost;
  topComments: RedditComment[];
  subredditInfo: SubredditInfo;
  suggestedPosition: "top_level" | "reply_to_op" | "reply_to_question";
  replyTarget?: {
    commentId: string;
    commentBody: string;
    commentAuthor: string;
  };
}
