import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { analyzeSite } from "@/services/discovery/site-analyzer";
import { discoveryQueue, postingQueue, hvDiscoveryQueue, type DiscoveryJobData, type PostingJobData, type HVDiscoveryJobData } from "@/queue/queues";
import { getUserPlan } from "@/server/utils/plan";
import { getTotalCredits } from "@/server/utils/credits";
import { redis } from "@/server/utils/redis";
import { DISCOVERY_DEFAULTS, parseDiscoveryConfig } from "@/services/discovery/config";
import { parseDailyBudget, DAILY_BUDGET_DEFAULTS, type DailyBudget } from "@/services/budget/config";
import { generationQueue, type GenerationJobData } from "@/queue/queues";

/**
 * Atomically reserve the next posting slot for a platform.
 * Same Lua script as in generation.worker.ts — keeps stagger chains consistent.
 */
const RESERVE_SLOT_SCRIPT = `
local key   = KEYS[1]
local now   = tonumber(ARGV[1])
local gap   = tonumber(ARGV[2])
local last  = tonumber(redis.call('GET', key) or '0')
if last == nil then last = 0 end
local earliest = math.max(now, last)
local postAt   = earliest + gap
redis.call('SET', key, tostring(postAt))
redis.call('EXPIRE', key, 3600)
return tostring(postAt)
`;

async function reservePostingSlot(siteId: string, platform: string): Promise<{ postAt: number; delayMs: number }> {
  const redisKey = `auto:lastScheduled:${siteId}:${platform}`;
  const now = Date.now();
  const gapMs = Math.floor(Math.random() * 300_000) + 300_000; // 5–10 min
  const postAtStr = await redis.eval(
    RESERVE_SLOT_SCRIPT, 1, redisKey, now.toString(), gapMs.toString(),
  ) as string;
  const postAt = parseInt(postAtStr, 10);
  return { postAt, delayMs: Math.max(0, postAt - now) };
}

const KeywordCategorySchema = z.enum(["features", "competitors", "brand"]);

type SiteKeywordConfig = {
  features: string[];
  competitors: string[];
  brand: string[];
  reddit: string[];
  youtube: string[];
  twitter: string[];
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
  const twitter = dedupeKeywords(readStringArray(raw.twitter));

  if (features.length || competitors.length || brand.length || reddit.length || youtube.length || twitter.length) {
    return {
      features,
      competitors,
      brand,
      reddit,
      youtube,
      twitter,
    };
  }

  return {
    features: dedupeKeywords(fallbackKeywords),
    competitors: [],
    brand: [],
    reddit: [],
    youtube: [],
    twitter: [],
  };
}

export const siteRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        platforms: z.array(z.enum(["REDDIT", "YOUTUBE", "TWITTER"])).min(1),
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
          hvQueryCount: z.number().int().min(5).max(100),
          minTwitterFollowers: z.number().int().min(0).max(1_000_000),
          minTweetLikes: z.number().int().min(0).max(1000),
          maxTrackedProfiles: z.number().int().min(5).max(50),
          twitterTweetsPerProfile: z.number().int().min(5).max(50),
        }).optional(),
        dailyBudget: z.object({
          reddit: z.number().int().min(0).max(50),
          youtube: z.number().int().min(0).max(50),
          twitter: z.number().int().min(0).max(50),
        }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getUserPlan(ctx.session.user.id);
      const analysis = await analyzeSite(input.url);

      // Build flat keywords array from all categories for display (deduplicated)
      const kc = analysis.keywordConfig;
      const allKeywords = dedupeKeywords([
        ...kc.features,
        ...kc.competitors,
        ...kc.brand,
      ]);

      // Atomic limit check + create to prevent race condition bypassing site limit
      const site = await ctx.prisma.$transaction(async (tx) => {
        if (Number.isFinite(plan.maxSites)) {
          const siteCount = await tx.site.count({
            where: { userId: ctx.session.user.id },
          });
          if (siteCount >= plan.maxSites) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Site limit reached (${plan.maxSites}). Upgrade your plan to add more sites.`,
            });
          }
        }

        return tx.site.create({
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
            ...(input.dailyBudget ? { dailyBudget: input.dailyBudget } : {}),
          },
        });
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
        select: { id: true, dailyAutoLimit: true, dailyBudget: true },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const budget = parseDailyBudget(site.dailyBudget);

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const platforms = ["REDDIT", "YOUTUBE", "TWITTER"] as const;
      const perPlatform: Record<string, { posted: number; limit: number }> = {};

      let totalPosted = 0;
      for (const p of platforms) {
        const posted = await ctx.prisma.comment.count({
          where: {
            siteId: input.siteId,
            status: "POSTED",
            opportunity: { platform: p },
            postedAt: { gte: startOfDay },
          },
        });
        const platformKey = p.toLowerCase() as keyof DailyBudget;
        perPlatform[p] = { posted, limit: budget[platformKey] };
        totalPosted += posted;
      }

      const totalCredits = await getTotalCredits(ctx.session.user.id);

      return {
        postedToday: totalPosted,
        dailyAutoLimit: site.dailyAutoLimit,
        budget,
        perPlatform,
        totalCredits,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(500).optional(),
        valueProps: z.array(z.string().min(1).max(200)).min(1).max(8).optional(),
        brandTone: z.enum(["professional", "casual", "technical", "fun"]).optional(),
        mode: z.enum(["MANUAL", "AUTO"]).optional(),
        platforms: z.array(z.enum(["REDDIT", "YOUTUBE", "TWITTER"])).min(1).optional(),
        active: z.boolean().optional(),
        dailyAutoLimit: z.number().int().min(1).max(100).optional(),
        dailyBudget: z.object({
          reddit: z.number().int().min(0).max(50),
          youtube: z.number().int().min(0).max(50),
          twitter: z.number().int().min(0).max(50),
        }).optional(),
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
        const budget = parseDailyBudget(updated.dailyBudget);

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        // Get per-platform remaining budgets from DB
        const platformBudgets: Record<string, number> = {};
        for (const p of ["REDDIT", "YOUTUBE", "TWITTER"] as const) {
          const posted = await ctx.prisma.comment.count({
            where: {
              siteId: id,
              status: "POSTED",
              opportunity: { platform: p },
              postedAt: { gte: startOfDay },
            },
          });
          const platformKey = p.toLowerCase() as keyof DailyBudget;
          platformBudgets[p] = Math.max(0, budget[platformKey] - posted);
        }

        const totalRemaining = platformBudgets.REDDIT + platformBudgets.YOUTUBE + platformBudgets.TWITTER;

        if (totalRemaining > 0) {
          // Find DRAFT comments ranked by relevance
          const readyComments = await ctx.prisma.comment.findMany({
            where: { siteId: id, status: "DRAFT" },
            include: { opportunity: { select: { relevanceScore: true, platform: true } } },
            orderBy: { opportunity: { relevanceScore: "desc" } },
          });

          // Filter to fit per-platform budgets
          const platformCounts: Record<string, number> = { REDDIT: 0, YOUTUBE: 0, TWITTER: 0 };
          const schedulable = readyComments.filter((c) => {
            const p = c.opportunity.platform;
            if (platformCounts[p] < platformBudgets[p]) {
              platformCounts[p]++;
              return true;
            }
            return false;
          });

          if (schedulable.length > 0) {
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
              schedulable.flatMap((c) => [
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

            // If a comment was recently posted, seed the lastScheduled key so
            // the first slot starts after a gap rather than immediately.
            if (isRecent) {
              const platforms = Array.from(new Set(schedulable.map((c) => c.opportunity.platform)));
              for (const p of platforms) {
                const seedKey = `auto:lastScheduled:${id}:${p}`;
                await redis.set(seedKey, now.toString(), "EX", 3600);
              }
            }

            // Atomically reserve posting slots (safe with concurrent generation workers)
            for (const c of schedulable) {
              const { delayMs } = await reservePostingSlot(id, c.opportunity.platform);
              await postingQueue.add("post", {
                commentId: c.id,
              } satisfies PostingJobData, {
                jobId: `post-${c.id}`,
                delay: delayMs,
              });
            }

            console.log(`[site] Smart toggle: scheduled ${schedulable.length} comments for site ${id} (recent: ${!!isRecent})`);
          }

          // Also enqueue PENDING_REVIEW opportunities with no comments for generation
          // Recalculate remaining budgets after scheduling drafts
          const remainingAfterDrafts: Record<string, number> = {};
          for (const p of ["REDDIT", "YOUTUBE", "TWITTER"] as const) {
            remainingAfterDrafts[p] = Math.max(0, platformBudgets[p] - platformCounts[p]);
          }

          const totalRemainingAfterDrafts = remainingAfterDrafts.REDDIT + remainingAfterDrafts.YOUTUBE + remainingAfterDrafts.TWITTER;
          if (totalRemainingAfterDrafts > 0) {
            const uncommentedOpps = await ctx.prisma.opportunity.findMany({
              where: {
                siteId: id,
                status: "PENDING_REVIEW",
                comments: { none: {} },
              },
              select: { id: true, platform: true, relevanceScore: true },
              orderBy: { relevanceScore: "desc" },
            });

            const genCounts: Record<string, number> = { REDDIT: 0, YOUTUBE: 0, TWITTER: 0 };
            const toGenerate = uncommentedOpps.filter((opp) => {
              const p = opp.platform;
              if (genCounts[p] < remainingAfterDrafts[p]) {
                genCounts[p]++;
                return true;
              }
              return false;
            });

            for (const opp of toGenerate) {
              await generationQueue.add("generate", {
                opportunityId: opp.id,
              } satisfies GenerationJobData, { jobId: `gen-${opp.id}` });
            }

            if (toGenerate.length > 0) {
              console.log(`[site] Smart toggle: enqueued ${toGenerate.length} un-generated opportunities for generation (site ${id})`);
            }
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
      const normalizedTerm = normalizeKeyword(input.term);
      if (!normalizedTerm) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Keyword cannot be empty" });
      }

      const plan = await getUserPlan(ctx.session.user.id);

      // Atomic keyword limit check + update to prevent race condition
      const result = await ctx.prisma.$transaction(async (tx) => {
        const site = await tx.site.findFirst({
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
          keywordConfig.twitter = dedupeKeywords([
            ...keywordConfig.twitter,
            normalizedTerm,
          ]);
        }

        const allKeywords = dedupeKeywords([
          ...keywordConfig.features,
          ...keywordConfig.competitors,
          ...keywordConfig.brand,
        ]);

        await tx.site.update({
          where: { id: site.id },
          data: {
            keywords: allKeywords,
            keywordConfig,
          },
        });

        return { keywordExistsInCategory, allKeywords, site };
      });

      const { keywordExistsInCategory, allKeywords, site } = result;
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
      keywordConfig.twitter = keywordConfig.twitter.filter(
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
          hvQueryCount: z.number().int().min(5).max(100).optional(),
          minTwitterFollowers: z.number().int().min(0).max(1_000_000).optional(),
          minTweetLikes: z.number().int().min(0).max(1000).optional(),
          maxTrackedProfiles: z.number().int().min(5).max(50).optional(),
          twitterTweetsPerProfile: z.number().int().min(5).max(50).optional(),
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
