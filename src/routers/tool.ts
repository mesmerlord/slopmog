import { z } from "zod";
import { router, publicProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { getRedditPostWithComments } from "@/services/discovery/scrape-creators";
import { analyzeSite } from "@/services/discovery/site-analyzer";
import { generateComment } from "@/services/generation/generator";

export const toolRouter = router({
  scrapeRedditPost: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const parsed = new URL(input.url);
      if (!parsed.hostname.includes("reddit.com")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please provide a valid Reddit URL",
        });
      }

      const result = await getRedditPostWithComments(input.url);
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Couldn't fetch that Reddit post. Check the URL and try again.",
        });
      }

      return result;
    }),

  generateFreeComment: publicProcedure
    .input(
      z.object({
        postTitle: z.string(),
        postBody: z.string(),
        subreddit: z.string(),
        existingComments: z.array(
          z.object({
            author: z.string(),
            body: z.string(),
            score: z.number(),
            isOp: z.boolean(),
          }),
        ),
        websiteUrl: z.string(),
        brandNameOverride: z.string().optional(),
        brandDescriptionOverride: z.string().optional(),
        persona: z.string(),
        noLink: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      let siteUrl = input.websiteUrl.trim();
      if (!/^https?:\/\//i.test(siteUrl)) siteUrl = `https://${siteUrl}`;

      const siteAnalysis = await analyzeSite(siteUrl);

      const brandName =
        input.brandNameOverride?.trim() || siteAnalysis.name;
      const brandDescription =
        input.brandDescriptionOverride?.trim() || siteAnalysis.description;

      const result = await generateComment({
        postTitle: input.postTitle,
        postBody: input.postBody,
        sourceContext: input.subreddit,
        platform: "REDDIT",
        existingComments: input.existingComments,
        businessName: brandName,
        businessDescription: brandDescription,
        valueProps: siteAnalysis.valueProps,
        websiteUrl: input.noLink ? undefined : siteUrl,
        brandTone: siteAnalysis.brandTone,
        matchedKeyword: "",
        commentPosition: "top_level",
        postType: "discussion",
        persona: input.persona,
        noLink: input.noLink,
      });

      if (result.noRelevantComment) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Couldn't generate a natural comment for this post. The brand might not be relevant enough to this thread.",
        });
      }

      return {
        text: result.best.text,
        qualityScore: result.best.qualityScore,
        reasons: result.best.reasons,
        variants: result.variants.map((v) => ({
          text: v.text,
          qualityScore: v.qualityScore,
        })),
        brandName,
        brandDescription: siteAnalysis.description,
      };
    }),
});
