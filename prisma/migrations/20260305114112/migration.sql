-- CreateEnum
CREATE TYPE "HVQueryCategory" AS ENUM ('COMPARISON', 'RECOMMENDATION', 'REVIEW', 'HOW_TO', 'PROBLEM_SOLVING');

-- CreateEnum
CREATE TYPE "HVOpportunityStatus" AS ENUM ('DISCOVERED', 'GENERATING', 'PENDING_REVIEW', 'APPROVED', 'POSTING', 'POSTED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "HVCommentStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "HVDiscoveryRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL,
    "queriesUsed" TEXT[],
    "citationsFound" INTEGER NOT NULL DEFAULT 0,
    "opportunitiesCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HVDiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HVQuery" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "category" "HVQueryCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HVQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HVQueryResponse" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HVQueryResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HVCitation" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "platform" "Platform",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HVCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HVOpportunity" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "discoveryRunId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "HVOpportunityStatus" NOT NULL DEFAULT 'DISCOVERED',
    "externalId" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "sourceContext" TEXT NOT NULL,
    "author" TEXT,
    "viewCount" INTEGER,
    "commentCount" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "citingModels" TEXT[],
    "citingQueries" TEXT[],
    "citationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "threadAge" INTEGER,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HVOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HVComment" (
    "id" TEXT NOT NULL,
    "hvOpportunityId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "HVCommentStatus" NOT NULL DEFAULT 'DRAFT',
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

    CONSTRAINT "HVComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HVDiscoveryRun_siteId_idx" ON "HVDiscoveryRun"("siteId");

-- CreateIndex
CREATE INDEX "HVDiscoveryRun_siteId_status_idx" ON "HVDiscoveryRun"("siteId", "status");

-- CreateIndex
CREATE INDEX "HVQuery_siteId_idx" ON "HVQuery"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "HVQuery_siteId_query_key" ON "HVQuery"("siteId", "query");

-- CreateIndex
CREATE INDEX "HVQueryResponse_queryId_idx" ON "HVQueryResponse"("queryId");

-- CreateIndex
CREATE UNIQUE INDEX "HVQueryResponse_queryId_model_key" ON "HVQueryResponse"("queryId", "model");

-- CreateIndex
CREATE INDEX "HVCitation_responseId_idx" ON "HVCitation"("responseId");

-- CreateIndex
CREATE INDEX "HVCitation_url_idx" ON "HVCitation"("url");

-- CreateIndex
CREATE INDEX "HVOpportunity_siteId_status_idx" ON "HVOpportunity"("siteId", "status");

-- CreateIndex
CREATE INDEX "HVOpportunity_siteId_platform_status_idx" ON "HVOpportunity"("siteId", "platform", "status");

-- CreateIndex
CREATE INDEX "HVOpportunity_discoveryRunId_idx" ON "HVOpportunity"("discoveryRunId");

-- CreateIndex
CREATE UNIQUE INDEX "HVOpportunity_siteId_externalId_key" ON "HVOpportunity"("siteId", "externalId");

-- CreateIndex
CREATE INDEX "HVComment_hvOpportunityId_idx" ON "HVComment"("hvOpportunityId");

-- CreateIndex
CREATE INDEX "HVComment_siteId_status_idx" ON "HVComment"("siteId", "status");

-- AddForeignKey
ALTER TABLE "HVDiscoveryRun" ADD CONSTRAINT "HVDiscoveryRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVQuery" ADD CONSTRAINT "HVQuery_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVQueryResponse" ADD CONSTRAINT "HVQueryResponse_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "HVQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVCitation" ADD CONSTRAINT "HVCitation_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "HVQueryResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVOpportunity" ADD CONSTRAINT "HVOpportunity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVOpportunity" ADD CONSTRAINT "HVOpportunity_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "HVDiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVComment" ADD CONSTRAINT "HVComment_hvOpportunityId_fkey" FOREIGN KEY ("hvOpportunityId") REFERENCES "HVOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HVComment" ADD CONSTRAINT "HVComment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
