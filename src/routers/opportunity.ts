import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";

export const opportunityRouter = router({
  listPending: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        platform: z.enum(["REDDIT", "YOUTUBE"]).optional(),
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
      const baseWhere = {
        site: { userId: ctx.session.user.id },
        status: "PENDING_REVIEW" as const,
      };

      const where: Record<string, unknown> = { ...baseWhere };
      if (input.platform) where.platform = input.platform;

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
        platform: z.enum(["REDDIT", "YOUTUBE"]).optional(),
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
