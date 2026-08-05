-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CV', 'MOTIVATION_LETTER', 'SUPPORTING_DOCUMENT');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('NOT_SCANNED', 'CLEAN', 'REJECTED', 'SCAN_FAILED');

-- CreateEnum
CREATE TYPE "SenderVerificationStatus" AS ENUM ('UNCONFIGURED', 'PENDING', 'VERIFIED', 'FAILED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EmailSecurityAuditEventType" AS ENUM ('ATTACHMENT_REFERENCE_SELECTED', 'ATTACHMENT_RESOLUTION_STARTED', 'ATTACHMENT_RESOLVED', 'ATTACHMENT_REJECTED', 'ATTACHMENT_SCAN_STARTED', 'ATTACHMENT_SCAN_PASSED', 'ATTACHMENT_SCAN_FAILED', 'DELIVERY_SNAPSHOT_CREATED', 'SENDER_IDENTITY_SELECTED', 'SENDER_IDENTITY_REJECTED', 'DOMAIN_READINESS_PASSED', 'DOMAIN_READINESS_FAILED', 'EMAIL_WITH_ATTACHMENTS_QUEUED', 'EMAIL_WITH_ATTACHMENTS_SENT');

-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "attachmentRefs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "senderIdentityId" TEXT;

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageObjectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "safeFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "scanFailureReason" TEXT,
    "scannedAt" TIMESTAMP(3),
    "scopeApplicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sender_identities" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerIdentityRef" TEXT,
    "verificationStatus" "SenderVerificationStatus" NOT NULL DEFAULT 'UNCONFIGURED',
    "dkimVerified" BOOLEAN NOT NULL DEFAULT false,
    "spfReady" BOOLEAN NOT NULL DEFAULT false,
    "dmarcReady" BOOLEAN NOT NULL DEFAULT false,
    "replyToEmailAddress" TEXT,
    "allowedRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_security_audit_events" (
    "id" TEXT NOT NULL,
    "eventType" "EmailSecurityAuditEventType" NOT NULL,
    "documentId" TEXT,
    "emailMessageId" TEXT,
    "senderIdentityId" TEXT,
    "userId" TEXT,
    "applicationId" TEXT,
    "campaignId" TEXT,
    "detail" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_security_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_documents_storageObjectKey_key" ON "candidate_documents"("storageObjectKey");

-- CreateIndex
CREATE INDEX "candidate_documents_ownerUserId_documentType_isActive_idx" ON "candidate_documents"("ownerUserId", "documentType", "isActive");

-- CreateIndex
CREATE INDEX "candidate_documents_scopeApplicationId_idx" ON "candidate_documents"("scopeApplicationId");

-- CreateIndex
CREATE INDEX "sender_identities_isActive_idx" ON "sender_identities"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sender_identities_emailAddress_providerId_key" ON "sender_identities"("emailAddress", "providerId");

-- CreateIndex
CREATE INDEX "email_security_audit_events_eventType_idx" ON "email_security_audit_events"("eventType");

-- CreateIndex
CREATE INDEX "email_security_audit_events_documentId_idx" ON "email_security_audit_events"("documentId");

-- CreateIndex
CREATE INDEX "email_security_audit_events_emailMessageId_idx" ON "email_security_audit_events"("emailMessageId");

-- CreateIndex
CREATE INDEX "email_security_audit_events_userId_idx" ON "email_security_audit_events"("userId");

-- CreateIndex
CREATE INDEX "email_security_audit_events_occurredAt_idx" ON "email_security_audit_events"("occurredAt");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "sender_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
