import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";

export const opportunityRouter = router({
  listPending: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const opportunities = await ctx.prisma.opportunity.findMany({
        where: {
          site: { userId: ctx.session.user.id },
          status: "PENDING_REVIEW",
        },
        include: {
          site: { select: { id: true, name: true, url: true } },
          comments: {
            where: { status: "DRAFT" },
            take: 1,
          },
        },
        orderBy: { relevanceScore: "desc" },
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
