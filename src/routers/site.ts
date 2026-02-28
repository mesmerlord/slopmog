import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { analyzeSite } from "@/services/discovery/site-analyzer";
import { discoveryQueue, type DiscoveryJobData } from "@/queue/queues";

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

      const site = await ctx.prisma.site.create({
        data: {
          userId: ctx.session.user.id,
          url: input.url,
          name: analysis.name,
          description: analysis.description,
          valueProps: analysis.valueProps,
          keywords: analysis.keywords,
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
