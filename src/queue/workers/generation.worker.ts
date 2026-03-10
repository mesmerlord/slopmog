import { Worker, type Job } from "bullmq";
import { redisConnection, redis } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { GenerationJobData, PostingJobData } from "@/queue/queues";
import { postingQueue } from "@/queue/queues";
import { generateComment } from "@/services/generation/generator";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import { fetchTweetReplies } from "@/services/discovery/twitter-discovery";
import type { CommentGenerationInput } from "@/services/generation/types";
import { parseDailyBudget } from "@/services/budget/config";

/**
 * Atomically reserve the next posting slot for a platform.
 * Returns the timestamp (ms) at which the comment should be posted.
 * Uses a Lua script so concurrent workers can't read the same stale value.
 */
const RESERVE_SLOT_SCRIPT = `
local key   = KEYS[1]
local now   = tonumber(ARGV[1])
local gap   = tonumber(ARGV[2])
local last  = tonumber(redis.call('GET', key) or '0')
if last == nil then last = 0 end
local earliest = math.max(now, last)
local postAt   = earliest + gap
redis.call('SET', key, tostring(postAt))
redis.call('EXPIRE', key, 3600)
return tostring(postAt)
`;

async function reservePostingSlot(siteId: string, platform: string): Promise<{ postAt: number; delayMs: number }> {
  const redisKey = `auto:lastScheduled:${siteId}:${platform}`;
  const now = Date.now();
  const gapMs = Math.floor(Math.random() * 300_000) + 300_000; // 5–10 min

  const postAtStr = await redis.eval(
    RESERVE_SLOT_SCRIPT,
    1,
    redisKey,
    now.toString(),
    gapMs.toString(),
  ) as string;

  const postAt = parseInt(postAtStr, 10);
  return { postAt, delayMs: Math.max(0, postAt - now) };
}

async function processGeneration(job: Job<GenerationJobData>) {
  const { opportunityId } = job.data;

  await job.log(`Starting generation for opportunity ${opportunityId}`);

  const opportunity = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { site: true },
  });

  await job.log(`Opportunity loaded: platform=${opportunity.platform}, site="${opportunity.site.name}", keyword="${opportunity.matchedKeyword}"`);

  // Set opportunity to GENERATING
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { status: "GENERATING" },
  });

  const site = opportunity.site;

  // Fetch existing comments for context
  let existingComments: CommentGenerationInput["existingComments"] = [];

  try {
    if (opportunity.platform === "REDDIT") {
      const comments = await getRedditComments(opportunity.contentUrl);
      existingComments = comments.slice(0, 15).map((c) => ({
        author: c.author,
        body: c.body,
        score: c.score,
        isOp: false, // We don't have OP info from this endpoint
      }));
    } else if (opportunity.platform === "YOUTUBE") {
      const comments = await getYouTubeComments(opportunity.contentUrl);
      existingComments = comments.slice(0, 15).map((c) => ({
        author: c.author,
        body: c.text,
        score: c.likeCount,
        isOp: false,
      }));
    } else if (opportunity.platform === "TWITTER") {
      const replies = await fetchTweetReplies(opportunity.contentUrl);
      existingComments = replies.slice(0, 15).map((r) => ({
        author: r.author,
        body: r.text,
        score: r.likes,
        isOp: false,
      }));
    }
  } catch (err) {
    console.warn(`[generation] Failed to fetch existing comments for ${opportunityId}:`, err);
    await job.log(`Warning: failed to fetch existing comments, proceeding without them`);
  }

  const input: CommentGenerationInput = {
    postTitle: opportunity.title,
    postBody: opportunity.body ?? "",
    sourceContext: opportunity.sourceContext,
    platform: opportunity.platform,
    existingComments,
    businessName: site.name,
    businessDescription: site.description,
    valueProps: site.valueProps,
    websiteUrl: site.url,
    brandTone: site.brandTone,
    matchedKeyword: opportunity.matchedKeyword,
    commentPosition: "top_level",
    postType: (opportunity.postType as "question" | "discussion" | "showcase") ?? "discussion",
  };

  await job.log(`Generating comment via AI (${existingComments.length} existing comments as context)`);

  const result = await generateComment(input);

  if (result.noRelevantComment) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "SKIPPED" },
    });
    console.log(`[generation] No relevant comment for opportunity ${opportunityId}, skipped`);
    await job.log(`No relevant comment generated — opportunity marked SKIPPED`);
    return;
  }

  const best = result.best;

  await job.log(`Comment generated: qualityScore=${best.qualityScore}, variants=${result.variants.length}`);

  // For Twitter, combine all 10 variants as newline-separated text (one per SocialPlug comment)
  const savedText = opportunity.platform === "TWITTER" && result.variants.length > 1
    ? result.variants.map((v) => v.text.replace(/\s*\n+\s*/g, " ").trim()).filter(Boolean).join("\n")
    : best.text;
  const shouldPost = site.mode === "AUTO" || job.data.postAfterGeneration;
  const commentStatus = shouldPost ? "APPROVED" : "DRAFT";
  const opportunityStatus = shouldPost ? "APPROVED" : "PENDING_REVIEW";

  const comment = await prisma.comment.create({
    data: {
      opportunityId,
      siteId: site.id,
      status: commentStatus,
      text: savedText,
      persona: input.persona ?? "auto",
      qualityScore: best.qualityScore,
      scoreReasons: best.reasons,
    },
  });

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { status: opportunityStatus },
  });

  // Enqueue for posting when in AUTO mode or explicitly requested
  if (shouldPost) {
    // In AUTO mode, check per-platform daily budget (DB-based)
    if (site.mode === "AUTO") {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const postedToday = await prisma.comment.count({
        where: {
          siteId: site.id,
          status: "POSTED",
          opportunity: { platform: opportunity.platform },
          postedAt: { gte: startOfDay },
        },
      });

      const budget = parseDailyBudget(site.dailyBudget);
      const platformKey = opportunity.platform.toLowerCase() as "reddit" | "youtube" | "twitter";
      const platformLimit = budget[platformKey];

      if (postedToday >= platformLimit) {
        await prisma.$transaction([
          prisma.comment.update({
            where: { id: comment.id },
            data: { status: "DRAFT" },
          }),
          prisma.opportunity.update({
            where: { id: opportunityId },
            data: { status: "PENDING_REVIEW" },
          }),
        ]);
        console.log(`[generation] AUTO mode: ${opportunity.platform} daily limit reached (${postedToday}/${platformLimit}) for site ${site.id}, comment ${comment.id} reverted to DRAFT`);
        await job.log(`AUTO mode: ${opportunity.platform} daily limit reached (${postedToday}/${platformLimit}), comment reverted to DRAFT for manual review`);
        return;
      }
    }

    // Atomically reserve the next posting slot (safe with concurrency > 1)
    const { delayMs } = await reservePostingSlot(site.id, opportunity.platform);

    const delayMin = Math.round(delayMs / 60_000);
    await postingQueue.add("post", {
      commentId: comment.id,
    } satisfies PostingJobData, {
      jobId: `post-${comment.id}`,
      delay: delayMs,
    });
    console.log(`[generation] Enqueued comment ${comment.id} for posting (delay: ${delayMin}m)`);
    await job.log(`Comment ${comment.id} enqueued for posting (delay: ~${delayMin}m)`);
  }

  console.log(`[generation] Generated comment for opportunity ${opportunityId} (${commentStatus})`);
  await job.log(`Done: comment ${comment.id} saved as ${commentStatus}, opportunity set to ${opportunityStatus}`);
}

export const generationWorker = new Worker<GenerationJobData>(
  "generation",
  processGeneration,
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

generationWorker.on("completed", (job) => {
  console.log(`[generation] Job ${job.id} completed`);
});

generationWorker.on("failed", (job, err) => {
  console.error(`[generation] Job ${job?.id} failed:`, err.message);
  if (job) {
    job.log(`FAILED: ${err.message}`).catch(() => {});
  }
});
