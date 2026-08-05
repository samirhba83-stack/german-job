-- CreateEnum
CREATE TYPE "ConnectedMailboxProvider" AS ENUM ('GOOGLE_GMAIL', 'MICROSOFT_OUTLOOK');

-- CreateEnum
CREATE TYPE "ConnectedMailboxStatus" AS ENUM ('PENDING', 'CONNECTED', 'REAUTHORIZATION_REQUIRED', 'REVOKED', 'USER_DISABLED', 'SYSTEM_SUSPENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConnectedMailboxFailureCategory" AS ENUM ('AUTHENTICATION', 'SCOPE_REJECTED', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'REVOKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OAuthTransactionStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConnectedMailboxSendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BLOCKED');

-- AlterEnum
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_CONNECTION_STARTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_CONNECTION_COMPLETED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_CONNECTION_FAILED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_IDENTITY_VERIFIED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_SCOPE_REJECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_TOKEN_REFRESHED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_REAUTHORIZATION_REQUIRED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_DISCONNECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_REVOKED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'MAILBOX_SYSTEM_SUSPENDED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_RESERVED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_STARTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_ACCEPTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_FAILED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_RATE_LIMITED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_BLOCKED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'CONNECTED_SEND_CANCELLED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'PLATFORM_FALLBACK_REJECTED';

-- AlterTable
ALTER TABLE "email_security_audit_events" ADD COLUMN     "connectedMailboxId" TEXT;

-- CreateTable
CREATE TABLE "connected_mailboxes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectedMailboxProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "ConnectedMailboxStatus" NOT NULL DEFAULT 'PENDING',
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenEncryptionVersion" INTEGER,
    "encryptedRefreshToken" TEXT,
    "encryptedAccessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "hasRefreshToken" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "lastSuccessfulSendAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failureCategory" "ConnectedMailboxFailureCategory",
    "failureReason" TEXT,
    "reauthorizationRequired" BOOLEAN NOT NULL DEFAULT false,
    "userDisabled" BOOLEAN NOT NULL DEFAULT false,
    "systemSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionReason" TEXT,
    "dailySendCount" INTEGER NOT NULL DEFAULT 0,
    "dailySendCountResetAt" TIMESTAMP(3),
    "rollingSendCount" INTEGER NOT NULL DEFAULT 0,
    "rollingWindowStartedAt" TIMESTAMP(3),
    "providerDailyLimit" INTEGER,
    "consentVersion" TEXT,
    "consentAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_transactions" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectedMailboxProvider" NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "status" "OAuthTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_mailbox_send_attempts" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "connectedMailboxId" TEXT NOT NULL,
    "verifiedSenderEmail" TEXT NOT NULL,
    "provider" "ConnectedMailboxProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "applicationId" TEXT,
    "campaignId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyChecksumSha256" TEXT NOT NULL,
    "attachmentRefs" JSONB NOT NULL DEFAULT '[]',
    "status" "ConnectedMailboxSendStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "providerThreadId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailureCategory" TEXT,
    "lastFailureReason" TEXT,
    "correlationId" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_mailbox_send_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connected_mailboxes_userId_status_idx" ON "connected_mailboxes"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connected_mailboxes_userId_provider_providerAccountId_key" ON "connected_mailboxes"("userId", "provider", "providerAccountId");

-- CreateIndex: the real, DB-level "at most one active connected mailbox per user" backstop —
-- see ConnectedMailbox's own schema.prisma doc comment for why this is added proactively here
-- rather than discovered later as a bug (as happened with CandidateDocument in M28.5).
CREATE UNIQUE INDEX "connected_mailboxes_active_per_user_unique" ON "connected_mailboxes"("userId") WHERE "isActive" = true;

-- CreateIndex
CREATE UNIQUE INDEX "oauth_transactions_state_key" ON "oauth_transactions"("state");

-- CreateIndex
CREATE INDEX "oauth_transactions_userId_idx" ON "oauth_transactions"("userId");

-- CreateIndex
CREATE INDEX "oauth_transactions_expiresAt_idx" ON "oauth_transactions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "connected_mailbox_send_attempts_idempotencyKey_key" ON "connected_mailbox_send_attempts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "connected_mailbox_send_attempts_connectedMailboxId_idx" ON "connected_mailbox_send_attempts"("connectedMailboxId");

-- CreateIndex
CREATE INDEX "connected_mailbox_send_attempts_applicationId_idx" ON "connected_mailbox_send_attempts"("applicationId");

-- CreateIndex
CREATE INDEX "connected_mailbox_send_attempts_campaignId_idx" ON "connected_mailbox_send_attempts"("campaignId");

-- CreateIndex
CREATE INDEX "email_security_audit_events_connectedMailboxId_idx" ON "email_security_audit_events"("connectedMailboxId");

-- AddForeignKey
ALTER TABLE "connected_mailboxes" ADD CONSTRAINT "connected_mailboxes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_mailbox_send_attempts" ADD CONSTRAINT "connected_mailbox_send_attempts_connectedMailboxId_fkey" FOREIGN KEY ("connectedMailboxId") REFERENCES "connected_mailboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
