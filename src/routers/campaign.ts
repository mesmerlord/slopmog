import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { analyzeSite } from "@/services/analysis/site-analyzer";
import { addToCampaignQueue } from "@/queue/queues";

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.campaign.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        keywords: true,
        subreddits: true,
        _count: { select: { posts: true, opportunities: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          keywords: true,
          subreddits: true,
          posts: { orderBy: { createdAt: "desc" }, take: 20 },
          opportunities: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return campaign;
    }),

  getStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
      });
      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      const [opportunityCount, postedCount, pendingCount, totalCreditsUsed] =
        await Promise.all([
          ctx.prisma.opportunity.count({ where: { campaignId: input.id } }),
          ctx.prisma.opportunity.count({
            where: { campaignId: input.id, status: "POSTED" },
          }),
          ctx.prisma.opportunity.count({
            where: {
              campaignId: input.id,
              status: { in: ["PENDING_REVIEW", "READY_FOR_REVIEW"] },
            },
          }),
          ctx.prisma.campaign
            .findUnique({
              where: { id: input.id },
              select: { creditsUsed: true },
            })
            .then((c) => c?.creditsUsed ?? 0),
        ]);

      return {
        opportunitiesFound: opportunityCount,
        commentsPosted: postedCount,
        pendingReview: pendingCount,
        creditsUsed: totalCreditsUsed,
      };
    }),

  analyzeSite: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      return analyzeSite(input.url);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        websiteUrl: z.string().url().optional(),
        businessName: z.string().optional(),
        businessDescription: z.string().optional(),
        valueProps: z.array(z.string()).optional(),
        targetAudience: z.string().optional(),
        brandTone: z
          .enum(["professional", "casual", "technical", "friendly"])
          .optional(),
        automationMode: z
          .enum(["FULL_MANUAL", "SEMI_AUTO", "AUTOPILOT"])
          .optional(),
        siteAnalysisData: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
        keywords: z.array(z.string().min(1)).min(1),
        subreddits: z
          .array(
            z.object({
              name: z.string().min(1),
              memberCount: z.number().optional(),
              expectedTone: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.campaign.create({
        data: {
          name: input.name,
          description: input.description,
          websiteUrl: input.websiteUrl,
          businessName: input.businessName,
          businessDescription: input.businessDescription,
          valueProps: input.valueProps ?? [],
          targetAudience: input.targetAudience,
          brandTone: input.brandTone,
          automationMode: input.automationMode ?? "SEMI_AUTO",
          siteAnalysisData: (input.siteAnalysisData as typeof input.siteAnalysisData & import("@prisma/client").Prisma.InputJsonValue) ?? undefined,
          userId: ctx.session.user.id,
          keywords: {
            create: input.keywords.map((keyword) => ({ keyword })),
          },
          subreddits: input.subreddits
            ? {
                create: input.subreddits.map((s) => ({
                  subreddit: s.name,
                  memberCount: s.memberCount,
                  expectedTone: s.expectedTone,
                })),
              }
            : undefined,
        },
        include: { keywords: true, subreddits: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
        automationMode: z
          .enum(["FULL_MANUAL", "SEMI_AUTO", "AUTOPILOT"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          status: input.status,
          automationMode: input.automationMode,
        },
      });
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
        include: { keywords: true, subreddits: true },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (campaign.keywords.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Campaign needs at least one keyword before activation",
        });
      }

      // Update status to ACTIVE
      const updated = await ctx.prisma.campaign.update({
        where: { id: input.id },
        data: { status: "ACTIVE" },
      });

      // Enqueue campaign processing (site analysis + discovery)
      await addToCampaignQueue({ campaignId: input.id });

      return updated;
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      // TODO: Remove repeatable scout jobs (Slice 3)

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: { status: "PAUSED" },
      });
    }),

  updateKeywords: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        add: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      // Delete removed keywords
      if (input.remove?.length) {
        await ctx.prisma.campaignKeyword.deleteMany({
          where: {
            campaignId: input.campaignId,
            keyword: { in: input.remove },
          },
        });
      }

      // Add new keywords
      if (input.add?.length) {
        await ctx.prisma.campaignKeyword.createMany({
          data: input.add.map((keyword) => ({
            keyword,
            campaignId: input.campaignId,
          })),
          skipDuplicates: true,
        });
      }

      return ctx.prisma.campaignKeyword.findMany({
        where: { campaignId: input.campaignId },
      });
    }),

  updateSubreddits: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        add: z
          .array(
            z.object({
              name: z.string(),
              memberCount: z.number().optional(),
              expectedTone: z.string().optional(),
            }),
          )
          .optional(),
        remove: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      if (input.remove?.length) {
        await ctx.prisma.campaignSubreddit.deleteMany({
          where: {
            campaignId: input.campaignId,
            subreddit: { in: input.remove },
          },
        });
      }

      if (input.add?.length) {
        for (const sub of input.add) {
          await ctx.prisma.campaignSubreddit.upsert({
            where: {
              campaignId_subreddit: {
                campaignId: input.campaignId,
                subreddit: sub.name,
              },
            },
            create: {
              campaignId: input.campaignId,
              subreddit: sub.name,
              memberCount: sub.memberCount,
              expectedTone: sub.expectedTone,
            },
            update: {
              memberCount: sub.memberCount,
              expectedTone: sub.expectedTone,
            },
          });
        }
      }

      return ctx.prisma.campaignSubreddit.findMany({
        where: { campaignId: input.campaignId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return ctx.prisma.campaign.delete({
        where: { id: input.id },
      });
    }),
});
