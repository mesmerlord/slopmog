import {
  getRedditCommentsLive,
  getYouTubeCommentsLive,
} from "@/services/discovery/scrape-creators";
import { findBestMatch } from "./matcher";
import type {
  UrlCheckBatch,
  HealthCheckMetadata,
  CommentHealthResult,
} from "./types";

const VISIBLE_THRESHOLD = 0.85;
const DELETED_THRESHOLD = 0.5;

function classifyScore(score: number): CommentHealthResult["status"] {
  if (score >= VISIBLE_THRESHOLD) return "visible";
  if (score < DELETED_THRESHOLD) return "deleted";
  return "uncertain";
}

/**
 * Check a batch of opportunities that share the same contentUrl.
 * Returns a map of opportunityId → HealthCheckMetadata to merge into metadata.
 */
export async function checkUrlBatch(
  batch: UrlCheckBatch,
): Promise<Map<string, HealthCheckMetadata>> {
  const results = new Map<string, HealthCheckMetadata>();

  let externalTexts: string[];

  try {
    if (batch.platform === "REDDIT") {
      const comments = await getRedditCommentsLive(batch.contentUrl);
      externalTexts = comments.map((c) => c.body);
    } else {
      const comments = await getYouTubeCommentsLive(batch.contentUrl);
      externalTexts = comments.map((c) => c.text);
    }
  } catch (err) {
    // API failure — mark all entries with an error
    const errorMsg = err instanceof Error ? err.message : String(err);
    for (const entry of batch.entries) {
      results.set(entry.opportunityId, {
        lastCheckedAt: new Date().toISOString(),
        totalComments: entry.comments.length,
        visibleCount: 0,
        deletedCount: 0,
        uncertainCount: 0,
        comments: [],
        error: errorMsg,
      });
    }
    return results;
  }

  for (const entry of batch.entries) {
    const commentResults: CommentHealthResult[] = [];
    let visible = 0;
    let deleted = 0;
    let uncertain = 0;

    for (const comment of entry.comments) {
      const { score } = findBestMatch(comment.text, externalTexts);
      const status = classifyScore(score);

      if (status === "visible") visible++;
      else if (status === "deleted") deleted++;
      else uncertain++;

      commentResults.push({
        commentId: comment.commentId,
        status,
        similarity: score,
      });
    }

    results.set(entry.opportunityId, {
      lastCheckedAt: new Date().toISOString(),
      totalComments: entry.comments.length,
      visibleCount: visible,
      deletedCount: deleted,
      uncertainCount: uncertain,
      comments: commentResults,
      error: null,
    });
  }

  return results;
}
