-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('REDDIT', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DISCOVERED', 'GENERATING', 'PENDING_REVIEW', 'APPROVED', 'POSTING', 'POSTED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SiteMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valueProps" TEXT[],
    "keywords" TEXT[],
    "brandTone" TEXT NOT NULL,
    "mode" "SiteMode" NOT NULL DEFAULT 'MANUAL',
    "platforms" "Platform"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL,
    "keywordsUsed" TEXT[],
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "scoredCount" INTEGER NOT NULL DEFAULT 0,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "postedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "discoveryRunId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DISCOVERED',
    "externalId" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "sourceContext" TEXT NOT NULL,
    "author" TEXT,
    "viewCount" INTEGER,
    "commentCount" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "matchedKeyword" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "postType" TEXT NOT NULL,
    "scoreReason" TEXT,
    "existingBrandMention" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'DRAFT',
    "text" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL,
    "scoreReasons" TEXT[],
    "providerId" TEXT,
    "orderId" TEXT,
    "postedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Site_userId_idx" ON "Site"("userId");

-- CreateIndex
CREATE INDEX "Site_userId_active_idx" ON "Site"("userId", "active");

-- CreateIndex
CREATE INDEX "DiscoveryRun_siteId_idx" ON "DiscoveryRun"("siteId");

-- CreateIndex
CREATE INDEX "DiscoveryRun_siteId_platform_startedAt_idx" ON "DiscoveryRun"("siteId", "platform", "startedAt");

-- CreateIndex
CREATE INDEX "Opportunity_siteId_status_idx" ON "Opportunity"("siteId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_siteId_platform_status_idx" ON "Opportunity"("siteId", "platform", "status");

-- CreateIndex
CREATE INDEX "Opportunity_discoveryRunId_idx" ON "Opportunity"("discoveryRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_siteId_externalId_key" ON "Opportunity"("siteId", "externalId");

-- CreateIndex
CREATE INDEX "Comment_opportunityId_idx" ON "Comment"("opportunityId");

-- CreateIndex
CREATE INDEX "Comment_siteId_status_idx" ON "Comment"("siteId", "status");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
