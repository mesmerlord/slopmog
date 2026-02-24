-- CreateTable
CREATE TABLE "stripe_processed_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripe_subscriptions_customerId_idx" ON "stripe_subscriptions"("customerId");

-- CreateIndex
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions"("status");
