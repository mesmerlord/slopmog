import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { hvPostingQueue, type HVPostingJobData } from "@/queue/queues";
import { PERSONA_MAP } from "@/constants/personas";
import { CREDIT_COSTS } from "@/constants/credits";
import { generateHVComment } from "@/services/generation/hv-generator";
import type { HVCommentGenerationInput } from "@/services/generation/hv-generator";
import { getUserPlan } from "@/server/utils/plan";
import { hasEnoughCredits } from "@/server/utils/credits";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import type { CommentGenerationInput } from "@/services/generation/types";

function toSingleLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
}

export const hvCommentRouter = router({
  approve: protectedProcedure
    .input(z.object({ hvCommentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.hVComment.findFirst({
        where: {
          id: input.hvCommentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
        include: { hvOpportunity: true },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HV Comment not found or not in DRAFT status" });
      }

      const plan = await getUserPlan(ctx.session.user.id);
      if (!plan.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Posting is available on paid plans only. Upgrade to publish comments.",
        });
      }

      const platformKey = comment.hvOpportunity.platform.toLowerCase() as "reddit" | "youtube";
      const creditCost = CREDIT_COSTS.highValue[platformKey];
      const creditCheck = await hasEnoughCredits(ctx.session.user.id, creditCost);
      if (!creditCheck.hasEnough) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `HV comments cost ${creditCost} credits. You have ${creditCheck.totalCredits}. Buy more on the billing page.`,
        });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.hVComment.update({
          where: { id: comment.id },
          data: { status: "APPROVED" },
        }),
        ctx.prisma.hVOpportunity.update({
          where: { id: comment.hvOpportunityId },
          data: { status: "APPROVED" },
        }),
      ]);

      await hvPostingQueue.add("hv-post", {
        hvCommentId: comment.id,
      } satisfies HVPostingJobData);

      return { success: true };
    }),

  skip: protectedProcedure
    .input(z.object({ hvCommentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.hVComment.findFirst({
        where: {
          id: input.hvCommentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HV Comment not found or not in DRAFT status" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.hVComment.update({
          where: { id: comment.id },
          data: { status: "SKIPPED" },
        }),
        ctx.prisma.hVOpportunity.update({
          where: { id: comment.hvOpportunityId },
          data: { status: "SKIPPED" },
        }),
      ]);

      return { success: true };
    }),

  edit: protectedProcedure
    .input(
      z.object({
        hvCommentId: z.string(),
        text: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.hVComment.findFirst({
        where: {
          id: input.hvCommentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HV Comment not found or not in DRAFT status" });
      }

      return ctx.prisma.hVComment.update({
        where: { id: comment.id },
        data: { text: input.text },
      });
    }),

  regenerate: protectedProcedure
    .input(
      z.object({
        hvCommentId: z.string(),
        persona: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.hVComment.findFirst({
        where: {
          id: input.hvCommentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
        include: {
          hvOpportunity: true,
          site: true,
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HV Comment not found or not in DRAFT status" });
      }

      const personaId = input.persona ?? comment.persona ?? "auto";
      if (personaId !== "auto" && !PERSONA_MAP[personaId]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid persona" });
      }

      let existingComments: CommentGenerationInput["existingComments"] = [];
      try {
        if (comment.hvOpportunity.platform === "REDDIT") {
          const comments = await getRedditComments(comment.hvOpportunity.contentUrl);
          existingComments = comments.slice(0, 15).map((c) => ({
            author: c.author, body: c.body, score: c.score, isOp: false,
          }));
        } else if (comment.hvOpportunity.platform === "YOUTUBE") {
          const comments = await getYouTubeComments(comment.hvOpportunity.contentUrl);
          existingComments = comments.slice(0, 15).map((c) => ({
            author: c.author, body: c.text, score: c.likeCount, isOp: false,
          }));
        }
      } catch (err) {
        console.warn(`[hvComment.regenerate] Failed to fetch existing comments for ${comment.id}:`, err);
      }

      const generationInput: HVCommentGenerationInput = {
        postTitle: comment.hvOpportunity.title,
        postBody: comment.hvOpportunity.body ?? "",
        sourceContext: comment.hvOpportunity.sourceContext,
        platform: comment.hvOpportunity.platform,
        existingComments,
        businessName: comment.site.name,
        businessDescription: comment.site.description,
        valueProps: comment.site.valueProps,
        websiteUrl: comment.site.url,
        brandTone: comment.site.brandTone,
        matchedKeyword: comment.hvOpportunity.citingQueries[0] ?? comment.site.name,
        commentPosition: "top_level",
        postType: "discussion",
        persona: personaId,
        citationContext: {
          citingModels: comment.hvOpportunity.citingModels,
          citingQueries: comment.hvOpportunity.citingQueries,
          citationScore: comment.hvOpportunity.citationScore,
        },
      };

      const result = await generateHVComment(generationInput);

      if (result.noRelevantComment || result.variants.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not generate a quality comment for this high-value opportunity",
        });
      }

      const best = result.best;
      const savedText = comment.hvOpportunity.platform === "YOUTUBE"
        ? result.variants.slice(0, 5).map((v) => toSingleLine(v.text)).filter(Boolean).join("\n")
        : best.text;

      return ctx.prisma.hVComment.update({
        where: { id: comment.id },
        data: {
          text: savedText,
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
        search: z.string().trim().max(120).optional(),
        platform: z.enum(["REDDIT", "YOUTUBE"]).optional(),
        siteId: z.string().optional(),
        sortBy: z.enum(["newest", "oldest", "quality"]).default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const baseWhere: Record<string, unknown> = {
        site: { userId: ctx.session.user.id },
        status: "POSTED" as const,
      };
      if (input.siteId) baseWhere.siteId = input.siteId;

      const where: Record<string, unknown> = { ...baseWhere };

      const normalizedSearch = input.search?.trim();
      if (input.platform && normalizedSearch) {
        where.AND = [
          { hvOpportunity: { platform: input.platform } },
          {
            OR: [
              { hvOpportunity: { title: { contains: normalizedSearch, mode: "insensitive" } } },
              { hvOpportunity: { sourceContext: { contains: normalizedSearch, mode: "insensitive" } } },
              { site: { name: { contains: normalizedSearch, mode: "insensitive" } } },
            ],
          },
        ];
      } else if (input.platform) {
        where.hvOpportunity = { platform: input.platform };
      } else if (normalizedSearch) {
        where.OR = [
          { hvOpportunity: { title: { contains: normalizedSearch, mode: "insensitive" } } },
          { hvOpportunity: { sourceContext: { contains: normalizedSearch, mode: "insensitive" } } },
          { site: { name: { contains: normalizedSearch, mode: "insensitive" } } },
        ];
      }

      const orderBy =
        input.sortBy === "newest"
          ? [{ postedAt: "desc" as const }]
          : input.sortBy === "oldest"
            ? [{ postedAt: "asc" as const }]
            : [{ qualityScore: "desc" as const }, { postedAt: "desc" as const }];

      const [comments, filteredCount, totalCount] = await Promise.all([
        ctx.prisma.hVComment.findMany({
          where,
          include: {
            hvOpportunity: {
              select: {
                title: true,
                contentUrl: true,
                platform: true,
                sourceContext: true,
                citingModels: true,
                citationScore: true,
              },
            },
            site: { select: { name: true } },
          },
          orderBy,
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
        }),
        ctx.prisma.hVComment.count({ where }),
        ctx.prisma.hVComment.count({ where: baseWhere }),
      ]);

      let nextCursor: string | undefined;
      if (comments.length > input.limit) {
        const next = comments.pop();
        nextCursor = next?.id;
      }

      return { items: comments, nextCursor, filteredCount, totalCount };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [draft, posted, failed] = await Promise.all([
      ctx.prisma.hVComment.count({
        where: { site: { userId }, status: "DRAFT" },
      }),
      ctx.prisma.hVComment.count({
        where: { site: { userId }, status: "POSTED" },
      }),
      ctx.prisma.hVComment.count({
        where: { site: { userId }, status: "FAILED" },
      }),
    ]);

    return { draft, posted, failed };
  }),
});
