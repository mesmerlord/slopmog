import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { postingQueue, type PostingJobData } from "@/queue/queues";
import { PERSONA_MAP } from "@/constants/personas";
import { generateComment } from "@/services/generation/generator";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import type { CommentGenerationInput } from "@/services/generation/types";

function toSingleLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
}

export const commentRouter = router({
  approve: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
        include: { opportunity: true },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.comment.update({
          where: { id: comment.id },
          data: { status: "APPROVED" },
        }),
        ctx.prisma.opportunity.update({
          where: { id: comment.opportunityId },
          data: { status: "APPROVED" },
        }),
      ]);

      await postingQueue.add("post", {
        commentId: comment.id,
      } satisfies PostingJobData);

      return { success: true };
    }),

  skip: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.comment.update({
          where: { id: comment.id },
          data: { status: "SKIPPED" },
        }),
        ctx.prisma.opportunity.update({
          where: { id: comment.opportunityId },
          data: { status: "SKIPPED" },
        }),
      ]);

      return { success: true };
    }),

  edit: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
        text: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      return ctx.prisma.comment.update({
        where: { id: comment.id },
        data: { text: input.text },
      });
    }),

  regenerate: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
        persona: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
        include: {
          opportunity: true,
          site: true,
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      const personaId = input.persona ?? comment.persona ?? "auto";
      if (!PERSONA_MAP[personaId]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid persona" });
      }

      let existingComments: CommentGenerationInput["existingComments"] = [];

      try {
        if (comment.opportunity.platform === "REDDIT") {
          const comments = await getRedditComments(comment.opportunity.contentUrl);
          existingComments = comments.slice(0, 15).map((c) => ({
            author: c.author,
            body: c.body,
            score: c.score,
            isOp: false,
          }));
        } else if (comment.opportunity.platform === "YOUTUBE") {
          const comments = await getYouTubeComments(comment.opportunity.contentUrl);
          existingComments = comments.slice(0, 15).map((c) => ({
            author: c.author,
            body: c.text,
            score: c.likeCount,
            isOp: false,
          }));
        }
      } catch (err) {
        console.warn(`[comment.regenerate] Failed to fetch existing comments for ${comment.id}:`, err);
      }

      const generationInput: CommentGenerationInput = {
        postTitle: comment.opportunity.title,
        postBody: comment.opportunity.body ?? "",
        sourceContext: comment.opportunity.sourceContext,
        platform: comment.opportunity.platform,
        existingComments,
        businessName: comment.site.name,
        businessDescription: comment.site.description,
        valueProps: comment.site.valueProps,
        websiteUrl: comment.site.url,
        brandTone: comment.site.brandTone,
        matchedKeyword: comment.opportunity.matchedKeyword,
        commentPosition: "top_level",
        postType: (comment.opportunity.postType as "question" | "discussion" | "showcase") ?? "discussion",
        persona: personaId,
      };

      const result = await generateComment(generationInput);

      if (result.noRelevantComment || result.variants.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not generate a natural comment for this opportunity",
        });
      }

      const best = result.best;
      const youtubeCombinedText = result.variants
        .slice(0, 5)
        .map((variant) => toSingleLine(variant.text))
        .filter(Boolean)
        .join("\n");
      const nextText = comment.opportunity.platform === "YOUTUBE"
        ? youtubeCombinedText
        : best.text;

      return ctx.prisma.comment.update({
        where: { id: comment.id },
        data: {
          text: nextText,
          persona: personaId,
          qualityScore: best.qualityScore,
          scoreReasons: best.reasons,
        },
      });
    }),

  listPosted: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const comments = await ctx.prisma.comment.findMany({
        where: {
          site: { userId: ctx.session.user.id },
          status: "POSTED",
        },
        include: {
          opportunity: {
            select: {
              title: true,
              contentUrl: true,
              platform: true,
              sourceContext: true,
            },
          },
          site: { select: { name: true } },
        },
        orderBy: { postedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (comments.length > input.limit) {
        const next = comments.pop();
        nextCursor = next?.id;
      }

      return { items: comments, nextCursor };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [draft, posted, failed] = await Promise.all([
      ctx.prisma.comment.count({
        where: { site: { userId }, status: "DRAFT" },
      }),
      ctx.prisma.comment.count({
        where: { site: { userId }, status: "POSTED" },
      }),
      ctx.prisma.comment.count({
        where: { site: { userId }, status: "FAILED" },
      }),
    ]);

    return { draft, posted, failed };
  }),
});
