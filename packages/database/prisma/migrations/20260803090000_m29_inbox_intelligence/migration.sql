-- CreateEnum
CREATE TYPE "OAuthCapabilityPurpose" AS ENUM ('SEND_APPLICATION_EMAIL', 'READ_APPLICATION_REPLIES');

-- CreateEnum
CREATE TYPE "InboxCapabilityStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'ACTIVE', 'REAUTHORIZATION_REQUIRED', 'REVOKED', 'USER_DISABLED', 'SYSTEM_SUSPENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InboxWatchStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "CorrelationStatus" AS ENUM ('MATCHED', 'AMBIGUOUS', 'UNRELATED', 'DUPLICATE', 'UNSAFE_TO_PROCESS');

-- CreateEnum
CREATE TYPE "ReplyPrimaryCategory" AS ENUM ('INTERVIEW_INVITATION', 'ACCEPTANCE_OR_OFFER', 'REJECTION', 'DOCUMENT_REQUEST', 'INFORMATION_REQUEST', 'AVAILABILITY_REQUEST', 'ASSESSMENT_OR_TEST_INVITATION', 'APPLICATION_RECEIVED_CONFIRMATION', 'APPLICATION_UNDER_REVIEW', 'WAITLIST_OR_DELAY', 'REFERRAL_TO_OTHER_POSITION', 'WITHDRAWAL_CONFIRMATION', 'AUTOMATIC_REPLY', 'OUT_OF_OFFICE', 'DELIVERY_FAILURE', 'SPAM_OR_UNRELATED', 'NEEDS_MANUAL_REVIEW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReplySecondaryLabel" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'ACTION_REQUIRED', 'DEADLINE_PRESENT', 'INTERVIEW_DATE_PRESENT', 'DOCUMENTS_REQUIRED', 'HUMAN_REPLY', 'AUTOMATED_REPLY');

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('RULE_ENGINE', 'AI', 'USER_CORRECTED');

-- CreateEnum
CREATE TYPE "InboxMessageReviewStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'AUTO_ACCEPTED', 'UNRELATED_CONFIRMED');

-- CreateEnum
CREATE TYPE "InboxMessageCorrectionType" AS ENUM ('CLASSIFICATION', 'EXTRACTED_FACTS', 'CORRELATION', 'UNRELATED_MARK');

-- CreateEnum
CREATE TYPE "ProposedApplicationAction" AS ENUM ('REPLY_RECEIVED', 'INTERVIEW_INVITED', 'DOCUMENTS_REQUESTED', 'INFORMATION_REQUESTED', 'ASSESSMENT_INVITED', 'UNDER_REVIEW', 'REJECTED', 'OFFER_RECEIVED', 'WAITING');

-- CreateEnum
CREATE TYPE "ApplicationTransitionProposalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReplyDraftType" AS ENUM ('INTERVIEW_ACCEPTANCE', 'REQUEST_ALTERNATIVE_TIME', 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT', 'INFORMATION_RESPONSE', 'POLITE_FOLLOWUP', 'OFFER_ACKNOWLEDGMENT', 'REJECTION_ACKNOWLEDGMENT');

-- CreateEnum
CREATE TYPE "ReplyDraftStatus" AS ENUM ('DRAFT', 'EDITED', 'APPROVED', 'SENT', 'DISCARDED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('INTERVIEW_INVITATION', 'OFFER_OR_ACCEPTANCE', 'REJECTION', 'DOCUMENTS_REQUESTED', 'DEADLINE_APPROACHING', 'ASSESSMENT_INVITATION', 'INBOX_CONNECTION_FAILURE', 'REAUTHORIZATION_REQUIRED', 'AMBIGUOUS_REPLY_REVIEW');

-- AlterEnum
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_CONSENT_STARTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_CONSENT_GRANTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_CONSENT_REJECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_CONSENT_REVOKED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_WATCH_REGISTERED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_WATCH_RENEWED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_WATCH_FAILED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_CHANGE_RECEIVED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_CORRELATION_MATCHED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_CORRELATION_AMBIGUOUS';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_REJECTED_AS_UNRELATED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_CLASSIFIED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_CLASSIFICATION_CORRECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_FACTS_EXTRACTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_FACTS_CORRECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_TRANSITION_PROPOSED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_TRANSITION_CONFIRMED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_TRANSITION_REJECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CAMPAIGN_FOLLOWUP_PAUSED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_DRAFT_CREATED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_DRAFT_EDITED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_DRAFT_APPROVED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'REPLY_SENT_BY_USER';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'INBOX_REAUTHORIZATION_REQUIRED';

-- AlterTable
ALTER TABLE "connected_mailbox_send_attempts" ADD COLUMN     "rfcMessageId" TEXT;

-- AlterTable
ALTER TABLE "connected_mailboxes" ADD COLUMN     "inboxCapabilityStatus" "InboxCapabilityStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "inboxConsentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "inboxConsentVersion" TEXT,
ADD COLUMN     "inboxFailureCategory" "ConnectedMailboxFailureCategory",
ADD COLUMN     "inboxFailureReason" TEXT,
ADD COLUMN     "inboxGrantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inboxReauthorizationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inboxRevokedAt" TIMESTAMP(3),
ADD COLUMN     "inboxSuspensionReason" TEXT,
ADD COLUMN     "inboxSystemSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inboxUserDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSuccessfulInboxAccessAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "email_security_audit_events" ADD COLUMN     "inboxMessageId" TEXT;

-- AlterTable
ALTER TABLE "oauth_transactions" ADD COLUMN     "capability" "OAuthCapabilityPurpose" NOT NULL DEFAULT 'SEND_APPLICATION_EMAIL';

-- CreateTable
CREATE TABLE "inbox_watches" (
    "id" TEXT NOT NULL,
    "connectedMailboxId" TEXT NOT NULL,
    "provider" "ConnectedMailboxProvider" NOT NULL,
    "status" "InboxWatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerWatchId" TEXT,
    "historyCursor" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastRenewedAt" TIMESTAMP(3),
    "lastNotificationAt" TIMESTAMP(3),
    "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" TEXT NOT NULL,
    "connectedMailboxId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "rfcMessageId" TEXT,
    "inReplyTo" TEXT,
    "referencesHeaders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "correlationStatus" "CorrelationStatus" NOT NULL,
    "correlationConfidence" DOUBLE PRECISION,
    "correlationEvidence" JSONB NOT NULL DEFAULT '{}',
    "correlatedApplicationId" TEXT,
    "correlatedCampaignId" TEXT,
    "contentHashSha256" TEXT NOT NULL,
    "sanitizedExcerpt" TEXT,
    "detectedLanguage" TEXT,
    "primaryCategory" "ReplyPrimaryCategory",
    "secondaryLabels" "ReplySecondaryLabel"[] DEFAULT ARRAY[]::"ReplySecondaryLabel"[],
    "classificationConfidence" DOUBLE PRECISION,
    "classificationEvidence" JSONB,
    "classificationSource" "ClassificationSource",
    "classificationRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractedFacts" JSONB,
    "reviewStatus" "InboxMessageReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_message_corrections" (
    "id" TEXT NOT NULL,
    "inboxMessageId" TEXT NOT NULL,
    "correctionType" "InboxMessageCorrectionType" NOT NULL,
    "originalValue" JSONB NOT NULL,
    "correctedValue" JSONB NOT NULL,
    "correctedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_message_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_transition_proposals" (
    "id" TEXT NOT NULL,
    "inboxMessageId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "proposedAction" "ProposedApplicationAction" NOT NULL,
    "classification" "ReplyPrimaryCategory",
    "confidence" DOUBLE PRECISION,
    "evidence" JSONB,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "status" "ApplicationTransitionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_transition_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_drafts" (
    "id" TEXT NOT NULL,
    "inboxMessageId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "connectedMailboxId" TEXT NOT NULL,
    "draftType" "ReplyDraftType" NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "placeholders" JSONB NOT NULL DEFAULT '[]',
    "status" "ReplyDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentConnectedMailboxSendAttemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reply_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "relatedInboxMessageId" TEXT,
    "relatedApplicationId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interviewInvitationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "offerOrAcceptanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rejectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "documentsRequestedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deadlineApproachingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "assessmentInvitationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inboxConnectionIssuesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ambiguousReplyReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_watches_connectedMailboxId_key" ON "inbox_watches"("connectedMailboxId");

-- CreateIndex
CREATE INDEX "inbox_watches_status_expiresAt_idx" ON "inbox_watches"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "inbox_messages_connectedMailboxId_correlationStatus_idx" ON "inbox_messages"("connectedMailboxId", "correlationStatus");

-- CreateIndex
CREATE INDEX "inbox_messages_connectedMailboxId_reviewStatus_idx" ON "inbox_messages"("connectedMailboxId", "reviewStatus");

-- CreateIndex
CREATE INDEX "inbox_messages_correlatedApplicationId_idx" ON "inbox_messages"("correlatedApplicationId");

-- CreateIndex
CREATE INDEX "inbox_messages_contentHashSha256_idx" ON "inbox_messages"("contentHashSha256");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_connectedMailboxId_providerMessageId_key" ON "inbox_messages"("connectedMailboxId", "providerMessageId");

-- CreateIndex
CREATE INDEX "inbox_message_corrections_inboxMessageId_idx" ON "inbox_message_corrections"("inboxMessageId");

-- CreateIndex
CREATE INDEX "application_transition_proposals_applicationId_idx" ON "application_transition_proposals"("applicationId");

-- CreateIndex
CREATE INDEX "application_transition_proposals_inboxMessageId_idx" ON "application_transition_proposals"("inboxMessageId");

-- CreateIndex
CREATE INDEX "application_transition_proposals_status_idx" ON "application_transition_proposals"("status");

-- CreateIndex
CREATE INDEX "reply_drafts_inboxMessageId_idx" ON "reply_drafts"("inboxMessageId");

-- CreateIndex
CREATE INDEX "reply_drafts_applicationId_idx" ON "reply_drafts"("applicationId");

-- CreateIndex
CREATE INDEX "reply_drafts_connectedMailboxId_idx" ON "reply_drafts"("connectedMailboxId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "connected_mailbox_send_attempts_connectedMailboxId_provider_idx" ON "connected_mailbox_send_attempts"("connectedMailboxId", "providerThreadId");

-- CreateIndex
CREATE INDEX "connected_mailbox_send_attempts_connectedMailboxId_rfcMessa_idx" ON "connected_mailbox_send_attempts"("connectedMailboxId", "rfcMessageId");

-- CreateIndex
CREATE INDEX "connected_mailboxes_userId_inboxCapabilityStatus_idx" ON "connected_mailboxes"("userId", "inboxCapabilityStatus");

-- CreateIndex
CREATE INDEX "email_security_audit_events_inboxMessageId_idx" ON "email_security_audit_events"("inboxMessageId");

-- AddForeignKey
ALTER TABLE "inbox_watches" ADD CONSTRAINT "inbox_watches_connectedMailboxId_fkey" FOREIGN KEY ("connectedMailboxId") REFERENCES "connected_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_connectedMailboxId_fkey" FOREIGN KEY ("connectedMailboxId") REFERENCES "connected_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_message_corrections" ADD CONSTRAINT "inbox_message_corrections_inboxMessageId_fkey" FOREIGN KEY ("inboxMessageId") REFERENCES "inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_transition_proposals" ADD CONSTRAINT "application_transition_proposals_inboxMessageId_fkey" FOREIGN KEY ("inboxMessageId") REFERENCES "inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_drafts" ADD CONSTRAINT "reply_drafts_inboxMessageId_fkey" FOREIGN KEY ("inboxMessageId") REFERENCES "inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_drafts" ADD CONSTRAINT "reply_drafts_connectedMailboxId_fkey" FOREIGN KEY ("connectedMailboxId") REFERENCES "connected_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
