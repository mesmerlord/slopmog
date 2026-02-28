-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('REDDIT', 'YOUTUBE', 'TWITTER');

-- AlterTable: Campaign - add platforms array
ALTER TABLE "Campaign" ADD COLUMN "platforms" "Platform"[] DEFAULT ARRAY['REDDIT']::"Platform"[];

-- CreateTable: CampaignTwitterAccount
CREATE TABLE "CampaignTwitterAccount" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "followerCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTwitterAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignTwitterAccount_campaignId_username_key" ON "CampaignTwitterAccount"("campaignId", "username");
CREATE INDEX "CampaignTwitterAccount_campaignId_idx" ON "CampaignTwitterAccount"("campaignId");

ALTER TABLE "CampaignTwitterAccount" ADD CONSTRAINT "CampaignTwitterAccount_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Opportunity - rename columns (preserving data)
ALTER TABLE "Opportunity" RENAME COLUMN "redditPostId" TO "externalId";
ALTER TABLE "Opportunity" RENAME COLUMN "redditUrl" TO "sourceUrl";
ALTER TABLE "Opportunity" RENAME COLUMN "subreddit" TO "sourceContext";
ALTER TABLE "Opportunity" RENAME COLUMN "redditCreatedAt" TO "contentCreatedAt";

-- Add new columns with backfill
ALTER TABLE "Opportunity" ADD COLUMN "platform" "Platform";
ALTER TABLE "Opportunity" ADD COLUMN "discoveryDate" TIMESTAMP(3);

-- Backfill existing rows
UPDATE "Opportunity" SET "platform" = 'REDDIT' WHERE "platform" IS NULL;
UPDATE "Opportunity" SET "discoveryDate" = DATE_TRUNC('day', "discoveredAt") WHERE "discoveryDate" IS NULL;

-- Now make platform NOT NULL
ALTER TABLE "Opportunity" ALTER COLUMN "platform" SET NOT NULL;

-- Drop old unique constraint and index
DROP INDEX IF EXISTS "Opportunity_campaignId_redditPostId_parentCommentId_key";
DROP INDEX IF EXISTS "Opportunity_subreddit_idx";

-- Create new unique constraint and indexes
CREATE UNIQUE INDEX "Opportunity_campaignId_platform_externalId_parentCommentId_key" ON "Opportunity"("campaignId", "platform", "externalId", "parentCommentId");
CREATE INDEX "Opportunity_campaignId_discoveryDate_idx" ON "Opportunity"("campaignId", "discoveryDate");
CREATE INDEX "Opportunity_sourceContext_idx" ON "Opportunity"("sourceContext");
