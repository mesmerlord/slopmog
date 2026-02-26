export interface CommentGenerationInput {
  // Post context
  postTitle: string;
  postBody: string;
  subreddit: string;
  existingComments: Array<{
    author: string;
    body: string;
    score: number;
    isOp: boolean;
  }>;

  // Reply target (null = top-level comment)
  replyTarget?: {
    commentId: string;
    commentBody: string;
    commentAuthor: string;
  };

  // Brand context
  businessName: string;
  businessDescription: string;
  valueProps: string[];
  websiteUrl?: string;
  brandTone: string;

  // Strategy
  matchedKeyword: string;
  commentPosition: "top_level" | "reply_to_op" | "reply_to_question";
  postType: "showcase" | "question" | "discussion";

  // Persona
  persona?: string;
}

export interface GeneratedComment {
  text: string;
  temperature: number;
  qualityScore: number;
  reasons: string[]; // Why this score
}

export interface CommentGenerationResult {
  best: GeneratedComment;
  variants: GeneratedComment[];
  noRelevantComment: boolean; // Model decided no natural comment is possible
}
