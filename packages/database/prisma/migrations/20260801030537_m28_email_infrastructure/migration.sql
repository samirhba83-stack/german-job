-- CreateEnum
CREATE TYPE "EmailPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'DEFERRED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'DEAD_LETTER', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('QUEUED', 'SENDING_STARTED', 'PROVIDER_SELECTED', 'PROVIDER_FAILOVER', 'SENT', 'DELIVERED', 'DEFERRED', 'BOUNCED_SOFT', 'BOUNCED_HARD', 'COMPLAINED', 'OPENED', 'CLICKED', 'RETRY_SCHEDULED', 'FAILED', 'DEAD_LETTERED', 'SUPPRESSED_SKIP');

-- CreateEnum
CREATE TYPE "EmailSuppressionReason" AS ENUM ('HARD_BOUNCE', 'COMPLAINT', 'MANUAL', 'UNSUBSCRIBE');

-- CreateEnum
CREATE TYPE "EmailWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED');

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "priority" "EmailPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "plainTextBody" TEXT,
    "htmlBody" TEXT,
    "attachmentsMeta" JSONB NOT NULL DEFAULT '[]',
    "providerId" TEXT,
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "correlationId" TEXT,
    "traceId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "eventType" "EmailEventType" NOT NULL,
    "providerId" TEXT,
    "detail" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppression_entries" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "reason" "EmailSuppressionReason" NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppression_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_provider_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "rawPayloadHash" TEXT NOT NULL,
    "status" "EmailWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "failureReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "email_provider_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_provider_health_states" (
    "providerId" TEXT NOT NULL,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "circuitOpenUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_provider_health_states_pkey" PRIMARY KEY ("providerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_idempotencyKey_key" ON "email_messages"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_messages_status_priority_nextAttemptAt_idx" ON "email_messages"("status", "priority", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "email_messages_providerId_providerMessageId_idx" ON "email_messages"("providerId", "providerMessageId");

-- CreateIndex
CREATE INDEX "email_messages_recipientEmail_idx" ON "email_messages"("recipientEmail");

-- CreateIndex
CREATE INDEX "email_messages_campaignId_idx" ON "email_messages"("campaignId");

-- CreateIndex
CREATE INDEX "email_events_emailMessageId_idx" ON "email_events"("emailMessageId");

-- CreateIndex
CREATE INDEX "email_events_eventType_idx" ON "email_events"("eventType");

-- CreateIndex
CREATE INDEX "email_events_occurredAt_idx" ON "email_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_suppression_entries_emailAddress_key" ON "email_suppression_entries"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "email_provider_webhook_events_providerEventId_key" ON "email_provider_webhook_events"("providerEventId");

-- CreateIndex
CREATE INDEX "email_provider_webhook_events_provider_eventType_idx" ON "email_provider_webhook_events"("provider", "eventType");

-- CreateIndex
CREATE INDEX "email_provider_webhook_events_status_idx" ON "email_provider_webhook_events"("status");

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
