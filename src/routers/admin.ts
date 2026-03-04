import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc";

export const adminRouter = router({
  getOverviewStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      paidUsers,
      activeSites,
      commentsToday,
      pendingReview,
      discoveryRuns,
      creditsResult,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.user.count({
        where: {
          stripeCustomer: {
            subscriptions: { some: { status: { in: ["active", "trialing"] } } },
          },
        },
      }),
      ctx.prisma.site.count({ where: { active: true } }),
      ctx.prisma.comment.count({
        where: { status: "POSTED", postedAt: { gte: todayStart } },
      }),
      ctx.prisma.comment.count({ where: { status: "DRAFT" } }),
      ctx.prisma.discoveryRun.count(),
      ctx.prisma.user.aggregate({ _sum: { credits: true } }),
    ]);

    return {
      totalUsers,
      paidUsers,
      freeUsers: totalUsers - paidUsers,
      activeSites,
      commentsToday,
      pendingReview,
      discoveryRuns,
      creditsInCirculation: creditsResult._sum.credits ?? 0,
    };
  }),

  getAllUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        planType: z.enum(["all", "free", "paid"]).default("all"),
        sortBy: z
          .enum(["newest", "oldest", "credits", "sites", "comments"])
          .default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.search?.trim()) {
        where.OR = [
          { name: { contains: input.search.trim(), mode: "insensitive" } },
          { email: { contains: input.search.trim(), mode: "insensitive" } },
        ];
      }

      if (input.planType === "paid") {
        where.stripeCustomer = {
          subscriptions: { some: { status: { in: ["active", "trialing"] } } },
        };
      } else if (input.planType === "free") {
        where.OR = [
          { stripeCustomer: null },
          {
            stripeCustomer: {
              subscriptions: { none: { status: { in: ["active", "trialing"] } } },
            },
          },
        ];
        if (input.search?.trim()) {
          where.AND = [
            {
              OR: [
                { name: { contains: input.search.trim(), mode: "insensitive" } },
                { email: { contains: input.search.trim(), mode: "insensitive" } },
              ],
            },
            {
              OR: [
                { stripeCustomer: null },
                {
                  stripeCustomer: {
                    subscriptions: {
                      none: { status: { in: ["active", "trialing"] } },
                    },
                  },
                },
              ],
            },
          ];
          delete where.OR;
        }
      }

      const orderBy =
        input.sortBy === "newest"
          ? [{ createdAt: "desc" as const }]
          : input.sortBy === "oldest"
            ? [{ createdAt: "asc" as const }]
            : input.sortBy === "credits"
              ? [{ credits: "desc" as const }]
              : input.sortBy === "sites"
                ? [{ sites: { _count: "desc" as const } }]
                : [{ createdAt: "desc" as const }];

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            credits: true,
            role: true,
            createdAt: true,
            _count: { select: { sites: true } },
            stripeCustomer: {
              select: {
                subscriptions: {
                  where: { status: { in: ["active", "trialing"] } },
                  orderBy: { currentPeriodEnd: "desc" },
                  take: 1,
                  select: {
                    price: {
                      select: { product: { select: { name: true } } },
                    },
                  },
                },
              },
            },
          },
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.user.count({ where }),
      ]);

      // Get posted comment counts for these users
      const userIds = users.map((u) => u.id);
      const commentCounts = await ctx.prisma.comment.groupBy({
        by: ["siteId"],
        where: {
          status: "POSTED",
          site: { userId: { in: userIds } },
        },
        _count: true,
      });

      // Map site to user for comment counts
      const siteToUser = new Map<string, string>();
      const sitesForUsers = await ctx.prisma.site.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true },
      });
      for (const s of sitesForUsers) {
        siteToUser.set(s.id, s.userId);
      }

      const userCommentCounts = new Map<string, number>();
      for (const cc of commentCounts) {
        const userId = siteToUser.get(cc.siteId);
        if (userId) {
          userCommentCounts.set(
            userId,
            (userCommentCounts.get(userId) ?? 0) + cc._count,
          );
        }
      }

      const items = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        credits: u.credits,
        role: u.role,
        createdAt: u.createdAt,
        siteCount: u._count.sites,
        postedComments: userCommentCounts.get(u.id) ?? 0,
        planName:
          u.role === "ADMIN"
            ? "ADMIN"
            : u.stripeCustomer?.subscriptions[0]?.price?.product?.name ?? "FREE",
      }));

      return { items, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  banUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });
      if (!user) return { success: false };
      if (user.role === "ADMIN") return { success: false };

      await ctx.prisma.$transaction([
        ctx.prisma.site.updateMany({
          where: { userId: input.userId },
          data: { active: false },
        }),
        ctx.prisma.user.update({
          where: { id: input.userId },
          data: { credits: 0 },
        }),
      ]);

      return { success: true };
    }),

  getAllComments: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        status: z
          .enum(["DRAFT", "APPROVED", "POSTED", "FAILED", "SKIPPED"])
          .optional(),
        platform: z.enum(["REDDIT", "YOUTUBE"]).optional(),
        sortBy: z
          .enum(["newest", "oldest", "quality_high", "quality_low"])
          .default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.status) where.status = input.status;
      if (input.platform) where.opportunity = { platform: input.platform };

      if (input.search?.trim()) {
        where.OR = [
          { text: { contains: input.search.trim(), mode: "insensitive" } },
          {
            opportunity: {
              title: { contains: input.search.trim(), mode: "insensitive" },
            },
          },
          {
            site: {
              name: { contains: input.search.trim(), mode: "insensitive" },
            },
          },
        ];
      }

      const orderBy =
        input.sortBy === "newest"
          ? [{ createdAt: "desc" as const }]
          : input.sortBy === "oldest"
            ? [{ createdAt: "asc" as const }]
            : input.sortBy === "quality_high"
              ? [{ qualityScore: "desc" as const }]
              : [{ qualityScore: "asc" as const }];

      const [comments, total] = await Promise.all([
        ctx.prisma.comment.findMany({
          where,
          include: {
            opportunity: {
              select: {
                title: true,
                contentUrl: true,
                platform: true,
                sourceContext: true,
              },
            },
            site: {
              select: {
                name: true,
                user: { select: { email: true } },
              },
            },
          },
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.comment.count({ where }),
      ]);

      return {
        items: comments,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  getAnalytics: adminProcedure
    .input(
      z.object({
        timeRange: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const dateFilter =
        input.timeRange === "all"
          ? undefined
          : input.timeRange === "7d"
            ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            : input.timeRange === "30d"
              ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const dateWhere = dateFilter ? { gte: dateFilter } : undefined;

      const [
        totalUsers,
        paidUsers,
        commentsByStatus,
        avgQuality,
        discoveryRuns,
        opportunitiesByPlatform,
        commentsByPlatform,
        planDistribution,
      ] = await Promise.all([
        ctx.prisma.user.count(dateWhere ? { where: { createdAt: dateWhere } } : undefined),
        ctx.prisma.user.count({
          where: {
            ...(dateWhere ? { createdAt: dateWhere } : {}),
            stripeCustomer: {
              subscriptions: { some: { status: { in: ["active", "trialing"] } } },
            },
          },
        }),
        ctx.prisma.comment.groupBy({
          by: ["status"],
          _count: true,
          ...(dateWhere ? { where: { createdAt: dateWhere } } : {}),
        }),
        ctx.prisma.comment.aggregate({
          _avg: { qualityScore: true },
          ...(dateWhere ? { where: { createdAt: dateWhere } } : {}),
        }),
        ctx.prisma.discoveryRun.aggregate({
          _count: true,
          _avg: {
            foundCount: true,
            scoredCount: true,
            generatedCount: true,
            postedCount: true,
          },
          ...(dateWhere ? { where: { startedAt: dateWhere } } : {}),
        }),
        ctx.prisma.opportunity.groupBy({
          by: ["platform"],
          _count: true,
          ...(dateWhere ? { where: { createdAt: dateWhere } } : {}),
        }),
        ctx.prisma.comment.groupBy({
          by: ["status"],
          _count: true,
          where: {
            ...(dateWhere ? { createdAt: dateWhere } : {}),
            opportunity: { platform: "REDDIT" },
          },
        }),
        // Plan distribution: count users per subscription product
        ctx.prisma.stripeSubscription.groupBy({
          by: ["priceId"],
          where: { status: { in: ["active", "trialing"] } },
          _count: true,
        }),
      ]);

      // Resolve plan names for distribution
      const priceIds = planDistribution.map((p) => p.priceId);
      const prices = await ctx.prisma.stripePrice.findMany({
        where: { id: { in: priceIds } },
        select: { id: true, product: { select: { name: true } } },
      });
      const priceToName = new Map(
        prices.map((p) => [p.id, p.product?.name ?? "Unknown"]),
      );

      const statusMap: Record<string, number> = {};
      for (const s of commentsByStatus) {
        statusMap[s.status] = s._count;
      }

      const platformOppMap: Record<string, number> = {};
      for (const p of opportunitiesByPlatform) {
        platformOppMap[p.platform] = p._count;
      }

      // Total completed runs
      const completedRuns = await ctx.prisma.discoveryRun.count({
        where: {
          status: "COMPLETED",
          ...(dateWhere ? { startedAt: dateWhere } : {}),
        },
      });

      return {
        totalUsers,
        paidUsers,
        commentsPosted: statusMap["POSTED"] ?? 0,
        avgQualityScore: Math.round((avgQuality._avg.qualityScore ?? 0) * 10) / 10,
        discovery: {
          totalRuns: discoveryRuns._count,
          completedRuns,
          successRate:
            discoveryRuns._count > 0
              ? Math.round((completedRuns / discoveryRuns._count) * 100)
              : 0,
          avgFound: Math.round(discoveryRuns._avg.foundCount ?? 0),
          avgScored: Math.round(discoveryRuns._avg.scoredCount ?? 0),
          avgGenerated: Math.round(discoveryRuns._avg.generatedCount ?? 0),
          avgPosted: Math.round(discoveryRuns._avg.postedCount ?? 0),
        },
        commentStatus: statusMap,
        platformBreakdown: {
          reddit: {
            opportunities: platformOppMap["REDDIT"] ?? 0,
            comments: commentsByPlatform.reduce((acc, c) => acc + c._count, 0),
          },
          youtube: {
            opportunities: platformOppMap["YOUTUBE"] ?? 0,
            comments: 0, // Will calculate if needed
          },
        },
        planDistribution: [
          {
            name: "Free",
            count: totalUsers - paidUsers,
          },
          ...planDistribution.map((p) => ({
            name: priceToName.get(p.priceId) ?? "Unknown",
            count: p._count,
          })),
        ],
      };
    }),

  getCreditHistory: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        reason: z
          .enum([
            "PURCHASE",
            "SUBSCRIPTION_CREATE",
            "SUBSCRIPTION_RENEWAL",
            "SUBSCRIPTION_UPDATE",
            "CAMPAIGN_USAGE",
            "REGISTRATION_BONUS",
            "PROMOTION",
            "OTHER",
          ])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.reason) where.reason = input.reason;

      if (input.search?.trim()) {
        where.user = {
          OR: [
            { name: { contains: input.search.trim(), mode: "insensitive" } },
            { email: { contains: input.search.trim(), mode: "insensitive" } },
          ],
        };
      }

      const [items, total] = await Promise.all([
        ctx.prisma.userCreditHistory.findMany({
          where,
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.userCreditHistory.count({ where }),
      ]);

      return {
        items,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),
});
