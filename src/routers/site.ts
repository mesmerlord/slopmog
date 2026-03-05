import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { analyzeSite } from "@/services/discovery/site-analyzer";
import { discoveryQueue, postingQueue, hvDiscoveryQueue, type DiscoveryJobData, type PostingJobData, type HVDiscoveryJobData } from "@/queue/queues";
import { getUserPlan } from "@/server/utils/plan";
import { getTotalCredits } from "@/server/utils/credits";
import { redis } from "@/server/utils/redis";
import { DISCOVERY_DEFAULTS, parseDiscoveryConfig } from "@/services/discovery/config";

const KeywordCategorySchema = z.enum(["features", "competitors", "brand"]);

type SiteKeywordConfig = {
  features: string[];
  competitors: string[];
  brand: string[];
  reddit: string[];
  youtube: string[];
};

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeKeywords(keywords: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseSiteKeywordConfig(
  keywordConfig: unknown,
  fallbackKeywords: string[],
): SiteKeywordConfig {
  const raw = keywordConfig && typeof keywordConfig === "object"
    ? keywordConfig as Record<string, unknown>
    : {};

  const features = dedupeKeywords(readStringArray(raw.features));
  const competitors = dedupeKeywords(readStringArray(raw.competitors));
  const brand = dedupeKeywords(readStringArray(raw.brand));
  const reddit = dedupeKeywords(readStringArray(raw.reddit));
  const youtube = dedupeKeywords(readStringArray(raw.youtube));

  if (features.length || competitors.length || brand.length || reddit.length || youtube.length) {
    return {
      features,
      competitors,
      brand,
      reddit,
      youtube,
    };
  }

  return {
    features: dedupeKeywords(fallbackKeywords),
    competitors: [],
    brand: [],
    reddit: [],
    youtube: [],
  };
}

export const siteRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        platforms: z.array(z.enum(["REDDIT", "YOUTUBE"])).min(1),
        mode: z.enum(["MANUAL", "AUTO"]).default("MANUAL"),
        discoveryConfig: z.object({
          minRedditUpvotes: z.number().int().min(0).max(100),
          minRedditComments: z.number().int().min(0).max(100),
          minSubredditSubscribers: z.number().int().min(0).max(1_000_000),
          minYoutubeViews: z.number().int().min(0).max(1_000_000),
          maxYoutubeAgeDays: z.number().int().min(1).max(365),
          maxRedditPages: z.number().int().min(1).max(20),
          autoGenerateTopN: z.number().int().min(0).max(50),
          autoGenerateMinScore: z.number().min(0).max(1),
          dailyKeywordLimit: z.number().int().min(1).max(30),
        }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check site limit
      const plan = await getUserPlan(ctx.session.user.id);
      if (Number.isFinite(plan.maxSites)) {
        const siteCount = await ctx.prisma.site.count({
          where: { userId: ctx.session.user.id },
        });
        if (siteCount >= plan.maxSites) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Site limit reached (${plan.maxSites}). Upgrade your plan to add more sites.`,
          });
        }
      }

      const analysis = await analyzeSite(input.url);

      // Build flat keywords array from all categories for display (deduplicated)
      const kc = analysis.keywordConfig;
      const allKeywords = dedupeKeywords([
        ...kc.features,
        ...kc.competitors,
        ...kc.brand,
      ]);

      const site = await ctx.prisma.site.create({
        data: {
          userId: ctx.session.user.id,
          url: input.url,
          name: analysis.name,
          description: analysis.description,
          valueProps: analysis.valueProps,
          keywords: allKeywords,
          keywordConfig: kc,
          brandTone: analysis.brandTone,
          platforms: input.platforms,
          mode: input.mode,
          ...(input.discoveryConfig ? { discoveryConfig: input.discoveryConfig } : {}),
        },
      });

      // Auto-trigger discovery on site creation
      await discoveryQueue.add("discover", {
        siteId: site.id,
        triggeredBy: "manual",
      } satisfies DiscoveryJobData);

      // Auto-trigger HV discovery
      await hvDiscoveryQueue.add("hv-discover", {
        siteId: site.id,
        triggeredBy: "manual",
      } satisfies HVDiscoveryJobData);

      return site;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const sites = await ctx.prisma.site.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            opportunities: true,
            comments: { where: { status: "POSTED" } },
          },
        },
      },
    });

    return sites;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
        include: {
          _count: {
            select: {
              opportunities: true,
              comments: { where: { status: "POSTED" } },
            },
          },
        },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      return site;
    }),

  getDailyAutoStats: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: { id: true, dailyAutoLimit: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const todayUTC = new Date().toISOString().slice(0, 10);
      const dailyCountKey = `auto:dailyCount:${input.siteId}:${todayUTC}`;
      const countStr = await redis.get(dailyCountKey);
      const postedToday = countStr ? parseInt(countStr, 10) : 0;

      const totalCredits = await getTotalCredits(ctx.session.user.id);

      return { postedToday, dailyAutoLimit: site.dailyAutoLimit, totalCredits };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        mode: z.enum(["MANUAL", "AUTO"]).optional(),
        platforms: z.array(z.enum(["REDDIT", "YOUTUBE"])).optional(),
        active: z.boolean().optional(),
        dailyAutoLimit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const site = await ctx.prisma.site.findFirst({
        where: { id, userId: ctx.session.user.id },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const previousMode = site.mode;

      const updated = await ctx.prisma.site.update({
        where: { id },
        data,
      });

      // Smart scheduling when toggling MANUAL -> AUTO
      if (data.mode === "AUTO" && previousMode === "MANUAL") {
        const todayUTC = new Date().toISOString().slice(0, 10);
        const dailyCountKey = `auto:dailyCount:${id}:${todayUTC}`;
        const currentCountStr = await redis.get(dailyCountKey);
        const alreadyPostedToday = currentCountStr ? parseInt(currentCountStr, 10) : 0;
        const remaining = Math.max(0, updated.dailyAutoLimit - alreadyPostedToday);

        if (remaining > 0) {
          // Find DRAFT comments ranked by relevance
          const readyComments = await ctx.prisma.comment.findMany({
            where: { siteId: id, status: "DRAFT" },
            include: { opportunity: { select: { relevanceScore: true, platform: true } } },
            orderBy: { opportunity: { relevanceScore: "desc" } },
            take: remaining,
          });

          if (readyComments.length > 0) {
            // Check last posted comment to determine if recent
            const lastPosted = await ctx.prisma.comment.findFirst({
              where: { siteId: id, status: "POSTED" },
              orderBy: { postedAt: "desc" },
              select: { postedAt: true },
            });

            const now = Date.now();
            const isRecent = lastPosted?.postedAt && (now - lastPosted.postedAt.getTime()) < 300_000;

            // Update statuses to APPROVED
            await ctx.prisma.$transaction(
              readyComments.flatMap((c) => [
                ctx.prisma.comment.update({
                  where: { id: c.id },
                  data: { status: "APPROVED" },
                }),
                ctx.prisma.opportunity.update({
                  where: { id: c.opportunityId },
                  data: { status: "APPROVED" },
                }),
              ]),
            );

            // Schedule posting with staggered delays
            let cumulativeDelay = isRecent ? 300_000 : 0; // 5 min if recent, immediate if not

            for (let i = 0; i < readyComments.length; i++) {
              const c = readyComments[i];
              const platform = c.opportunity.platform;

              if (i > 0) {
                cumulativeDelay += Math.floor(Math.random() * 300_000) + 300_000; // 5-10 min gap
              }

              // Update lastScheduled redis key
              const redisKey = `auto:lastScheduled:${id}:${platform}`;
              const postAt = now + cumulativeDelay;
              await redis.set(redisKey, postAt.toString(), "EX", 3600);

              await postingQueue.add("post", {
                commentId: c.id,
              } satisfies PostingJobData, {
                delay: cumulativeDelay,
              });
            }

            // Update daily counter
            await redis.incrby(dailyCountKey, readyComments.length);
            await redis.expire(dailyCountKey, 90000); // 25 hours

            console.log(`[site] Smart toggle: scheduled ${readyComments.length} comments for site ${id} (recent: ${!!isRecent})`);
          }
        }
      }

      return updated;
    }),

  addKeywordTerm: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        category: KeywordCategorySchema,
        term: z.string().min(2).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: {
          id: true,
          active: true,
          keywords: true,
          keywordConfig: true,
        },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const normalizedTerm = normalizeKeyword(input.term);
      if (!normalizedTerm) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Keyword cannot be empty" });
      }

      const keywordConfig = parseSiteKeywordConfig(site.keywordConfig, site.keywords);
      const categoryKeywords = keywordConfig[input.category];
      const keywordExistsInCategory = categoryKeywords.some(
        (keyword) => keyword.toLowerCase() === normalizedTerm.toLowerCase(),
      );

      const allCurrentKeywords = dedupeKeywords([
        ...keywordConfig.features,
        ...keywordConfig.competitors,
        ...keywordConfig.brand,
      ]);

      if (!keywordExistsInCategory) {
        const keywordExistsGlobally = allCurrentKeywords.some(
          (keyword) => keyword.toLowerCase() === normalizedTerm.toLowerCase(),
        );

        if (!keywordExistsGlobally) {
          const plan = await getUserPlan(ctx.session.user.id);
          if (Number.isFinite(plan.maxKeywords) && allCurrentKeywords.length >= plan.maxKeywords) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Keyword limit reached (${plan.maxKeywords}). Upgrade your plan to add more keywords.`,
            });
          }
        }

        keywordConfig[input.category] = dedupeKeywords([
          ...categoryKeywords,
          normalizedTerm,
        ]);
        keywordConfig.reddit = dedupeKeywords([
          ...keywordConfig.reddit,
          normalizedTerm,
        ]);
        keywordConfig.youtube = dedupeKeywords([
          ...keywordConfig.youtube,
          normalizedTerm,
        ]);
      }

      const allKeywords = dedupeKeywords([
        ...keywordConfig.features,
        ...keywordConfig.competitors,
        ...keywordConfig.brand,
      ]);

      await ctx.prisma.site.update({
        where: { id: site.id },
        data: {
          keywords: allKeywords,
          keywordConfig,
        },
      });

      const queued = !keywordExistsInCategory && site.active;
      if (queued) {
        await discoveryQueue.add("discover", {
          siteId: site.id,
          triggeredBy: "manual",
          keywordOverrides: [normalizedTerm],
        } satisfies DiscoveryJobData);
      }

      return {
        term: normalizedTerm,
        category: input.category,
        keywordCount: allKeywords.length,
        alreadyExists: keywordExistsInCategory,
        queued,
      };
    }),

  removeKeywordTerm: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        category: KeywordCategorySchema,
        term: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: {
          id: true,
          keywords: true,
          keywordConfig: true,
        },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const keywordConfig = parseSiteKeywordConfig(site.keywordConfig, site.keywords);
      const termLower = input.term.toLowerCase();

      const categoryKeywords = keywordConfig[input.category];
      const filtered = categoryKeywords.filter(
        (kw) => kw.toLowerCase() !== termLower,
      );

      if (filtered.length === categoryKeywords.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found in this category" });
      }

      keywordConfig[input.category] = filtered;
      keywordConfig.reddit = keywordConfig.reddit.filter(
        (kw) => kw.toLowerCase() !== termLower,
      );
      keywordConfig.youtube = keywordConfig.youtube.filter(
        (kw) => kw.toLowerCase() !== termLower,
      );

      const allKeywords = dedupeKeywords([
        ...keywordConfig.features,
        ...keywordConfig.competitors,
        ...keywordConfig.brand,
      ]);

      await ctx.prisma.site.update({
        where: { id: site.id },
        data: {
          keywords: allKeywords,
          keywordConfig,
        },
      });

      return {
        term: input.term,
        category: input.category,
        keywordCount: allKeywords.length,
      };
    }),

  getDiscoveryConfig: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: { discoveryConfig: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      return {
        config: parseDiscoveryConfig(site.discoveryConfig),
        defaults: DISCOVERY_DEFAULTS,
      };
    }),

  updateDiscoveryConfig: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        config: z.object({
          minRedditUpvotes: z.number().int().min(0).max(100).optional(),
          minRedditComments: z.number().int().min(0).max(100).optional(),
          minSubredditSubscribers: z.number().int().min(0).max(1_000_000).optional(),
          minYoutubeViews: z.number().int().min(0).max(1_000_000).optional(),
          maxYoutubeAgeDays: z.number().int().min(1).max(365).optional(),
          maxRedditPages: z.number().int().min(1).max(20).optional(),
          autoGenerateTopN: z.number().int().min(0).max(50).optional(),
          autoGenerateMinScore: z.number().min(0).max(1).optional(),
          dailyKeywordLimit: z.number().int().min(1).max(30).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
        select: { id: true, discoveryConfig: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const current = parseDiscoveryConfig(site.discoveryConfig);
      const merged = { ...current, ...input.config };

      await ctx.prisma.site.update({
        where: { id: site.id },
        data: { discoveryConfig: merged },
      });

      return { config: merged };
    }),

  triggerDiscovery: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      if (!site.active) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Site is not active" });
      }

      await discoveryQueue.add("discover", {
        siteId: site.id,
        triggeredBy: "manual",
      } satisfies DiscoveryJobData);

      return { queued: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      await ctx.prisma.site.delete({ where: { id: input.id } });

      return { deleted: true };
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

      return ctx.prisma.discoveryRun.findMany({
        where: { siteId: input.siteId },
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });
    }),

  hasRunningDiscovery: protectedProcedure.query(async ({ ctx }) => {
    const runs = await ctx.prisma.discoveryRun.findMany({
      where: {
        status: "RUNNING",
        site: { userId: ctx.session.user.id },
      },
      select: {
        id: true,
        platform: true,
        startedAt: true,
        site: { select: { id: true, name: true } },
      },
    });

    return {
      isRunning: runs.length > 0,
      runs: runs.map((r) => ({
        id: r.id,
        platform: r.platform,
        site: r.site,
        startedAt: r.startedAt.toISOString(),
      })),
    };
  }),

  getGlobalActivityFeed: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [runs, comments] = await Promise.all([
        ctx.prisma.discoveryRun.findMany({
          where: { site: { userId: ctx.session.user.id } },
          orderBy: { startedAt: "desc" },
          take: input.limit,
          include: { site: { select: { name: true } } },
        }),
        ctx.prisma.comment.findMany({
          where: { site: { userId: ctx.session.user.id }, status: "POSTED" },
          orderBy: { postedAt: "desc" },
          take: input.limit,
          include: {
            site: { select: { name: true } },
            opportunity: {
              select: {
                title: true,
                sourceContext: true,
                platform: true,
                contentUrl: true,
              },
            },
          },
        }),
      ]);

      type GlobalActivityItem =
        | {
            type: "discovery_completed";
            id: string;
            timestamp: string;
            platform: string;
            siteName: string;
            foundCount: number;
            generatedCount: number;
          }
        | {
            type: "discovery_running";
            id: string;
            timestamp: string;
            platform: string;
            siteName: string;
          }
        | {
            type: "comment_posted";
            id: string;
            timestamp: string;
            platform: string;
            siteName: string;
            title: string;
            sourceContext: string;
            contentUrl: string;
          };

      const items: GlobalActivityItem[] = [];

      for (const run of runs) {
        if (run.status === "RUNNING") {
          items.push({
            type: "discovery_running",
            id: run.id,
            timestamp: run.startedAt.toISOString(),
            platform: run.platform,
            siteName: run.site.name,
          });
        } else if (run.status === "COMPLETED") {
          items.push({
            type: "discovery_completed",
            id: run.id,
            timestamp: (run.completedAt ?? run.startedAt).toISOString(),
            platform: run.platform,
            siteName: run.site.name,
            foundCount: run.foundCount,
            generatedCount: run.generatedCount,
          });
        }
      }

      for (const comment of comments) {
        items.push({
          type: "comment_posted",
          id: comment.id,
          timestamp: (comment.postedAt ?? comment.createdAt).toISOString(),
          platform: comment.opportunity.platform,
          siteName: comment.site.name,
          title: comment.opportunity.title,
          sourceContext: comment.opportunity.sourceContext,
          contentUrl: comment.opportunity.contentUrl,
        });
      }

      items.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return items.slice(0, input.limit);
    }),

  getActivityFeed: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        limit: z.number().min(1).max(50).default(15),
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

      const [runs, comments] = await Promise.all([
        ctx.prisma.discoveryRun.findMany({
          where: { siteId: input.siteId },
          orderBy: { startedAt: "desc" },
          take: input.limit,
        }),
        ctx.prisma.comment.findMany({
          where: { siteId: input.siteId, status: "POSTED" },
          orderBy: { postedAt: "desc" },
          take: input.limit,
          include: {
            opportunity: {
              select: {
                title: true,
                sourceContext: true,
                platform: true,
                contentUrl: true,
              },
            },
          },
        }),
      ]);

      type ActivityItem =
        | {
            type: "discovery_running";
            id: string;
            timestamp: string;
            platform: string;
            keywords: string[];
          }
        | {
            type: "discovery_completed";
            id: string;
            timestamp: string;
            platform: string;
            keywords: string[];
            foundCount: number;
            generatedCount: number;
          }
        | {
            type: "discovery_failed";
            id: string;
            timestamp: string;
            platform: string;
            keywords: string[];
            error: string | null;
          }
        | {
            type: "comment_posted";
            id: string;
            timestamp: string;
            platform: string;
            title: string;
            sourceContext: string;
            contentUrl: string;
          };

      const items: ActivityItem[] = [];

      for (const run of runs) {
        const ts = (run.completedAt ?? run.startedAt).toISOString();
        if (run.status === "RUNNING") {
          items.push({
            type: "discovery_running",
            id: run.id,
            timestamp: run.startedAt.toISOString(),
            platform: run.platform,
            keywords: run.keywordsUsed,
          });
        } else if (run.status === "COMPLETED") {
          items.push({
            type: "discovery_completed",
            id: run.id,
            timestamp: ts,
            platform: run.platform,
            keywords: run.keywordsUsed,
            foundCount: run.foundCount,
            generatedCount: run.generatedCount,
          });
        } else {
          items.push({
            type: "discovery_failed",
            id: run.id,
            timestamp: ts,
            platform: run.platform,
            keywords: run.keywordsUsed,
            error: run.errorMessage,
          });
        }
      }

      for (const comment of comments) {
        items.push({
          type: "comment_posted",
          id: comment.id,
          timestamp: (comment.postedAt ?? comment.createdAt).toISOString(),
          platform: comment.opportunity.platform,
          title: comment.opportunity.title,
          sourceContext: comment.opportunity.sourceContext,
          contentUrl: comment.opportunity.contentUrl,
        });
      }

      items.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return items.slice(0, input.limit);
    }),
});
