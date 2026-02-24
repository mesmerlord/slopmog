-- CreateEnum
CREATE TYPE "AutomationMode" AS ENUM ('FULL_MANUAL', 'SEMI_AUTO', 'AUTOPILOT');

-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('SCOUT', 'MINER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DISCOVERED', 'PENDING_REVIEW', 'APPROVED', 'GENERATING', 'READY_FOR_REVIEW', 'POSTING', 'POSTED', 'REJECTED', 'SKIPPED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "automationMode" "AutomationMode" NOT NULL DEFAULT 'SEMI_AUTO',
ADD COLUMN     "brandTone" TEXT,
ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "siteAnalysisData" JSONB,
ADD COLUMN     "targetAudience" TEXT,
ADD COLUMN     "valueProps" JSONB,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "CampaignSubreddit" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "memberCount" INTEGER,
    "expectedTone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignSubreddit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "redditPostId" TEXT NOT NULL,
    "redditUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "postBody" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "numComments" INTEGER NOT NULL DEFAULT 0,
    "matchedKeyword" TEXT NOT NULL,
    "discoverySource" "DiscoverySource" NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DISCOVERED',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "generatedComment" TEXT,
    "commentVersion" INTEGER NOT NULL DEFAULT 0,
    "postedCommentId" TEXT,
    "postedCommentUrl" TEXT,
    "providerUsed" TEXT,
    "postedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignSubreddit_campaignId_idx" ON "CampaignSubreddit"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSubreddit_campaignId_subreddit_key" ON "CampaignSubreddit"("campaignId", "subreddit");

-- CreateIndex
CREATE INDEX "Opportunity_campaignId_status_idx" ON "Opportunity"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_subreddit_idx" ON "Opportunity"("subreddit");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_campaignId_redditPostId_key" ON "Opportunity"("campaignId", "redditPostId");

-- AddForeignKey
ALTER TABLE "CampaignSubreddit" ADD CONSTRAINT "CampaignSubreddit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
