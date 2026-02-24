import { postingRegistry } from "@/services/posting/provider";
import type { CommentStatus } from "@/services/posting/types";

// Decaying check schedule (in milliseconds)
const CHECK_SCHEDULE = [
  2 * 60 * 60 * 1000,       // Check 1: 2 hours after posting
  2 * 60 * 60 * 1000,       // Check 2: 2 hours later (4h total)
  2 * 60 * 60 * 1000,       // Check 3: 2 hours later (6h total)
  6 * 60 * 60 * 1000,       // Check 4: 6 hours later (12h total)
  12 * 60 * 60 * 1000,      // Check 5: 12 hours later (24h total)
  12 * 60 * 60 * 1000,      // Check 6: 12 hours later (36h total)
  24 * 60 * 60 * 1000,      // Check 7: 24 hours later (60h total)
  24 * 60 * 60 * 1000,      // Check 8: 24 hours later (84h total)
  3 * 24 * 60 * 60 * 1000,  // Check 9: 3 days later (~7 days total)
  3 * 24 * 60 * 60 * 1000,  // Check 10: 3 days later (~10 days total)
  7 * 24 * 60 * 60 * 1000,  // Check 11: 7 days later (~17 days total)
  7 * 24 * 60 * 60 * 1000,  // Check 12: 7 days later (~24 days total)
  7 * 24 * 60 * 60 * 1000,  // Check 13: 7 days later (~31 days total) — LAST
];

export interface TrackingSnapshot {
  checkNumber: number;
  timestamp: string;
  score: number;
  replyCount: number;
  exists: boolean;
  removed: boolean;
}

export function getNextCheckDelay(checkNumber: number): number | null {
  if (checkNumber >= CHECK_SCHEDULE.length) return null; // No more checks
  return CHECK_SCHEDULE[checkNumber];
}

export async function checkCommentPerformance(
  commentId: string,
  providerName: string,
  checkNumber: number,
): Promise<{
  status: CommentStatus;
  snapshot: TrackingSnapshot;
  nextCheckDelay: number | null;
}> {
  // Find the provider that posted this comment
  const providers = postingRegistry.getAll();
  const provider = providers.find((p) => p.name === providerName);

  let status: CommentStatus;

  if (provider?.checkCommentStatus) {
    status = await provider.checkCommentStatus(commentId);
  } else {
    // Fallback: assume comment still exists
    status = { exists: true, score: 0, removed: false, replyCount: 0 };
  }

  const snapshot: TrackingSnapshot = {
    checkNumber,
    timestamp: new Date().toISOString(),
    score: status.score ?? 0,
    replyCount: status.replyCount ?? 0,
    exists: status.exists,
    removed: status.removed ?? false,
  };

  return {
    status,
    snapshot,
    nextCheckDelay: getNextCheckDelay(checkNumber + 1),
  };
}
