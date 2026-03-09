import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { hvDiscoveryQueue, hvGenerationQueue, type HVDiscoveryJobData, type HVGenerationJobData } from "@/queue/queues";
import { generateHVComment } from "@/services/generation/hv-generator";
import type { HVCommentGenerationInput } from "@/services/generation/hv-generator";
import type { CommentGenerationInput } from "@/services/generation/types";
import {
  getRedditComments,
  getYouTubeComments,
} from "@/services/discovery/scrape-creators";
import { parseDiscoveryConfig } from "@/services/discovery/config";

function toSingleLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " ").trim();
}

export const hvOpportunityRouter = router({
  triggerDiscovery: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: { id: true, active: true, discoveryConfig: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      if (!site.active) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Site is not active" });
      }

      const config = parseDiscoveryConfig(site.discoveryConfig);

      await hvDiscoveryQueue.add("hv-discover", {
        siteId: site.id,
        triggeredBy: "manual",
        queryCount: config.hvQueryCount,
      } satisfies HVDiscoveryJobData);

      return { queued: true };
    }),

  listPending: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        platform: z.enum(["REDDIT", "YOUTUBE"]).optional(),
        siteId: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        dateField: z.enum(["publishedAt", "createdAt"]).optional(),
        citingModel: z.string().optional(),
        sortBy: z.enum([
          "citation_score",
          "posted_newest",
          "posted_oldest",
          "queue_newest",
          "queue_oldest",
        ]).default("citation_score"),
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

      if (input.citingModel) {
        where.citingModels = { has: input.citingModel };
      }

      if (input.dateFrom || input.dateTo) {
        const field = input.dateField ?? "publishedAt";
        where[field] = {
          ...(input.dateFrom ? { gte: input.dateFrom } : {}),
          ...(input.dateTo ? { lte: input.dateTo } : {}),
        };
      }

      const normalizedSearch = input.search?.trim();
      if (normalizedSearch) {
        where.OR = [
          { title: { contains: normalizedSearch, mode: "insensitive" } },
          { sourceContext: { contains: normalizedSearch, mode: "insensitive" } },
          { site: { name: { contains: normalizedSearch, mode: "insensitive" } } },
        ];
      }

      const orderBy =
        input.sortBy === "citation_score"
          ? [{ citationScore: "desc" as const }, { createdAt: "desc" as const }]
          : input.sortBy === "posted_newest"
            ? [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }]
            : input.sortBy === "posted_oldest"
              ? [{ publishedAt: "asc" as const }, { createdAt: "asc" as const }]
              : input.sortBy === "queue_newest"
                ? [{ createdAt: "desc" as const }]
                : [{ createdAt: "asc" as const }];

      const [opportunities, filteredCount, totalPendingCount] = await Promise.all([
        ctx.prisma.hVOpportunity.findMany({
          where,
          include: {
            site: { select: { id: true, name: true, url: true } },
            hvComments: {
              where: { status: "DRAFT" },
              take: 1,
            },
          },
          orderBy,
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
        }),
        ctx.prisma.hVOpportunity.count({ where }),
        ctx.prisma.hVOpportunity.count({ where: baseWhere }),
      ]);

      let nextCursor: string | undefined;
      if (opportunities.length > input.limit) {
        const next = opportunities.pop();
        nextCursor = next?.id;
      }

      return { items: opportunities, nextCursor, filteredCount, totalPendingCount };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.hVOpportunity.findFirst({
        where: {
          id: input.id,
          site: { userId: ctx.session.user.id },
        },
        include: {
          site: { select: { id: true, name: true, url: true } },
          hvComments: true,
        },
      });

      if (!opportunity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HV Opportunity not found" });
      }

      return opportunity;
    }),

  generate: protectedProcedure
    .input(z.object({
      hvOpportunityId: z.string(),
      persona: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.hVOpportunity.findFirst({
        where: {
          id: input.hvOpportunityId,
          site: { userId: ctx.session.user.id },
        },
        include: {
          site: true,
          hvComments: { where: { status: "DRAFT" }, take: 1 },
        },
      });

      if (!opportunity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "HV Opportunity not found" });
      }

      // Already has a draft comment
      if (opportunity.hvComments.length > 0) {
        return opportunity.hvComments[0];
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
        }
      } catch (err) {
        console.warn(`[hvOpportunity.generate] Failed to fetch existing comments:`, err);
      }

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
        persona: input.persona,
        citationContext: {
          citingModels: opportunity.citingModels,
          citingQueries: opportunity.citingQueries,
          citationScore: opportunity.citationScore,
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
      const savedText = opportunity.platform === "YOUTUBE"
        ? result.variants.slice(0, 5).map((v) => toSingleLine(v.text)).filter(Boolean).join("\n")
        : best.text;

      const comment = await ctx.prisma.hVComment.create({
        data: {
          hvOpportunityId: opportunity.id,
          siteId: site.id,
          status: "DRAFT",
          text: savedText,
          persona: input.persona ?? "auto",
          qualityScore: best.qualityScore,
          scoreReasons: best.reasons,
        },
      });

      // Update opportunity status if needed
      if (opportunity.status === "DISCOVERED") {
        await ctx.prisma.hVOpportunity.update({
          where: { id: opportunity.id },
          data: { status: "PENDING_REVIEW" },
        });
      }

      return comment;
    }),

  getStats: protectedProcedure
    .input(z.object({ siteId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const siteFilter = input.siteId ? { siteId: input.siteId } : {};

      const [pending, posted, total] = await Promise.all([
        ctx.prisma.hVOpportunity.count({
          where: { site: { userId }, status: "PENDING_REVIEW", ...siteFilter },
        }),
        ctx.prisma.hVOpportunity.count({
          where: { site: { userId }, status: "POSTED", ...siteFilter },
        }),
        ctx.prisma.hVOpportunity.count({
          where: { site: { userId }, ...siteFilter },
        }),
      ]);

      return { pending, posted, total };
    }),

  getDiscoveryRuns: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: { id: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      return ctx.prisma.hVDiscoveryRun.findMany({
        where: { siteId: input.siteId },
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });
    }),

  getQueries: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: { id: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      return ctx.prisma.hVQuery.findMany({
        where: { siteId: input.siteId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  hasRunningDiscovery: protectedProcedure.query(async ({ ctx }) => {
    const runs = await ctx.prisma.hVDiscoveryRun.findMany({
      where: {
        status: "RUNNING",
        site: { userId: ctx.session.user.id },
      },
      select: {
        id: true,
        startedAt: true,
        site: { select: { id: true, name: true } },
      },
    });

    return {
      isRunning: runs.length > 0,
      runs: runs.map((r) => ({
        id: r.id,
        site: r.site,
        startedAt: r.startedAt.toISOString(),
      })),
    };
  }),
});
