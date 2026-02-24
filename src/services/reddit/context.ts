import { getPostComments } from "./client";
import type {
  RedditComment,
  PostContext,
} from "./types";

// ─── Constants ───────────────────────────────────────────────

const TOP_COMMENTS_LIMIT = 20;

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

function isQuestionText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.includes("?")) return true;
  return QUESTION_STARTERS.some((starter) => lower.startsWith(starter));
}

/**
 * Flatten all comments in the tree, preserving depth info.
 */
function flattenComments(comments: RedditComment[]): RedditComment[] {
  const result: RedditComment[] = [];
  const stack = [...comments];
  while (stack.length > 0) {
    const comment = stack.pop()!;
    result.push(comment);
    // Add replies in reverse so they come out in order
    for (let i = comment.replies.length - 1; i >= 0; i--) {
      stack.push(comment.replies[i]);
    }
  }
  return result;
}

/**
 * Find a comment by ID in a nested tree.
 */
function findCommentById(
  comments: RedditComment[],
  targetId: string,
): RedditComment | undefined {
  for (const comment of comments) {
    if (comment.id === targetId) return comment;
    const found = findCommentById(comment.replies, targetId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get the top N comments sorted by score (from the flat list).
 */
function getTopComments(
  comments: RedditComment[],
  limit: number,
): RedditComment[] {
  const flat = flattenComments(comments);
  return flat
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Main context function ───────────────────────────────────

/**
 * Fetches full post context for comment generation, including:
 * - The post itself with comments
 * - Basic subreddit info (extracted from the post data)
 * - Suggested comment position (top-level, reply to OP, reply to question)
 */
export async function fetchPostContext(params: {
  redditUrl: string;
  parentCommentId?: string;
}): Promise<PostContext> {
  const { redditUrl, parentCommentId } = params;

  // Fetch post + comments + subreddit info in one call
  const { post, comments, subredditInfo } = await getPostComments(redditUrl);

  // Get top comments by score
  const topComments = getTopComments(comments, TOP_COMMENTS_LIMIT);

  // Determine suggested position and reply target
  let suggestedPosition: PostContext["suggestedPosition"] = "top_level";
  let replyTarget: PostContext["replyTarget"] | undefined;

  if (parentCommentId) {
    // Explicit reply target specified
    const targetComment = findCommentById(comments, parentCommentId);
    if (targetComment) {
      suggestedPosition = "reply_to_question";
      replyTarget = {
        commentId: targetComment.id,
        commentBody: targetComment.body,
        commentAuthor: targetComment.author,
      };
    }
  } else if (post.numComments < 5) {
    // Few comments — top-level is best
    suggestedPosition = "top_level";
  } else {
    // Check if OP asked a question and has a reply worth responding to
    const isOpQuestion =
      isQuestionText(post.title) || isQuestionText(post.selftext);

    if (isOpQuestion) {
      // Look for a reply by OP in the comments (follow-up question or clarification)
      const opReply = flattenComments(comments).find(
        (c) => c.isOp && c.depth > 0,
      );
      if (opReply) {
        suggestedPosition = "reply_to_op";
        replyTarget = {
          commentId: opReply.id,
          commentBody: opReply.body,
          commentAuthor: opReply.author,
        };
      } else {
        suggestedPosition = "top_level";
      }
    } else {
      // Look for a top comment asking a question
      const questionComment = topComments.find((c) =>
        isQuestionText(c.body),
      );
      if (questionComment) {
        suggestedPosition = "reply_to_question";
        replyTarget = {
          commentId: questionComment.id,
          commentBody: questionComment.body,
          commentAuthor: questionComment.author,
        };
      } else {
        suggestedPosition = "top_level";
      }
    }
  }

  return {
    post,
    topComments,
    subredditInfo,
    suggestedPosition,
    replyTarget,
  };
}
