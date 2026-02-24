import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { addToPostGenerationQueue, addToPostingQueue } from "@/queue/queues";
import { getUserPlan } from "@/server/utils/plan";

export const opportunityRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        status: z
          .enum([
            "DISCOVERED",
            "PENDING_REVIEW",
            "APPROVED",
            "GENERATING",
            "READY_FOR_REVIEW",
            "POSTING",
            "POSTED",
            "REJECTED",
            "SKIPPED",
            "FAILED",
            "EXPIRED",
          ])
          .optional(),
        subreddit: z.string().optional(),
        minRelevance: z.number().min(0).max(1).optional(),
        sort: z.enum(["newest", "relevance", "upvotes", "postDate"]).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const orderBy =
        input.sort === "relevance"
          ? { relevanceScore: "desc" as const }
          : input.sort === "upvotes"
            ? { score: "desc" as const }
            : input.sort === "postDate"
              ? [{ redditCreatedAt: "desc" as const }, { discoveredAt: "desc" as const }]
              : { discoveredAt: "desc" as const };

      // Get all campaign IDs for this user
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
          status: input.status ?? undefined,
          subreddit: input.subreddit ?? undefined,
          relevanceScore: input.minRelevance ? { gte: input.minRelevance } : undefined,
          isArchived: false,
        },
        orderBy,
        take: limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          campaign: { select: { name: true, automationMode: true } },
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
        where: { id: input.id },
        include: {
          campaign: {
            select: {
              name: true,
              userId: true,
              automationMode: true,
              businessName: true,
            },
          },
        },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      return opportunity;
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userCampaigns = await ctx.prisma.campaign.findMany({
      where: { userId: ctx.session.user.id },
      select: { id: true },
    });

    const count = await ctx.prisma.opportunity.count({
      where: {
        campaignId: { in: userCampaigns.map((c) => c.id) },
        status: { in: ["PENDING_REVIEW", "READY_FOR_REVIEW"] },
        isArchived: false,
      },
    });

    return { count };
  }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true, automationMode: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      if (opportunity.status !== "PENDING_REVIEW") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Opportunity is not pending review" });
      }

      // Free tier posting gate
      const plan = await getUserPlan(ctx.session.user.id);
      if (!plan.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can see opportunities for free, but you need a paid plan to actually post comments. Pretty sneaky, huh?",
        });
      }

      const updated = await ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: { status: "APPROVED" },
      });

      // Enqueue comment generation
      await addToPostGenerationQueue({ opportunityId: input.id });

      return updated;
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      return ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: { status: "REJECTED" },
      });
    }),

  bulkApprove: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      // Free tier posting gate
      const plan = await getUserPlan(ctx.session.user.id);
      if (!plan.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can see opportunities for free, but you need a paid plan to actually post comments. Pretty sneaky, huh?",
        });
      }

      // Verify ownership of all opportunities
      const opportunities = await ctx.prisma.opportunity.findMany({
        where: { id: { in: input.ids } },
        include: { campaign: { select: { userId: true } } },
      });

      const owned = opportunities.filter(
        (o) => o.campaign.userId === ctx.session.user.id && o.status === "PENDING_REVIEW",
      );

      if (owned.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No valid opportunities to approve" });
      }

      const ownedIds = owned.map((o) => o.id);

      await ctx.prisma.opportunity.updateMany({
        where: { id: { in: ownedIds } },
        data: { status: "APPROVED" },
      });

      // Enqueue generation for each
      for (const id of ownedIds) {
        await addToPostGenerationQueue({ opportunityId: id });
      }

      return { approved: ownedIds.length };
    }),

  bulkReject: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const opportunities = await ctx.prisma.opportunity.findMany({
        where: { id: { in: input.ids } },
        include: { campaign: { select: { userId: true } } },
      });

      const owned = opportunities.filter(
        (o) => o.campaign.userId === ctx.session.user.id,
      );
      const ownedIds = owned.map((o) => o.id);

      await ctx.prisma.opportunity.updateMany({
        where: { id: { in: ownedIds } },
        data: { status: "REJECTED" },
      });

      return { rejected: ownedIds.length };
    }),

  approveComment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      if (opportunity.status !== "READY_FOR_REVIEW") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Comment is not ready for review" });
      }

      if (!opportunity.generatedComment) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No generated comment to approve" });
      }

      // Free tier posting gate
      const plan = await getUserPlan(ctx.session.user.id);
      if (!plan.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can see opportunities for free, but you need a paid plan to actually post comments. Pretty sneaky, huh?",
        });
      }

      const updated = await ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: { status: "POSTING" },
      });

      // Enqueue posting with smart delay
      const delay = 30000 + Math.floor(Math.random() * 300000); // 30s - 5.5min
      await addToPostingQueue({ opportunityId: input.id }, { delay });

      return updated;
    }),

  regenerateComment: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      if (!["READY_FOR_REVIEW", "APPROVED"].includes(opportunity.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot regenerate at this stage" });
      }

      const updated = await ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: { status: "APPROVED", generatedComment: null },
      });

      await addToPostGenerationQueue({ opportunityId: input.id });

      return updated;
    }),

  editComment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        comment: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      return ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: {
          generatedComment: input.comment,
          commentVersion: { increment: 1 },
        },
      });
    }),
});
