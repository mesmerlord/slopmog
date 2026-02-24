-- CreateEnum
CREATE TYPE "KeywordStrategy" AS ENUM ('FEATURE', 'BRAND', 'COMPETITOR');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "brandStrategyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "competitorStrategyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "featureStrategyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CampaignKeyword" ADD COLUMN     "strategy" "KeywordStrategy" NOT NULL DEFAULT 'FEATURE';

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "relevanceReasoning" TEXT,
ADD COLUMN     "scoredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CampaignKeyword_campaignId_strategy_idx" ON "CampaignKeyword"("campaignId", "strategy");
