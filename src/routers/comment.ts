import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";

export const commentRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        subreddit: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;

      const userCampaigns = await ctx.prisma.campaign.findMany({
        where: { userId: ctx.session.user.id },
        select: { id: true },
      });
      const campaignIds = userCampaigns.map((c) => c.id);

      const items = await ctx.prisma.opportunity.findMany({
        where: {
          campaignId: input.campaignId
            ? { equals: input.campaignId, in: campaignIds }
            : { in: campaignIds },
          subreddit: input.subreddit ?? undefined,
          status: "POSTED",
        },
        orderBy: { postedAt: "desc" },
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          campaign: { select: { name: true, businessName: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id, status: "POSTED" },
        include: {
          campaign: {
            select: { name: true, userId: true, businessName: true },
          },
        },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      return opportunity;
    }),
});
