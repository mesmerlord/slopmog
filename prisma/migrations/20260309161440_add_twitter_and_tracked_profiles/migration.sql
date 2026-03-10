-- CreateEnum
CREATE TYPE "ProfileDiscoverySource" AS ENUM ('GROK_SEARCH', 'MANUAL');

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'TWITTER';

-- CreateTable
CREATE TABLE "TrackedProfile" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "handleLower" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "profileImageUrl" TEXT,
    "profileUrl" TEXT,
    "discoveredBy" "ProfileDiscoverySource" NOT NULL DEFAULT 'GROK_SEARCH',
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relevanceReason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastScannedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedProfile_siteId_platform_active_idx" ON "TrackedProfile"("siteId", "platform", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedProfile_siteId_platform_handleLower_key" ON "TrackedProfile"("siteId", "platform", "handleLower");

-- AddForeignKey
ALTER TABLE "TrackedProfile" ADD CONSTRAINT "TrackedProfile_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
