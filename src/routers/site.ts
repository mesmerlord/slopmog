import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { analyzeSite } from "@/services/discovery/site-analyzer";
import { discoveryQueue, type DiscoveryJobData } from "@/queue/queues";
import { getUserPlan } from "@/server/utils/plan";

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
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
        },
      });

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

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        mode: z.enum(["MANUAL", "AUTO"]).optional(),
        platforms: z.array(z.enum(["REDDIT", "YOUTUBE"])).optional(),
        active: z.boolean().optional(),
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

      return ctx.prisma.site.update({
        where: { id },
        data,
      });
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
});
