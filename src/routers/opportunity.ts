import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { addToPostGenerationQueue, addToPostingQueue } from "@/queue/queues";
import { getUserPlan } from "@/server/utils/plan";

// ─── Recommended score computation ──────────────────────────────
//
// Goal: surface the highest-ROI opportunities first.
// ROI = "how natural is our comment" × "how many people will see it on Google"
//
// Relevance gates everything (multiplicative). A 1.0 relevance on a dead
// thread is worth less than 0.7 relevance on a 300-upvote thread.
//
// Google discoverability is the payoff: upvotes, comments, and post type
// (questions/recommendations rank highest in Google AI overviews).
//
// Urgency is a tiebreaker: fresh posts with traction get a bump because
// commenting early = more upvotes on our comment. Old popular posts still
// have value since they're already indexed.

function computeRecommendedScore(item: {
  relevanceScore: number;
  score: number;
  numComments: number;
  redditCreatedAt: Date | null;
  postType: string | null;
  generatedComment: string | null;
}): number {
  // ── Google Discoverability (0-1) ──
  // Upvotes: strongest Google signal. Log scale, caps around 10k.
  const upvoteSignal = Math.min(Math.log10(Math.max(item.score, 1) + 1) / 4, 1);

  // Comments: engagement signal, more = more Google weight. Caps around 1k.
  const commentSignal = Math.min(Math.log10(Math.max(item.numComments, 1) + 1) / 3, 1);

  // Post type: questions/recommendations rank highest in Google AI overviews
  const postTypeMultiplier =
    item.postType === "question" ? 1.3
    : item.postType === "discussion" ? 1.0
    : item.postType === "showcase" ? 0.7
    : 1.0; // null/unknown = neutral

  const googleRaw = upvoteSignal * 0.55 + commentSignal * 0.45;
  const google = Math.min(googleRaw * postTypeMultiplier, 1);

  // ── Time Pressure (0-1) ──
  // Fresh posts: commenting early gets us upvotes on our comment.
  // Old popular posts: already indexed, still valuable but less urgent.
  const ageHours = item.redditCreatedAt
    ? (Date.now() - new Date(item.redditCreatedAt).getTime()) / (1000 * 60 * 60)
    : 720; // unknown = treat as 30 days

  let timePressure: number;
  if (ageHours < 6) timePressure = 1.0;
  else if (ageHours < 24) timePressure = 0.85;
  else if (ageHours < 72) timePressure = 0.6;
  else if (ageHours < 168) timePressure = 0.35;    // < 1 week
  else if (ageHours < 720) timePressure = 0.15;    // < 30 days
  else timePressure = 0.05;                          // > 30 days

  // Old popular posts still have value — floor based on engagement
  if (item.score >= 50 || item.numComments >= 30) {
    timePressure = Math.max(timePressure, 0.3);
  }

  // ── Actionability (0-1) ──
  const actionability = item.generatedComment ? 1.0 : 0.0;

  // ── Final score ──
  // Relevance is multiplicative: it gates everything.
  // A 0.5 relevance halves the entire score.
  const baseScore =
    google * 0.45 +
    timePressure * 0.35 +
    actionability * 0.20;

  const finalScore = item.relevanceScore * baseScore;

  return Math.round(finalScore * 1000) / 1000;
}

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
        sort: z.enum(["recommended", "newest", "relevance", "upvotes", "postDate"]).optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const isRecommended = input.sort === "recommended" || !input.sort;

      const orderBy = isRecommended
        ? { discoveredAt: "desc" as const } // fetch recent, then re-sort in JS
        : input.sort === "relevance"
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

      const campaignWhere = {
        campaignId: input.campaignId
          ? { equals: input.campaignId, in: campaignIds }
          : { in: campaignIds },
        isArchived: false,
      };

      const where = {
        ...campaignWhere,
        status: input.status ?? undefined,
        subreddit: input.subreddit ?? undefined,
        relevanceScore: input.minRelevance ? { gte: input.minRelevance } : undefined,
      };

      // Counts: use base campaign filter only (no status/relevance) so all tabs show counts
      const countsPromise = !input.cursor
        ? ctx.prisma.$transaction([
            ctx.prisma.opportunity.groupBy({ by: ["status"], where: campaignWhere, orderBy: { status: "asc" }, _count: { _all: true } }),
            ctx.prisma.opportunity.count({ where: campaignWhere }),
            ctx.prisma.opportunity.count({ where: { ...campaignWhere, relevanceScore: { gte: 0.4 } } }),
            ctx.prisma.opportunity.count({ where: { ...campaignWhere, relevanceScore: { gte: 0.5 } } }),
            ctx.prisma.opportunity.count({ where: { ...campaignWhere, relevanceScore: { gte: 0.6 } } }),
            ctx.prisma.opportunity.count({ where: { ...campaignWhere, relevanceScore: { gte: 0.8 } } }),
          ])
        : null; // Skip counts on paginated requests (cursor = "load more")

      // Resolve counts (runs in parallel with main query below)
      const resolveCounts = async () => {
        if (!countsPromise) return undefined;
        const [statusGroups, total, rel40, rel50, rel60, rel80] = await countsPromise;
        const byStatus: Record<string, number> = {};
        for (const g of statusGroups) {
          const c = g._count;
          byStatus[g.status] = typeof c === "object" && c ? (c._all ?? 0) : 0;
        }
        return {
          byStatus,
          total,
          byRelevance: { all: total, "0.4": rel40, "0.5": rel50, "0.6": rel60, "0.8": rel80 },
        };
      };

      if (isRecommended) {
        // For recommended sort: fetch a generous batch, score in JS, then paginate
        const batchSize = 200;
        const [allItems, counts] = await Promise.all([
          ctx.prisma.opportunity.findMany({
            where,
            orderBy: { discoveredAt: "desc" as const },
            take: batchSize,
            include: { campaign: { select: { name: true, automationMode: true } } },
          }),
          resolveCounts(),
        ]);

        // Compute recommended score for each item
        const scored = allItems.map((item) => ({
          ...item,
          recommendedScore: computeRecommendedScore(item),
        }));

        // Sort by recommended score descending
        scored.sort((a, b) => b.recommendedScore - a.recommendedScore);

        // Apply offset-based pagination using cursor as a marker
        const startIdx = input.cursor
          ? scored.findIndex((item) => item.id === input.cursor) + 1
          : 0;
        const page = scored.slice(startIdx, startIdx + limit + 1);

        let nextCursor: string | undefined;
        if (page.length > limit) {
          const next = page.pop();
          nextCursor = next?.id;
        }

        return { items: page, nextCursor, counts };
      }

      // Non-recommended sorts: standard cursor pagination
      const [items, counts] = await Promise.all([
        ctx.prisma.opportunity.findMany({
          where,
          orderBy,
          take: limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          include: { campaign: { select: { name: true, automationMode: true } } },
        }),
        resolveCounts(),
      ]);

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      // Add recommendedScore for all sorts (useful for display)
      const withScore = items.map((item) => ({
        ...item,
        recommendedScore: computeRecommendedScore(item),
      }));

      return { items: withScore, nextCursor, counts };
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

      // Enqueue posting immediately
      await addToPostingQueue({ opportunityId: input.id });

      return updated;
    }),

  regenerateComment: protectedProcedure
    .input(z.object({ id: z.string(), persona: z.string().optional() }))
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

      // Keep current status — don't change to GENERATING so item stays in its tab
      const updated = await ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: {
          generatedComment: null,
          persona: input.persona ?? null,
        },
      });

      await addToPostGenerationQueue({ opportunityId: input.id });

      return updated;
    }),

  retry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      if (opportunity.status !== "FAILED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed opportunities can be retried" });
      }

      if (!opportunity.generatedComment) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No generated comment to retry with" });
      }

      // Free tier posting gate
      const plan = await getUserPlan(ctx.session.user.id);
      if (!plan.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You need a paid plan to post comments.",
        });
      }

      // Reset to READY_FOR_REVIEW so user can re-approve
      const updated = await ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: {
          status: "READY_FOR_REVIEW",
          externalOrderId: null,
          providerUsed: null,
          metadata: {},
        },
      });

      return updated;
    }),

  retryDirect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const opportunity = await ctx.prisma.opportunity.findUnique({
        where: { id: input.id },
        include: { campaign: { select: { userId: true } } },
      });

      if (!opportunity || opportunity.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
      }

      if (opportunity.status !== "FAILED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed opportunities can be retried" });
      }

      if (!opportunity.generatedComment) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No generated comment to retry with" });
      }

      const plan = await getUserPlan(ctx.session.user.id);
      if (!plan.canPost) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You need a paid plan to post comments.",
        });
      }

      // Go straight to POSTING and enqueue
      const updated = await ctx.prisma.opportunity.update({
        where: { id: input.id },
        data: {
          status: "POSTING",
          externalOrderId: null,
          providerUsed: null,
          metadata: {},
        },
      });

      await addToPostingQueue({ opportunityId: input.id });

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
