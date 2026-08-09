-- CreateEnum
CREATE TYPE "FollowUpControlType" AS ENUM ('TEMPORARY_HOLD', 'PERMANENT_SUPPRESSION', 'WAITING_PERIOD', 'MANUAL_REVIEW_HOLD', 'DELIVERABILITY_BLOCK');

-- CreateEnum
CREATE TYPE "FollowUpControlStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RecruitmentTaskType" AS ENUM ('CONFIRM_INTERVIEW', 'SELECT_INTERVIEW_SLOT', 'PREPARE_INTERVIEW', 'UPLOAD_REQUESTED_DOCUMENT', 'SEND_REQUESTED_DOCUMENT', 'PROVIDE_INFORMATION', 'COMPLETE_ASSESSMENT', 'REVIEW_OFFER', 'FOLLOW_UP_AFTER_DATE', 'MANUAL_REPLY_REVIEW', 'REAUTHORIZE_INBOX', 'RECONNECT_MAILBOX');

-- CreateEnum
CREATE TYPE "RecruitmentTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApplicationOperationalDecisionType" AS ENUM ('DOCUMENTS_REQUESTED', 'INFORMATION_REQUESTED', 'ASSESSMENT_INVITED', 'UNDER_REVIEW', 'WAITING', 'OFFER_EVIDENCE_RECORDED');

-- AlterEnum
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_CONTROL_CREATED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_TEMPORARILY_HELD';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_PERMANENTLY_SUPPRESSED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_RELEASED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_HOLD_EXPIRED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_ELIGIBILITY_CHECKED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'QUEUED_FOLLOW_UP_CANCELLED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_SEND_BLOCKED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_RESUME_PROPOSED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'FOLLOW_UP_RESUMED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_COMMAND_PROPOSED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_COMMAND_CONFIRMED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_COMMAND_EXECUTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_COMMAND_REJECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_COMMAND_FAILED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'APPLICATION_PROPOSAL_STALE';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'RECRUITMENT_TASK_CREATED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'RECRUITMENT_TASK_COMPLETED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'RECRUITMENT_TASK_DISMISSED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'DEADLINE_CONFIRMED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'DEADLINE_CORRECTED';
ALTER TYPE "EmailSecurityAuditEventType" ADD VALUE 'OPERATIONAL_DECISION_FAILED';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'FOLLOW_UP_PAUSED';
ALTER TYPE "NotificationKind" ADD VALUE 'FOLLOW_UP_STOPPED';
ALTER TYPE "NotificationKind" ADD VALUE 'FOLLOW_UP_RESUME_AVAILABLE';
ALTER TYPE "NotificationKind" ADD VALUE 'OFFER_REVIEW_REQUIRED';
ALTER TYPE "NotificationKind" ADD VALUE 'MANUAL_REVIEW_REQUIRED';
ALTER TYPE "NotificationKind" ADD VALUE 'TRANSITION_EXECUTION_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_OVERDUE';

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "followUpControlChangedEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taskDeadlineEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "transitionExecutionFailedEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "application_follow_up_controls" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "companyId" TEXT,
    "jobId" TEXT,
    "sourceInboxMessageId" TEXT,
    "sourceProviderMessageId" TEXT,
    "controlType" "FollowUpControlType" NOT NULL,
    "status" "FollowUpControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "reasonCode" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "classification" "ReplyPrimaryCategory",
    "confidence" DOUBLE PRECISION,
    "evidence" JSONB,
    "createdByActorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdByActorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "releaseReason" TEXT,
    "correlationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_follow_up_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_action_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "companyId" TEXT,
    "jobId" TEXT,
    "sourceInboxMessageId" TEXT,
    "taskType" "RecruitmentTaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "dueDateConfidence" TEXT,
    "originalDateText" TEXT,
    "deadlineReminderSentAt" TIMESTAMP(3),
    "status" "RecruitmentTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "recruitment_action_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_operational_decisions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "decisionType" "ApplicationOperationalDecisionType" NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "reason" TEXT,
    "evidence" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "application_operational_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_follow_up_controls_idempotencyKey_key" ON "application_follow_up_controls"("idempotencyKey");

-- CreateIndex
CREATE INDEX "application_follow_up_controls_applicationId_status_idx" ON "application_follow_up_controls"("applicationId", "status");

-- CreateIndex
CREATE INDEX "application_follow_up_controls_campaignId_idx" ON "application_follow_up_controls"("campaignId");

-- CreateIndex
CREATE INDEX "application_follow_up_controls_status_expiresAt_idx" ON "application_follow_up_controls"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "application_follow_up_controls_userId_idx" ON "application_follow_up_controls"("userId");

-- M30 Phase 3 — "enforce one coherent active control decision per applicable scope... use database
-- constraints where appropriate". Prisma schema syntax has no conditional/partial-index support,
-- so this is hand-written, matching the exact established pattern from M28.5's
-- candidate_documents_active_version_unique and M28.6's connected_mailboxes_active_per_user_unique.
-- This is the REAL backstop the application-layer "supersede-then-create" logic relies on: a
-- genuine concurrent race between two writers both trying to create an ACTIVE control for the same
-- application can only ever leave one row ACTIVE.
CREATE UNIQUE INDEX "application_follow_up_controls_active_per_application_unique" ON "application_follow_up_controls"("applicationId") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_action_tasks_idempotencyKey_key" ON "recruitment_action_tasks"("idempotencyKey");

-- CreateIndex
CREATE INDEX "recruitment_action_tasks_userId_status_idx" ON "recruitment_action_tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "recruitment_action_tasks_applicationId_idx" ON "recruitment_action_tasks"("applicationId");

-- CreateIndex
CREATE INDEX "recruitment_action_tasks_status_dueAt_idx" ON "recruitment_action_tasks"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "application_operational_decisions_idempotencyKey_key" ON "application_operational_decisions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "application_operational_decisions_applicationId_decisionTyp_idx" ON "application_operational_decisions"("applicationId", "decisionType");

-- AddForeignKey
ALTER TABLE "application_follow_up_controls" ADD CONSTRAINT "application_follow_up_controls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_action_tasks" ADD CONSTRAINT "recruitment_action_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
