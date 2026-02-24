-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "parentCommentId" TEXT,
ADD COLUMN "parentCommentBody" TEXT,
ADD COLUMN "parentCommentAuthor" TEXT;

-- DropIndex (old unique constraint)
DROP INDEX IF EXISTS "Opportunity_campaignId_redditPostId_key";

-- CreateIndex (new unique constraint including parentCommentId)
CREATE UNIQUE INDEX "Opportunity_campaignId_redditPostId_parentCommentId_key" ON "Opportunity"("campaignId", "redditPostId", "parentCommentId");
