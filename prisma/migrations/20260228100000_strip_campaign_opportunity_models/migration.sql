-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_userId_fkey";
ALTER TABLE "CampaignKeyword" DROP CONSTRAINT IF EXISTS "CampaignKeyword_campaignId_fkey";
ALTER TABLE "CampaignPost" DROP CONSTRAINT IF EXISTS "CampaignPost_campaignId_fkey";
ALTER TABLE "CampaignSubreddit" DROP CONSTRAINT IF EXISTS "CampaignSubreddit_campaignId_fkey";
ALTER TABLE "CampaignTwitterAccount" DROP CONSTRAINT IF EXISTS "CampaignTwitterAccount_campaignId_fkey";
ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_campaignId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Opportunity";
DROP TABLE IF EXISTS "CampaignPost";
DROP TABLE IF EXISTS "CampaignKeyword";
DROP TABLE IF EXISTS "CampaignSubreddit";
DROP TABLE IF EXISTS "CampaignTwitterAccount";
DROP TABLE IF EXISTS "Campaign";

-- DropEnum
DROP TYPE IF EXISTS "AutomationMode";
DROP TYPE IF EXISTS "CampaignStatus";
DROP TYPE IF EXISTS "DiscoverySource";
DROP TYPE IF EXISTS "KeywordStrategy";
DROP TYPE IF EXISTS "OpportunityStatus";
DROP TYPE IF EXISTS "Platform";
DROP TYPE IF EXISTS "PostStatus";
