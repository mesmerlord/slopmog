import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";

export const campaignRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.campaign.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        keywords: true,
        _count: { select: { posts: true } },
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
          posts: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new Error("Campaign not found");
      }

      return campaign;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        keywords: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.campaign.create({
        data: {
          name: input.name,
          description: input.description,
          userId: ctx.session.user.id,
          keywords: {
            create: input.keywords.map((keyword) => ({ keyword })),
          },
        },
        include: { keywords: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new Error("Campaign not found");
      }

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          status: input.status,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
      });

      if (!campaign || campaign.userId !== ctx.session.user.id) {
        throw new Error("Campaign not found");
      }

      return ctx.prisma.campaign.delete({
        where: { id: input.id },
      });
    }),
});
