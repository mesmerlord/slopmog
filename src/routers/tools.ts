import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "@/server/trpc";
import { getPostComments } from "@/services/reddit/client";
import { generateComment } from "@/services/generation/comment-generator";
import { checkRateLimit } from "@/services/shared/http";
import type { CommentGenerationInput } from "@/services/generation/types";

function getClientIp(req?: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  if (!req) return "unknown";
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() || "unknown";
  }
  return req.socket?.remoteAddress || "unknown";
}

function inferPostType(title: string): "question" | "showcase" | "discussion" {
  const lower = title.toLowerCase();
  if (lower.includes("?")) return "question";
  if (lower.includes("i built") || lower.includes("i made") || lower.startsWith("show ") || lower.includes("[show]")) return "showcase";
  return "discussion";
}

const REDDIT_URL_REGEX = /^https?:\/\/(www\.)?reddit\.com\/r\/\w+\/comments\/\w+/;

export const toolsRouter = router({
  scrapePost: publicProcedure
    .input(z.object({
      url: z.string().url().refine((u) => REDDIT_URL_REGEX.test(u), {
        message: "Must be a Reddit post URL (e.g. https://reddit.com/r/subreddit/comments/...)",
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp(ctx.req);
      const rateCheck = await checkRateLimit({
        key: `free-tool:scrape:${ip}`,
        maxRequests: 10,
        windowMs: 3600_000,
      });

      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You've hit the free limit. Try again in ${Math.ceil(rateCheck.resetMs / 60_000)} minutes, or sign up for unlimited access.`,
        });
      }

      try {
        const { post, comments, subredditInfo } = await getPostComments(input.url);

        const topComments = comments
          .sort((a, b) => b.score - a.score)
          .slice(0, 15)
          .map((c) => ({
            id: c.id,
            body: c.body.slice(0, 500),
            author: c.author,
            score: c.score,
            isOp: c.isOp,
          }));

        return {
          post: {
            title: post.title,
            selftext: post.selftext.slice(0, 2000),
            subreddit: post.subreddit,
            author: post.author,
            score: post.score,
            numComments: post.numComments,
          },
          comments: topComments,
          subredditInfo,
        };
      } catch (error) {
        console.error("[tools/scrapePost] Failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch Reddit post. Check the URL and try again.",
        });
      }
    }),

  generateFreeComment: publicProcedure
    .input(z.object({
      post: z.object({
        title: z.string(),
        selftext: z.string(),
        subreddit: z.string(),
        author: z.string(),
        score: z.number(),
        numComments: z.number(),
      }),
      comments: z.array(z.object({
        id: z.string(),
        body: z.string(),
        author: z.string(),
        score: z.number(),
        isOp: z.boolean(),
      })),
      websiteUrl: z.string().url().max(300).optional(),
      brandName: z.string().min(1).max(100),
      brandDescription: z.string().max(500).default(""),
      persona: z.string().default("auto"),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp(ctx.req);
      const rateCheck = await checkRateLimit({
        key: `free-tool:generate:${ip}`,
        maxRequests: 5,
        windowMs: 3600_000,
      });

      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You've used all 5 free generations this hour. Sign up to generate unlimited comments.`,
        });
      }

      const postType = inferPostType(input.post.title);

      const description = input.brandDescription || input.brandName;

      const genInput: CommentGenerationInput = {
        postTitle: input.post.title,
        postBody: input.post.selftext,
        subreddit: input.post.subreddit,
        existingComments: input.comments.map((c) => ({
          author: c.author,
          body: c.body,
          score: c.score,
          isOp: c.isOp,
        })),
        businessName: input.brandName,
        businessDescription: description,
        valueProps: [description],
        websiteUrl: input.websiteUrl,
        brandTone: "friendly",
        matchedKeyword: input.brandName,
        commentPosition: "top_level",
        postType,
        persona: input.persona,
      };

      try {
        const result = await generateComment(genInput);

        if (result.noRelevantComment) {
          return {
            success: false as const,
            comment: null,
            message: "The AI couldn't find a natural way to mention your brand in this thread. Try a different post.",
          };
        }

        return {
          success: true as const,
          comment: {
            text: result.best.text,
            qualityScore: result.best.qualityScore,
            reasons: result.best.reasons,
            variants: result.variants.map((v) => ({
              text: v.text,
              qualityScore: v.qualityScore,
            })),
          },
          message: null,
        };
      } catch (error) {
        console.error("[tools/generateFreeComment] Failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Comment generation failed. Please try again.",
        });
      }
    }),
});
