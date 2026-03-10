import { z } from "zod";
import { chatCompletionJSON, HV_ONLINE_MODELS } from "@/lib/openrouter";
import { prisma } from "@/server/utils/db";
import type { DiscoveryConfig } from "@/services/discovery/config";

// ─── Types ───────────────────────────────────────────────────

export interface GrokTweetResult {
  tweetId: string;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  url: string;
}

export interface GrokProfileResult {
  handle: string;
  displayName: string;
  bio: string;
  followerCount: number;
  relevanceScore: number;
  reason: string;
}

interface ProfileValidation {
  handle: string;
  displayName: string;
  bio: string;
  followerCount: number;
  profileImageUrl: string | null;
  profileUrl: string;
}

// ─── Schemas ─────────────────────────────────────────────────

const GrokProfileSchema = z.array(
  z.object({
    handle: z.string(),
    displayName: z.string(),
    bio: z.string(),
    followerCount: z.number(),
    relevanceScore: z.number().min(0).max(1),
    reason: z.string(),
  }),
);

const GrokTweetSchema = z.array(
  z.object({
    tweetId: z.string(),
    text: z.string(),
    likes: z.number(),
    replies: z.number(),
    reposts: z.number(),
    url: z.string(),
  }),
);

const ProfileValidationSchema = z
  .object({
    exists: z.boolean(),
    handle: z.string().optional(),
    displayName: z.string().optional(),
    bio: z.string().optional(),
    followerCount: z.number().optional(),
    profileImageUrl: z.string().nullable().optional(),
    profileUrl: z.string().optional(),
  })
  .nullable();

// ─── Profile Discovery ──────────────────────────────────────

interface DiscoverProfilesContext {
  nicheKeywords: string[];
  siteName: string;
  siteDescription: string;
}

export async function discoverTwitterProfiles(
  siteId: string,
  context: DiscoverProfilesContext,
  cfg: DiscoveryConfig,
): Promise<GrokProfileResult[]> {
  console.log(`[twitter-discovery] Discovering profiles for site ${siteId} with keywords: ${context.nicheKeywords.join(", ")}`);

  const profiles = await chatCompletionJSON({
    model: HV_ONLINE_MODELS.GROK_ONLINE,
    messages: [
      {
        role: "system",
        content: `You are a Twitter/X expert. Search X for real, active accounts that post about the given niche. Only return accounts that actually exist on X right now. Return JSON array only.`,
      },
      {
        role: "user",
        content: `What are the top ${cfg.maxTrackedProfiles} X/Twitter accounts that regularly post about these topics: ${context.nicheKeywords.join(", ")}?

Context: We're looking for accounts relevant to "${context.siteName}" — ${context.siteDescription}

Requirements:
- Only real, currently active accounts
- Minimum ${cfg.minTwitterFollowers} followers
- Accounts that post original content (not just retweets)
- Mix of influencers, experts, and active community members

Return a JSON array where each item has:
- handle: the @username (without @)
- displayName: their display name
- bio: their bio/description
- followerCount: approximate follower count
- relevanceScore: 0.0-1.0 how relevant they are to the niche
- reason: one sentence explaining why they're relevant`,
      },
    ],
    temperature: 0.3,
    webSearch: true,
    schema: GrokProfileSchema,
  });

  // Load existing tracked profiles for dedup
  const existing = await prisma.trackedProfile.findMany({
    where: { siteId, platform: "TWITTER" },
    select: { handleLower: true },
  });
  const existingHandles = new Set(existing.map((p) => p.handleLower));

  // Filter: remove dupes, below min followers, cap at maxTrackedProfiles
  const newProfiles = profiles.filter((p) => {
    const handleLower = p.handle.toLowerCase().replace(/^@/, "");
    if (existingHandles.has(handleLower)) return false;
    if (p.followerCount < cfg.minTwitterFollowers) return false;
    return true;
  });

  // Sort by relevance and cap
  const currentCount = existing.length;
  const remainingSlots = Math.max(0, cfg.maxTrackedProfiles - currentCount);
  const toSave = newProfiles
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, remainingSlots);

  // Save to DB
  for (const profile of toSave) {
    const handle = profile.handle.replace(/^@/, "");
    await prisma.trackedProfile.create({
      data: {
        siteId,
        platform: "TWITTER",
        handle,
        handleLower: handle.toLowerCase(),
        displayName: profile.displayName,
        bio: profile.bio,
        followerCount: profile.followerCount,
        profileUrl: `https://x.com/${handle}`,
        discoveredBy: "GROK_SEARCH",
        relevanceScore: profile.relevanceScore,
        relevanceReason: profile.reason,
      },
    });
  }

  console.log(`[twitter-discovery] Saved ${toSave.length} new profiles (${existing.length} existing, ${newProfiles.length - toSave.length} capped)`);
  return toSave;
}

// ─── Tweet Fetching ──────────────────────────────────────────

export async function fetchTweetsForProfile(
  handle: string,
  tweetsPerProfile = 15,
): Promise<GrokTweetResult[]> {
  const cleanHandle = handle.replace(/^@/, "");
  console.log(`[twitter-discovery] Fetching ${tweetsPerProfile} tweets for @${cleanHandle}`);

  const tweets = await chatCompletionJSON({
    model: HV_ONLINE_MODELS.GROK_ONLINE,
    messages: [
      {
        role: "system",
        content: `You have real-time access to X/Twitter. Fetch the latest tweets for the given account. Return JSON array only. Only include original tweets, NOT retweets or quote tweets.`,
      },
      {
        role: "user",
        content: `What are @${cleanHandle}'s latest ${tweetsPerProfile} original tweets (not retweets)?

Return a JSON array where each item has:
- tweetId: the tweet ID (numeric string)
- text: the full tweet text
- likes: number of likes
- replies: number of replies
- reposts: number of reposts/retweets
- url: the full tweet URL (https://x.com/${cleanHandle}/status/{tweetId})`,
      },
    ],
    temperature: 0.1,
    webSearch: true,
    schema: GrokTweetSchema,
  });

  console.log(`[twitter-discovery] Got ${tweets.length} tweets from @${cleanHandle}`);
  return tweets;
}

// ─── Tweet Replies ───────────────────────────────────────────

export interface GrokTweetReply {
  author: string;
  text: string;
  likes: number;
}

const GrokTweetReplySchema = z.array(
  z.object({
    author: z.string(),
    text: z.string(),
    likes: z.number(),
  }),
);

export async function fetchTweetReplies(
  tweetUrl: string,
): Promise<GrokTweetReply[]> {
  console.log(`[twitter-discovery] Fetching replies for ${tweetUrl}`);

  const replies = await chatCompletionJSON({
    model: HV_ONLINE_MODELS.GROK_ONLINE,
    messages: [
      {
        role: "system",
        content: `You have real-time access to X/Twitter. Fetch the top replies to the given tweet. Return JSON array only.`,
      },
      {
        role: "user",
        content: `What are the top 15 replies to this tweet: ${tweetUrl}

Return a JSON array where each item has:
- author: the @username of the replier (without @)
- text: the reply text
- likes: number of likes on the reply

Sort by likes descending. Only include direct replies, not replies-to-replies.`,
      },
    ],
    temperature: 0.1,
    webSearch: true,
    schema: GrokTweetReplySchema,
  });

  console.log(`[twitter-discovery] Got ${replies.length} replies for ${tweetUrl}`);
  return replies;
}

// ─── Profile Validation (for manual add) ─────────────────────

export async function validateTwitterProfile(
  handle: string,
): Promise<ProfileValidation | null> {
  const cleanHandle = handle.replace(/^@/, "");

  const result = await chatCompletionJSON({
    model: HV_ONLINE_MODELS.GROK_ONLINE,
    messages: [
      {
        role: "system",
        content: `You have real-time access to X/Twitter. Look up the given profile and return its info. If the account doesn't exist or is suspended, return null. Return JSON only.`,
      },
      {
        role: "user",
        content: `Give me the X/Twitter profile info for @${cleanHandle}.

Return JSON with:
- exists: boolean (true if account exists and is active)
- handle: their current username
- displayName: their display name
- bio: their bio
- followerCount: number of followers
- profileImageUrl: their profile image URL (or null)
- profileUrl: their profile URL

If the account doesn't exist or is suspended, return null.`,
      },
    ],
    temperature: 0.1,
    webSearch: true,
    schema: ProfileValidationSchema,
  });

  if (!result || !result.exists) return null;

  return {
    handle: result.handle ?? cleanHandle,
    displayName: result.displayName ?? cleanHandle,
    bio: result.bio ?? "",
    followerCount: result.followerCount ?? 0,
    profileImageUrl: result.profileImageUrl ?? null,
    profileUrl: result.profileUrl ?? `https://x.com/${cleanHandle}`,
  };
}
