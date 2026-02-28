import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import { postingQueue, type PostingJobData } from "@/queue/queues";

export const commentRouter = router({
  approve: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
        include: { opportunity: true },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.comment.update({
          where: { id: comment.id },
          data: { status: "APPROVED" },
        }),
        ctx.prisma.opportunity.update({
          where: { id: comment.opportunityId },
          data: { status: "APPROVED" },
        }),
      ]);

      await postingQueue.add("post", {
        commentId: comment.id,
      } satisfies PostingJobData);

      return { success: true };
    }),

  skip: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.comment.update({
          where: { id: comment.id },
          data: { status: "SKIPPED" },
        }),
        ctx.prisma.opportunity.update({
          where: { id: comment.opportunityId },
          data: { status: "SKIPPED" },
        }),
      ]);

      return { success: true };
    }),

  edit: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
        text: z.string().min(1).max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: input.commentId,
          site: { userId: ctx.session.user.id },
          status: "DRAFT",
        },
      });

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found or not in DRAFT status" });
      }

      return ctx.prisma.comment.update({
        where: { id: comment.id },
        data: { text: input.text },
      });
    }),

  listPosted: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const comments = await ctx.prisma.comment.findMany({
        where: {
          site: { userId: ctx.session.user.id },
          status: "POSTED",
        },
        include: {
          opportunity: {
            select: {
              title: true,
              contentUrl: true,
              platform: true,
              sourceContext: true,
            },
          },
          site: { select: { name: true } },
        },
        orderBy: { postedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (comments.length > input.limit) {
        const next = comments.pop();
        nextCursor = next?.id;
      }

      return { items: comments, nextCursor };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [draft, posted, failed] = await Promise.all([
      ctx.prisma.comment.count({
        where: { site: { userId }, status: "DRAFT" },
      }),
      ctx.prisma.comment.count({
        where: { site: { userId }, status: "POSTED" },
      }),
      ctx.prisma.comment.count({
        where: { site: { userId }, status: "FAILED" },
      }),
    ]);

    return { draft, posted, failed };
  }),
});
