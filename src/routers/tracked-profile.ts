import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc";
import {
  validateTwitterProfile,
  discoverTwitterProfiles,
  fetchTweetsForProfile,
} from "@/services/discovery/twitter-discovery";
import {
  scoreOpportunityBatch,
  type ScoreInput,
  type SiteContext,
} from "@/services/discovery/scorer";
import { parseDiscoveryConfig } from "@/services/discovery/config";
import { generationQueue, type GenerationJobData } from "@/queue/queues";
import type { Prisma } from "@prisma/client";

export const trackedProfileRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        platform: z.enum(["TWITTER"]).optional(),
        active: z.boolean().optional(),
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

      const where: Record<string, unknown> = { siteId: input.siteId };
      if (input.platform) where.platform = input.platform;
      if (input.active !== undefined) where.active = input.active;

      return ctx.prisma.trackedProfile.findMany({
        where,
        orderBy: [{ relevanceScore: "desc" }, { createdAt: "desc" }],
      });
    }),

  add: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        handle: z.string().min(1).max(50),
        platform: z.enum(["TWITTER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const cleanHandle = input.handle.replace(/^@/, "");
      const handleLower = cleanHandle.toLowerCase();

      // Check if already tracked
      const existing = await ctx.prisma.trackedProfile.findUnique({
        where: {
          siteId_platform_handleLower: {
            siteId: input.siteId,
            platform: input.platform,
            handleLower,
          },
        },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: `@${cleanHandle} is already tracked` });
      }

      // Validate profile via Grok
      const profileInfo = await validateTwitterProfile(cleanHandle);
      if (!profileInfo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `@${cleanHandle} doesn't exist or is suspended on X`,
        });
      }

      // Save profile
      const profile = await ctx.prisma.trackedProfile.create({
        data: {
          siteId: input.siteId,
          platform: input.platform,
          handle: profileInfo.handle,
          handleLower: profileInfo.handle.toLowerCase(),
          displayName: profileInfo.displayName,
          bio: profileInfo.bio,
          followerCount: profileInfo.followerCount,
          profileImageUrl: profileInfo.profileImageUrl,
          profileUrl: profileInfo.profileUrl,
          discoveredBy: "MANUAL",
          relevanceScore: 0,
        },
      });

      // Trigger tweet discovery for this profile
      try {
        const cfg = parseDiscoveryConfig(site.discoveryConfig);
        const tweets = await fetchTweetsForProfile(profile.handle, cfg.twitterTweetsPerProfile);

        const items: ScoreInput[] = tweets
          .filter((t) => t.likes >= cfg.minTweetLikes)
          .map((t) => ({
            externalId: t.tweetId,
            title: t.text,
            sourceContext: `@${profile.handle}`,
            platform: "TWITTER" as const,
          }));

        if (items.length > 0) {
          const siteContext: SiteContext = {
            name: site.name,
            description: site.description,
            valueProps: site.valueProps,
            keywords: site.keywords,
          };

          const scored = await scoreOpportunityBatch(items, siteContext);
          const passing = scored.filter((s) => s.relevant);

          // Create a discovery run for tracking
          const run = await ctx.prisma.discoveryRun.create({
            data: {
              siteId: site.id,
              platform: "TWITTER",
              status: "COMPLETED",
              keywordsUsed: [`@${profile.handle}`],
              foundCount: items.length,
              scoredCount: scored.length,
              completedAt: new Date(),
            },
          });

          for (const item of passing) {
            const tweet = tweets.find((t) => t.tweetId === item.externalId);
            if (!tweet) continue;

            const opportunity = await ctx.prisma.opportunity.upsert({
              where: {
                siteId_externalId: { siteId: site.id, externalId: item.externalId },
              },
              create: {
                siteId: site.id,
                discoveryRunId: run.id,
                platform: "TWITTER",
                externalId: item.externalId,
                contentUrl: tweet.url,
                title: tweet.text,
                sourceContext: `@${profile.handle}`,
                matchedKeyword: `@${profile.handle}`,
                author: profile.handle,
                metadata: {
                  likes: tweet.likes,
                  replies: tweet.replies,
                  reposts: tweet.reposts,
                  profileHandle: profile.handle,
                } as Prisma.InputJsonValue,
                relevanceScore: item.relevanceScore,
                postType: item.postType,
                scoreReason: item.scoreReason,
                status: "PENDING_REVIEW",
              },
              update: {
                relevanceScore: item.relevanceScore,
                postType: item.postType,
                scoreReason: item.scoreReason,
              },
            });

            // Auto-generate for top items
            if (item.relevanceScore >= cfg.autoGenerateMinScore) {
              const hasComment = await ctx.prisma.comment.count({
                where: { opportunityId: opportunity.id },
              });
              if (hasComment === 0) {
                await generationQueue.add("generate", {
                  opportunityId: opportunity.id,
                } satisfies GenerationJobData);
              }
            }
          }

          // Update run counts
          await ctx.prisma.discoveryRun.update({
            where: { id: run.id },
            data: { generatedCount: passing.length },
          });
        }

        // Update lastScannedAt
        await ctx.prisma.trackedProfile.update({
          where: { id: profile.id },
          data: { lastScannedAt: new Date() },
        });
      } catch (err) {
        console.error(`[tracked-profile] Tweet discovery failed for @${cleanHandle}:`, err);
        // Profile was saved — tweet discovery can be retried later
      }

      return profile;
    }),

  toggleActive: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.prisma.trackedProfile.findFirst({
        where: {
          id: input.id,
          site: { userId: ctx.session.user.id },
        },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }

      return ctx.prisma.trackedProfile.update({
        where: { id: input.id },
        data: { active: input.active },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.prisma.trackedProfile.findFirst({
        where: {
          id: input.id,
          site: { userId: ctx.session.user.id },
        },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }

      await ctx.prisma.trackedProfile.delete({ where: { id: input.id } });
      return { deleted: true };
    }),

  discoverProfiles: protectedProcedure
    .input(z.object({ siteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const site = await ctx.prisma.site.findFirst({
        where: { id: input.siteId, userId: ctx.session.user.id },
      });

      if (!site) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
      }

      const cfg = parseDiscoveryConfig(site.discoveryConfig);
      const kc = site.keywordConfig as Record<string, string[]> | null;
      const readArr = (key: string) => Array.isArray(kc?.[key]) ? kc[key] : [];
      const nicheKeywords = kc
        ? Array.from(new Set([...readArr("twitter"), ...readArr("features"), ...readArr("competitors")]))
        : site.keywords;

      const profiles = await discoverTwitterProfiles(site.id, {
        nicheKeywords,
        siteName: site.name,
        siteDescription: site.description,
      }, cfg);

      return { discoveredCount: profiles.length };
    }),
});
