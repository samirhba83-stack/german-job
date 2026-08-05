-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('CHECKOUT_CREATED', 'CHECKOUT_EXPIRED', 'PAYMENT_PENDING', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CHANGED', 'SUBSCRIPTION_PAST_DUE', 'SUBSCRIPTION_CANCEL_SCHEDULED', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_EXPIRED', 'REFUND_REQUESTED', 'REFUND_APPROVED', 'REFUND_REJECTED', 'REFUND_ISSUED', 'CHARGE_DISPUTED', 'CHARGEBACK_RECEIVED', 'MANUAL_ADJUSTMENT', 'ENTITLEMENT_GRANTED', 'ENTITLEMENT_REVOKED', 'WEBHOOK_RECEIVED', 'WEBHOOK_REJECTED');

-- CreateEnum
CREATE TYPE "BillingLedgerStatus" AS ENUM ('SUCCESS', 'FAILURE', 'PENDING');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'ISSUED');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END', 'CANCELED', 'REFUNDED');
ALTER TABLE "subscriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "SubscriptionStatus_old";
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropIndex
DROP INDEX "subscriptions_userId_key";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "planId",
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "paddleCustomerId" TEXT NOT NULL,
ADD COLUMN     "paddleSubscriptionId" TEXT NOT NULL,
ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "planCode" "PlanCode" NOT NULL,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "plans";

-- CreateTable
CREATE TABLE "billing_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paddleCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planCode" "PlanCode" NOT NULL,
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "paddleTransactionId" TEXT,
    "paddleCheckoutUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PADDLE',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "signatureValid" BOOLEAN NOT NULL,
    "rawPayloadHash" TEXT NOT NULL,
    "failureReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_ledger_entries" (
    "id" TEXT NOT NULL,
    "eventType" "BillingEventType" NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "checkoutId" TEXT,
    "paymentId" TEXT,
    "planCode" "PlanCode",
    "amountCents" INTEGER,
    "currency" TEXT,
    "status" "BillingLedgerStatus" NOT NULL,
    "reason" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PADDLE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "paddleRefundId" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_userId_key" ON "billing_customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_paddleCustomerId_key" ON "billing_customers"("paddleCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_idempotencyKey_key" ON "checkout_sessions"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_sessions_paddleTransactionId_key" ON "checkout_sessions"("paddleTransactionId");

-- CreateIndex
CREATE INDEX "checkout_sessions_userId_idx" ON "checkout_sessions"("userId");

-- CreateIndex
CREATE INDEX "checkout_sessions_status_idx" ON "checkout_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_providerEventId_key" ON "webhook_events"("providerEventId");

-- CreateIndex
CREATE INDEX "webhook_events_eventType_idx" ON "webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_userId_idx" ON "billing_ledger_entries"("userId");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_subscriptionId_idx" ON "billing_ledger_entries"("subscriptionId");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_eventType_idx" ON "billing_ledger_entries"("eventType");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_occurredAt_idx" ON "billing_ledger_entries"("occurredAt");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_correlationId_idx" ON "billing_ledger_entries"("correlationId");

-- CreateIndex
CREATE INDEX "refunds_subscriptionId_idx" ON "refunds"("subscriptionId");

-- CreateIndex
CREATE INDEX "refunds_userId_idx" ON "refunds"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paddleSubscriptionId_key" ON "subscriptions"("paddleSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_paddleCustomerId_idx" ON "subscriptions"("paddleCustomerId");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
