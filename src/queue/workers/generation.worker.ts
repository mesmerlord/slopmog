import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import type { GenerationJobData, PostingJobData } from "@/queue/queues";
import { postingQueue } from "@/queue/queues";
import { generateComment } from "@/services/generation/generator";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import type { CommentGenerationInput } from "@/services/generation/types";

async function processGeneration(job: Job<GenerationJobData>) {
  const { opportunityId } = job.data;

  const opportunity = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { site: true },
  });

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

  const result = await generateComment(input);

  if (result.noRelevantComment) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "SKIPPED" },
    });
    console.log(`[generation] No relevant comment for opportunity ${opportunityId}, skipped`);
    return;
  }

  const best = result.best;
  const commentStatus = site.mode === "AUTO" ? "APPROVED" : "DRAFT";
  const opportunityStatus = site.mode === "AUTO" ? "APPROVED" : "PENDING_REVIEW";

  const comment = await prisma.comment.create({
    data: {
      opportunityId,
      siteId: site.id,
      status: commentStatus,
      text: best.text,
      persona: input.persona ?? "auto",
      qualityScore: best.qualityScore,
      scoreReasons: best.reasons,
    },
  });

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { status: opportunityStatus },
  });

  // In AUTO mode, immediately enqueue for posting
  if (site.mode === "AUTO") {
    await postingQueue.add("post", {
      commentId: comment.id,
    } satisfies PostingJobData);
    console.log(`[generation] AUTO mode: enqueued comment ${comment.id} for posting`);
  }

  console.log(`[generation] Generated comment for opportunity ${opportunityId} (${commentStatus})`);
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
});
