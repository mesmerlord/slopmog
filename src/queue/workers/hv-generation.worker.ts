import { Worker, type Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { type HVGenerationJobData, jobLog, jobWarn, jobError } from "@/queue/queues";
import { generateHVComment } from "@/services/generation/hv-generator";
import type { HVCommentGenerationInput } from "@/services/generation/hv-generator";
import type { CommentGenerationInput } from "@/services/generation/types";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";

function toSingleLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
}

async function processHVGeneration(job: Job<HVGenerationJobData>) {
  const { hvOpportunityId } = job.data;

  await jobLog(job, "hv-generation", `Generating HV comment for opportunity ${hvOpportunityId}`);

  // 1. Load opportunity with site context
  const opportunity = await prisma.hVOpportunity.findUniqueOrThrow({
    where: { id: hvOpportunityId },
    include: { site: true },
  });

  // 2. Set status to GENERATING
  await prisma.hVOpportunity.update({
    where: { id: hvOpportunityId },
    data: { status: "GENERATING" },
  });

  try {
    // 3. Fetch existing comments from thread
    let existingComments: CommentGenerationInput["existingComments"] = [];
    try {
      if (opportunity.platform === "REDDIT") {
        const comments = await getRedditComments(opportunity.contentUrl);
        existingComments = comments.slice(0, 15).map((c) => ({
          author: c.author,
          body: c.body,
          score: c.score,
          isOp: false,
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
      await jobWarn(job, "hv-generation", `Failed to fetch existing comments for ${hvOpportunityId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Generate HV comment with citation context
    const site = opportunity.site;
    const generationInput: HVCommentGenerationInput = {
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
      matchedKeyword: opportunity.citingQueries[0] ?? site.name,
      commentPosition: "top_level",
      postType: "discussion",
      citationContext: {
        citingModels: opportunity.citingModels,
        citingQueries: opportunity.citingQueries,
        citationScore: opportunity.citationScore,
      },
    };

    const result = await generateHVComment(generationInput);

    // 5. Handle result
    if (result.noRelevantComment || result.variants.length === 0) {
      await jobLog(job, "hv-generation", `No relevant comment possible for ${hvOpportunityId}, marking as SKIPPED`);
      await prisma.hVOpportunity.update({
        where: { id: hvOpportunityId },
        data: { status: "SKIPPED" },
      });
      return;
    }

    const best = result.best;
    const savedText = opportunity.platform === "YOUTUBE"
      ? result.variants.slice(0, 5).map((v) => toSingleLine(v.text)).filter(Boolean).join("\n")
      : best.text;

    // 6. Save as DRAFT (always manual for HV)
    await prisma.hVComment.create({
      data: {
        hvOpportunityId: opportunity.id,
        siteId: site.id,
        status: "DRAFT",
        text: savedText,
        persona: "auto",
        qualityScore: best.qualityScore,
        scoreReasons: best.reasons,
      },
    });

    // 7. Set opportunity to PENDING_REVIEW
    await prisma.hVOpportunity.update({
      where: { id: hvOpportunityId },
      data: { status: "PENDING_REVIEW" },
    });

    await jobLog(job, "hv-generation", `HV comment generated for ${hvOpportunityId} (quality: ${best.qualityScore})`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await jobError(job, "hv-generation", `Failed for ${hvOpportunityId}: ${errorMessage}`);

    // Revert to DISCOVERED so it can be retried
    await prisma.hVOpportunity.update({
      where: { id: hvOpportunityId },
      data: { status: "DISCOVERED" },
    });

    throw err;
  }
}

export const hvGenerationWorker = new Worker<HVGenerationJobData>(
  "hv-generation",
  processHVGeneration,
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

hvGenerationWorker.on("completed", (job) => {
  void jobLog(job, "hv-generation", `Job ${job.id} completed`);
});

hvGenerationWorker.on("failed", (job, err) => {
  if (job) void jobError(job, "hv-generation", `Job ${job.id} failed: ${err.message}`);
});
