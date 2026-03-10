import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { generateComment } from "@/services/generation/generator";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import { fetchTweetReplies } from "@/services/discovery/twitter-discovery";
import type { CommentGenerationInput } from "@/services/generation/types";

export const opportunityRouter = router({
  listPending: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        platform: z.enum(["REDDIT", "YOUTUBE", "TWITTER"]).optional(),
        siteId: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        dateField: z.enum(["publishedAt", "createdAt"]).optional(),
        sortBy: z.enum([
          "best_match",
          "posted_newest",
          "posted_oldest",
          "queue_newest",
          "queue_oldest",
        ]).default("best_match"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const baseWhere: Record<string, unknown> = {
        site: { userId: ctx.session.user.id },
        status: "PENDING_REVIEW" as const,
      };
      if (input.siteId) baseWhere.siteId = input.siteId;

      const where: Record<string, unknown> = { ...baseWhere };
      if (input.platform) where.platform = input.platform;

      if (input.dateFrom || input.dateTo) {
        const field = input.dateField ?? "publishedAt";
        const dateFilter: Record<string, unknown> = {};
        if (input.dateFrom) dateFilter.gte = input.dateFrom;
        if (input.dateTo) dateFilter.lte = input.dateTo;
        where[field] = dateFilter;
      }

      const normalizedSearch = input.search?.trim();
      if (normalizedSearch) {
        where.OR = [
          { title: { contains: normalizedSearch, mode: "insensitive" } },
          { sourceContext: { contains: normalizedSearch, mode: "insensitive" } },
          { matchedKeyword: { contains: normalizedSearch, mode: "insensitive" } },
          { site: { name: { contains: normalizedSearch, mode: "insensitive" } } },
        ];
      }

      const orderBy =
        input.sortBy === "best_match"
          ? [{ relevanceScore: "desc" as const }, { createdAt: "desc" as const }]
          : input.sortBy === "posted_newest"
            ? [{ publishedAt: "desc" as const }, { relevanceScore: "desc" as const }]
            : input.sortBy === "posted_oldest"
              ? [{ publishedAt: "asc" as const }, { relevanceScore: "desc" as const }]
              : input.sortBy === "queue_newest"
                ? [{ createdAt: "desc" as const }]
                : [{ createdAt: "asc" as const }];

      const [opportunities, filteredCount, totalPendingCount] = await Promise.all([
        ctx.prisma.opportunity.findMany({
          where,
          include: {
            site: { select: { id: true, name: true, url: true } },
            comments: {
              where: { status: "DRAFT" },
              take: 1,
            },
          },
          orderBy,
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
        }),
        ctx.prisma.opportunity.count({ where }),
        ctx.prisma.opportunity.count({ where: baseWhere }),
      ]);

      let nextCursor: string | undefined;
      if (opportunities.length > input.limit) {
        const next = opportunities.pop();
        nextCursor = next?.id;
      }

      return { items: opportunities, nextCursor, filteredCount, totalPendingCount };
    }),

  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        status: z.enum([
          "DISCOVERED", "GENERATING", "PENDING_REVIEW",
          "APPROVED", "POSTING", "POSTED", "SKIPPED", "FAILED",
        ]).optional(),
        platform: z.enum(["REDDIT", "YOUTUBE", "TWITTER"]).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        siteId: input.siteId,
        site: { userId: ctx.session.user.id },
      };
      if (input.status) where.status = input.status;
      if (input.platform) where.platform = input.platform;

      const opportunities = await ctx.prisma.opportunity.findMany({
        where,
        include: {
          comments: { take: 1, orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (opportunities.length > input.limit) {
        const next = opportunities.pop();
        nextCursor = next?.id;
      }

      return { items: opportunities, nextCursor };
    }),

  generate: protectedProcedure
    .input(z.object({
      opportunityId: z.string(),
      persona: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findFirst({
        where: {
          id: input.opportunityId,
          site: { userId: ctx.session.user.id },
          status: "PENDING_REVIEW",
        },
        include: {
          site: true,
          comments: { where: { status: "DRAFT" }, take: 1 },
        },
      });

      if (!opportunity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found or not pending" });
      }

      // Already has a draft comment
      if (opportunity.comments.length > 0) {
        return opportunity.comments[0];
      }

      let existingComments: CommentGenerationInput["existingComments"] = [];
      try {
        if (opportunity.platform === "REDDIT") {
          const comments = await getRedditComments(opportunity.contentUrl);
          existingComments = comments.slice(0, 15).map((c) => ({
            author: c.author, body: c.body, score: c.score, isOp: false,
          }));
        } else if (opportunity.platform === "YOUTUBE") {
          const comments = await getYouTubeComments(opportunity.contentUrl);
          existingComments = comments.slice(0, 15).map((c) => ({
            author: c.author, body: c.text, score: c.likeCount, isOp: false,
          }));
        } else if (opportunity.platform === "TWITTER") {
          const replies = await fetchTweetReplies(opportunity.contentUrl);
          existingComments = replies.slice(0, 15).map((r) => ({
            author: r.author, body: r.text, score: r.likes, isOp: false,
          }));
        }
      } catch (err) {
        console.warn(`[opportunity.generate] Failed to fetch existing comments:`, err);
      }

      const site = opportunity.site;
      const result = await generateComment({
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
        persona: input.persona,
      });

      if (result.noRelevantComment || result.variants.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not generate a natural comment for this opportunity",
        });
      }

      const best = result.best;
      const toSingleLine = (text: string) => text.replace(/\s*\n+\s*/g, " ").trim();
      const savedText = opportunity.platform === "YOUTUBE"
        ? result.variants.slice(0, 5).map((v) => toSingleLine(v.text)).filter(Boolean).join("\n")
        : best.text;

      return ctx.prisma.comment.create({
        data: {
          opportunityId: opportunity.id,
          siteId: site.id,
          status: "DRAFT",
          text: savedText,
          persona: input.persona ?? "auto",
          qualityScore: best.qualityScore,
          scoreReasons: best.reasons,
        },
      });
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [pending, posted, total] = await Promise.all([
      ctx.prisma.opportunity.count({
        where: { site: { userId }, status: "PENDING_REVIEW" },
      }),
      ctx.prisma.opportunity.count({
        where: { site: { userId }, status: "POSTED" },
      }),
      ctx.prisma.opportunity.count({
        where: { site: { userId } },
      }),
    ]);

    return { pending, posted, total };
  }),
});
