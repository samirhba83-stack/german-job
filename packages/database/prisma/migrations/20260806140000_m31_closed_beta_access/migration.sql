-- M31 Phase 20 — Closed Beta Access Control. Purely additive: new columns on "users" (all
-- nullable/defaulted, no existing row is affected), one new table, one new enum.

-- New audit event types (used by beta-access + Phase 27 emergency-stop actions).
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'BETA_INVITATION_CREATED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'BETA_INVITATION_REVOKED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'BETA_INVITATION_REDEEMED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'ACCOUNT_SUSPENDED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'ACCOUNT_UNSUSPENDED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'EMERGENCY_STOP_ACTIVATED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE IF NOT EXISTS 'EMERGENCY_STOP_DEACTIVATED';

-- Real, immediate account suspension.
ALTER TABLE "users" ADD COLUMN "accountSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "accountSuspendedReason" TEXT;
ALTER TABLE "users" ADD COLUMN "accountSuspendedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "accountSuspendedBy" TEXT;

-- Closed Beta invitations.
CREATE TYPE "BetaInvitationStatus" AS ENUM ('PENDING', 'USED', 'REVOKED', 'EXPIRED');

CREATE TABLE "beta_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BetaInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByAdminId" TEXT NOT NULL,
    "usedByUserId" TEXT,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByAdminId" TEXT,
    "revokedReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beta_invitations_code_key" ON "beta_invitations"("code");
CREATE UNIQUE INDEX "beta_invitations_usedByUserId_key" ON "beta_invitations"("usedByUserId");
CREATE INDEX "beta_invitations_email_idx" ON "beta_invitations"("email");
CREATE INDEX "beta_invitations_status_idx" ON "beta_invitations"("status");

ALTER TABLE "beta_invitations" ADD CONSTRAINT "beta_invitations_usedByUserId_fkey"
  FOREIGN KEY ("usedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
