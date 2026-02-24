import { Worker, Job } from "bullmq";
import { redisConnection } from "@/server/utils/redis";
import { prisma } from "@/server/utils/db";
import { fetchPostContext } from "@/services/reddit/context";
import { generateComment } from "@/services/generation/comment-generator";
import { addToPostingQueue } from "./queues";
import type { PostGenerationJobData } from "./queues";

const processPostGeneration = async (job: Job<PostGenerationJobData>) => {
  const { opportunityId } = job.data;
  console.log(`[post-generation] Generating comment for opportunity ${opportunityId}`);

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { campaign: true },
  });

  if (!opportunity) {
    console.log(`[post-generation] Opportunity ${opportunityId} not found`);
    return;
  }

  if (opportunity.status !== "APPROVED" && opportunity.status !== "GENERATING") {
    console.log(`[post-generation] Opportunity ${opportunityId} status is ${opportunity.status}, skipping`);
    return;
  }

  // Mark as generating
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { status: "GENERATING" },
  });

  try {
    // Fetch full post context from Reddit
    const context = await fetchPostContext({
      redditUrl: opportunity.redditUrl,
      parentCommentId: opportunity.parentCommentId ?? undefined,
    });

    // Generate comment
    const campaign = opportunity.campaign;
    const result = await generateComment({
      postTitle: context.post.title,
      postBody: context.post.selftext,
      subreddit: opportunity.subreddit,
      existingComments: context.topComments.map((c) => ({
        author: c.author,
        body: c.body,
        score: c.score,
        isOp: c.isOp,
      })),
      replyTarget: context.replyTarget
        ? {
            commentId: context.replyTarget.commentId,
            commentBody: context.replyTarget.commentBody,
            commentAuthor: context.replyTarget.commentAuthor,
          }
        : undefined,
      businessName: campaign.businessName || campaign.name,
      businessDescription: campaign.businessDescription || campaign.description || "",
      valueProps: (campaign.valueProps as string[]) ?? [],
      websiteUrl: campaign.websiteUrl ?? undefined,
      brandTone: campaign.brandTone || "friendly",
      matchedKeyword: opportunity.matchedKeyword,
      commentPosition: context.suggestedPosition,
    });

    if (result.noRelevantComment) {
      // Model decided no natural comment fits — skip this opportunity
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { status: "SKIPPED", metadata: { skipReason: "no_relevant_comment" } },
      });
      console.log(`[post-generation] No relevant comment for opportunity ${opportunityId}`);
      return;
    }

    // Store generated comment
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        generatedComment: result.best.text,
        commentVersion: { increment: 1 },
        metadata: {
          qualityScore: result.best.qualityScore,
          qualityReasons: result.best.reasons,
          variants: result.variants.length,
        },
      },
    });

    const automationMode = campaign.automationMode;

    if (automationMode === "FULL_MANUAL") {
      // Wait for user to review the generated comment
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { status: "READY_FOR_REVIEW" },
      });
      console.log(`[post-generation] Comment ready for review: ${opportunityId}`);
    } else {
      // SEMI_AUTO or AUTOPILOT: auto-enqueue posting with smart scheduling
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { status: "POSTING" },
      });

      // Smart scheduling: add jitter to look natural
      const baseDelay = 30 * 1000; // 30 seconds minimum
      const maxJitter = 5 * 60 * 1000; // Up to 5 minutes random
      const delay = baseDelay + Math.floor(Math.random() * maxJitter);

      await addToPostingQueue({ opportunityId }, { delay });
      console.log(`[post-generation] Enqueued posting for ${opportunityId} with ${Math.round(delay / 1000)}s delay`);
    }
  } catch (error) {
    console.error(`[post-generation] Failed for ${opportunityId}:`, error);
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "FAILED", metadata: { error: String(error) } },
    });
    throw error; // Re-throw for BullMQ retry
  }
};

const worker = new Worker("post-generation", processPostGeneration, {
  connection: redisConnection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`[post-generation] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[post-generation] Job ${job?.id} failed:`, err.message);
});
