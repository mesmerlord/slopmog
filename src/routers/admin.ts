import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { router, adminProcedure } from "@/server/trpc";
import { discoveryQueue, hvDiscoveryQueue, healthCheckQueue } from "@/queue/queues";
import type { HealthCheckMetadata } from "@/services/health-check/types";
import {
  startImpersonation as redisStartImpersonation,
  stopImpersonation as redisStopImpersonation,
  getImpersonation,
} from "@/server/utils/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

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
        select: {
          role: true,
          stripeCustomer: {
            select: {
              subscriptions: {
                where: { status: { in: ["active", "trialing"] } },
                select: { id: true },
              },
            },
          },
        },
      });
      if (!user) return { success: false };
      if (user.role === "ADMIN") return { success: false };

      // Cancel active Stripe subscriptions so banned user isn't billed
      const activeSubs = user.stripeCustomer?.subscriptions ?? [];
      for (const sub of activeSubs) {
        try {
          await stripe.subscriptions.cancel(sub.id);
        } catch (err) {
          console.error(`[admin.banUser] Failed to cancel subscription ${sub.id}:`, err);
        }
      }

      await ctx.prisma.$transaction([
        ctx.prisma.site.updateMany({
          where: { userId: input.userId },
          data: { active: false },
        }),
        ctx.prisma.user.update({
          where: { id: input.userId },
          data: { credits: 0, permanentCredits: 0 },
        }),
      ]);

      return { success: true };
    }),

  getAllSites: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        search: z.string().trim().max(120).optional(),
        activeFilter: z.enum(["all", "active", "inactive"]).default("all"),
        platform: z.enum(["REDDIT", "YOUTUBE", "TWITTER"]).optional(),
        sortBy: z
          .enum(["newest", "oldest", "opportunities", "comments"])
          .default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.activeFilter === "active") where.active = true;
      else if (input.activeFilter === "inactive") where.active = false;

      if (input.platform) where.platforms = { has: input.platform };

      if (input.search?.trim()) {
        where.OR = [
          { name: { contains: input.search.trim(), mode: "insensitive" } },
          { url: { contains: input.search.trim(), mode: "insensitive" } },
          { user: { email: { contains: input.search.trim(), mode: "insensitive" } } },
        ];
      }

      const orderBy =
        input.sortBy === "newest"
          ? [{ createdAt: "desc" as const }]
          : input.sortBy === "oldest"
            ? [{ createdAt: "asc" as const }]
            : input.sortBy === "opportunities"
              ? [{ opportunities: { _count: "desc" as const } }]
              : [{ comments: { _count: "desc" as const } }];

      const [sites, total] = await Promise.all([
        ctx.prisma.site.findMany({
          where,
          select: {
            id: true,
            name: true,
            url: true,
            active: true,
            mode: true,
            platforms: true,
            createdAt: true,
            user: { select: { email: true, name: true } },
            _count: { select: { opportunities: true, comments: true, discoveryRuns: true } },
          },
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.site.count({ where }),
      ]);

      return {
        items: sites,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /** Lightweight list for filter dropdowns */
  getSitesList: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.site.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    });
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
        platform: z.enum(["REDDIT", "YOUTUBE", "TWITTER"]).optional(),
        siteId: z.string().optional(),
        userEmail: z.string().trim().max(120).optional(),
        sortBy: z
          .enum(["newest", "oldest", "quality_high", "quality_low"])
          .default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.status) where.status = input.status;
      if (input.platform) where.opportunity = { platform: input.platform };
      if (input.siteId) where.siteId = input.siteId;
      if (input.userEmail?.trim()) {
        where.site = {
          ...((where.site as Record<string, unknown>) ?? {}),
          user: { email: { contains: input.userEmail.trim(), mode: "insensitive" } },
        };
      }

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

  getQueueStatus: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      runningRegular,
      runningHV,
      recentRegular,
      recentHV,
      completedToday,
      failedToday,
    ] = await Promise.all([
      ctx.prisma.discoveryRun.findMany({
        where: { status: "RUNNING" },
        include: {
          site: { select: { name: true, user: { select: { email: true } } } },
        },
        orderBy: { startedAt: "desc" },
      }),
      ctx.prisma.hVDiscoveryRun.findMany({
        where: { status: "RUNNING" },
        include: {
          site: { select: { name: true, user: { select: { email: true } } } },
        },
        orderBy: { startedAt: "desc" },
      }),
      ctx.prisma.discoveryRun.findMany({
        where: { status: { not: "RUNNING" } },
        include: {
          site: { select: { name: true, user: { select: { email: true } } } },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
      ctx.prisma.hVDiscoveryRun.findMany({
        where: { status: { not: "RUNNING" } },
        include: {
          site: { select: { name: true, user: { select: { email: true } } } },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
      ctx.prisma.discoveryRun.count({
        where: { status: "COMPLETED", completedAt: { gte: todayStart } },
      }),
      ctx.prisma.discoveryRun.count({
        where: { status: "FAILED", completedAt: { gte: todayStart } },
      }),
    ]);

    return {
      running: [
        ...runningRegular.map((r) => ({
          id: r.id,
          type: "regular" as const,
          siteId: r.siteId,
          siteName: r.site.name,
          userEmail: r.site.user?.email ?? "unknown",
          platform: r.platform,
          startedAt: r.startedAt,
          foundCount: r.foundCount,
          scoredCount: r.scoredCount,
        })),
        ...runningHV.map((r) => ({
          id: r.id,
          type: "hv" as const,
          siteId: r.siteId,
          siteName: r.site.name,
          userEmail: r.site.user?.email ?? "unknown",
          platform: null,
          startedAt: r.startedAt,
          foundCount: r.citationsFound,
          scoredCount: r.opportunitiesCreated,
        })),
      ].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()),
      recent: [
        ...recentRegular.map((r) => ({
          id: r.id,
          type: "regular" as const,
          siteId: r.siteId,
          siteName: r.site.name,
          userEmail: r.site.user?.email ?? "unknown",
          platform: r.platform,
          status: r.status,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          foundCount: r.foundCount,
          scoredCount: r.scoredCount,
          generatedCount: r.generatedCount,
          errorMessage: r.errorMessage,
        })),
        ...recentHV.map((r) => ({
          id: r.id,
          type: "hv" as const,
          siteId: r.siteId,
          siteName: r.site.name,
          userEmail: r.site.user?.email ?? "unknown",
          platform: null,
          status: r.status,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          foundCount: r.citationsFound,
          scoredCount: r.opportunitiesCreated,
          generatedCount: 0,
          errorMessage: r.errorMessage,
        })),
      ]
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 20),
      counts: {
        running: runningRegular.length + runningHV.length,
        completedToday,
        failedToday,
      },
    };
  }),

  cancelDiscoveryRun: adminProcedure
    .input(z.object({ runId: z.string(), type: z.enum(["regular", "hv"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "regular") {
        await ctx.prisma.discoveryRun.update({
          where: { id: input.runId },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        // Drain matching waiting/delayed jobs
        const waiting = await discoveryQueue.getJobs(["waiting", "delayed"]);
        for (const job of waiting) {
          if (job.data?.siteId) {
            const run = await ctx.prisma.discoveryRun.findUnique({
              where: { id: input.runId },
              select: { siteId: true },
            });
            if (run && job.data.siteId === run.siteId) {
              await job.remove().catch(() => {});
            }
          }
        }
      } else {
        await ctx.prisma.hVDiscoveryRun.update({
          where: { id: input.runId },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        const waiting = await hvDiscoveryQueue.getJobs(["waiting", "delayed"]);
        for (const job of waiting) {
          if (job.data?.siteId) {
            const run = await ctx.prisma.hVDiscoveryRun.findUnique({
              where: { id: input.runId },
              select: { siteId: true },
            });
            if (run && job.data.siteId === run.siteId) {
              await job.remove().catch(() => {});
            }
          }
        }
      }

      return { success: true };
    }),

  cancelAllForSite: adminProcedure
    .input(z.object({ siteId: z.string(), type: z.enum(["regular", "hv", "both"]) }))
    .mutation(async ({ ctx, input }) => {
      const cancelRegular = input.type === "regular" || input.type === "both";
      const cancelHV = input.type === "hv" || input.type === "both";

      if (cancelRegular) {
        await ctx.prisma.discoveryRun.updateMany({
          where: { siteId: input.siteId, status: "RUNNING" },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        const waiting = await discoveryQueue.getJobs(["waiting", "delayed"]);
        for (const job of waiting) {
          if (job.data?.siteId === input.siteId) {
            await job.remove().catch(() => {});
          }
        }
      }

      if (cancelHV) {
        await ctx.prisma.hVDiscoveryRun.updateMany({
          where: { siteId: input.siteId, status: "RUNNING" },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        const waiting = await hvDiscoveryQueue.getJobs(["waiting", "delayed"]);
        for (const job of waiting) {
          if (job.data?.siteId === input.siteId) {
            await job.remove().catch(() => {});
          }
        }
      }

      return { success: true };
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

  triggerHealthCheck: adminProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        pipeline: z.enum(["regular", "hv", "both"]).default("both"),
      }),
    )
    .mutation(async ({ input }) => {
      const jobData = input.siteId
        ? { scope: "site" as const, siteId: input.siteId, pipeline: input.pipeline }
        : { scope: "all" as const, pipeline: input.pipeline };

      const job = await healthCheckQueue.add("health-check", jobData, {
        jobId: `hc-${Date.now()}`,
      });

      return { jobId: job.id };
    }),

  testHealthCheck: adminProcedure
    .input(
      z.object({
        opportunityId: z.string().optional(),
        pipeline: z.enum(["regular", "hv"]).default("regular"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let oppId = input.opportunityId;

      if (!oppId) {
        if (input.pipeline === "regular") {
          const opp = await ctx.prisma.opportunity.findFirst({
            where: {
              status: "POSTED",
              comments: { some: { status: "POSTED" } },
            },
            select: { id: true },
            orderBy: { updatedAt: "desc" },
          });
          oppId = opp?.id;
        } else {
          const opp = await ctx.prisma.hVOpportunity.findFirst({
            where: {
              status: "POSTED",
              hvComments: { some: { status: "POSTED" } },
            },
            select: { id: true },
            orderBy: { updatedAt: "desc" },
          });
          oppId = opp?.id;
        }
      }

      if (!oppId) return { jobId: null, error: "No posted opportunity found" };

      const job = await healthCheckQueue.add("health-check-test", {
        scope: "opportunity",
        opportunityId: oppId,
        pipeline: input.pipeline,
      }, {
        jobId: `hc-test-${Date.now()}`,
      });

      return { jobId: job.id, opportunityId: oppId, error: null };
    }),

  getHealthCheckResults: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        filter: z.enum(["all", "healthy", "deleted", "unchecked"]).default("all"),
        pipeline: z.enum(["regular", "hv", "both"]).default("both"),
        siteId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      type ResultItem = {
        id: string;
        pipeline: "regular" | "hv";
        title: string;
        contentUrl: string;
        platform: string;
        siteName: string;
        healthCheck: HealthCheckMetadata | null;
      };

      const items: ResultItem[] = [];

      // Regular pipeline — use DB-level limit to avoid loading all records into memory
      if (input.pipeline !== "hv") {
        const where: Record<string, unknown> = { status: "POSTED" };
        if (input.siteId) where.siteId = input.siteId;

        const opps = await ctx.prisma.opportunity.findMany({
          where,
          select: {
            id: true,
            title: true,
            contentUrl: true,
            platform: true,
            metadata: true,
            site: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 500,
        });

        for (const opp of opps) {
          const meta = opp.metadata as Record<string, unknown> | null;
          const hc = (meta?.healthCheck as HealthCheckMetadata) ?? null;
          items.push({
            id: opp.id,
            pipeline: "regular",
            title: opp.title,
            contentUrl: opp.contentUrl,
            platform: opp.platform,
            siteName: opp.site.name,
            healthCheck: hc,
          });
        }
      }

      // HV pipeline
      if (input.pipeline !== "regular") {
        const where: Record<string, unknown> = { status: "POSTED" };
        if (input.siteId) where.siteId = input.siteId;

        const opps = await ctx.prisma.hVOpportunity.findMany({
          where,
          select: {
            id: true,
            title: true,
            contentUrl: true,
            platform: true,
            metadata: true,
            site: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 500,
        });

        for (const opp of opps) {
          const meta = opp.metadata as Record<string, unknown> | null;
          const hc = (meta?.healthCheck as HealthCheckMetadata) ?? null;
          items.push({
            id: opp.id,
            pipeline: "hv",
            title: opp.title,
            contentUrl: opp.contentUrl,
            platform: opp.platform,
            siteName: opp.site.name,
            healthCheck: hc,
          });
        }
      }

      // Apply filter
      const filtered = items.filter((item) => {
        if (input.filter === "all") return true;
        if (input.filter === "unchecked") return !item.healthCheck;
        if (input.filter === "healthy") {
          return item.healthCheck && item.healthCheck.deletedCount === 0 && !item.healthCheck.error;
        }
        if (input.filter === "deleted") {
          return item.healthCheck && item.healthCheck.deletedCount > 0;
        }
        return true;
      });

      // Summary stats
      let totalChecked = 0;
      let totalVisible = 0;
      let totalDeleted = 0;
      let totalUncertain = 0;
      let lastRunAt: string | null = null;

      for (const item of items) {
        if (!item.healthCheck) continue;
        totalChecked++;
        totalVisible += item.healthCheck.visibleCount;
        totalDeleted += item.healthCheck.deletedCount;
        totalUncertain += item.healthCheck.uncertainCount;
        if (!lastRunAt || item.healthCheck.lastCheckedAt > lastRunAt) {
          lastRunAt = item.healthCheck.lastCheckedAt;
        }
      }

      const total = filtered.length;
      const paged = filtered.slice(
        (input.page - 1) * input.limit,
        input.page * input.limit,
      );

      return {
        items: paged,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
        summary: {
          totalOpportunities: items.length,
          totalChecked,
          totalUnchecked: items.length - totalChecked,
          totalVisible,
          totalDeleted,
          totalUncertain,
          lastRunAt,
        },
      };
    }),

  startImpersonation: adminProcedure
    .input(
      z.object({
        targetUserId: z.string(),
        ttlMinutes: z.number().min(1).max(60).default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot impersonate yourself",
        });
      }

      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: input.targetUserId },
        select: { id: true, email: true, name: true },
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await redisStartImpersonation(
        ctx.session.user.id,
        targetUser.id,
        targetUser.email,
        targetUser.name,
        input.ttlMinutes * 60,
      );

      return {
        success: true,
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
        },
        expiresInMinutes: input.ttlMinutes,
      };
    }),

  stopImpersonation: adminProcedure.mutation(async ({ ctx }) => {
    await redisStopImpersonation(ctx.session.user.id);
    return { success: true };
  }),

  getImpersonationStatus: adminProcedure.query(async ({ ctx }) => {
    const data = await getImpersonation(ctx.session.user.id);
    if (!data) {
      return {
        isImpersonating: false,
        targetUserId: null,
        targetUserEmail: null,
        targetUserName: null,
        startedAt: null,
      };
    }
    return {
      isImpersonating: true,
      targetUserId: data.targetUserId,
      targetUserEmail: data.targetUserEmail,
      targetUserName: data.targetUserName,
      startedAt: data.startedAt,
    };
  }),
});
