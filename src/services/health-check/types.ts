export interface CommentHealthResult {
  commentId: string;
  status: "visible" | "deleted" | "uncertain";
  similarity: number;
}

export interface HealthCheckMetadata {
  lastCheckedAt: string;
  totalComments: number;
  visibleCount: number;
  deletedCount: number;
  uncertainCount: number;
  comments: CommentHealthResult[];
  error: string | null;
}

export interface UrlCheckBatch {
  contentUrl: string;
  platform: "REDDIT" | "YOUTUBE";
  entries: Array<{
    opportunityId: string;
    pipeline: "regular" | "hv";
    comments: Array<{
      commentId: string;
      text: string;
    }>;
  }>;
}
