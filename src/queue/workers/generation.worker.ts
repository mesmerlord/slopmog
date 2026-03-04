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
import type { CommentGenerationInput } from "@/services/generation/types";

function toSingleLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
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

  const youtubeCombinedText = result.variants
    .slice(0, 5)
    .map((variant) => toSingleLine(variant.text))
    .filter(Boolean)
    .join("\n");
  const savedText = opportunity.platform === "YOUTUBE" ? youtubeCombinedText : best.text;
  const commentStatus = site.mode === "AUTO" ? "APPROVED" : "DRAFT";
  const opportunityStatus = site.mode === "AUTO" ? "APPROVED" : "PENDING_REVIEW";

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

  // In AUTO mode, enqueue for posting with cumulative random 5–10 min gaps per site
  if (site.mode === "AUTO") {
    const redisKey = `auto:lastScheduled:${site.id}:${opportunity.platform}`;
    const now = Date.now();
    const gapMs = Math.floor(Math.random() * 300_000) + 300_000; // 5–10 min

    const lastScheduledStr = await redis.get(redisKey);
    const lastScheduled = lastScheduledStr ? parseInt(lastScheduledStr, 10) : 0;
    const earliest = Math.max(now, lastScheduled);
    const postAt = earliest + gapMs;
    const delayMs = postAt - now;

    // Store the scheduled time and expire the key after 1 hour
    await redis.set(redisKey, postAt.toString(), "EX", 3600);

    const delayMin = Math.round(delayMs / 60_000);
    await postingQueue.add("post", {
      commentId: comment.id,
    } satisfies PostingJobData, {
      delay: delayMs,
    });
    console.log(`[generation] AUTO mode: enqueued comment ${comment.id} for posting (delay: ${delayMin}m)`);
    await job.log(`AUTO mode: comment ${comment.id} enqueued for posting (delay: ~${delayMin}m)`);
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
