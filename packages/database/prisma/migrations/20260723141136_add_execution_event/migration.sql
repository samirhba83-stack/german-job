-- CreateEnum
CREATE TYPE "ExecutionEventType" AS ENUM ('CAMPAIGN_EXECUTION_STARTED', 'RECOMMENDATION_GENERATED', 'DECISION_MADE', 'EXECUTION_PLANNED', 'PIPELINE_ORCHESTRATED', 'TASK_SELECTED', 'TASK_EXECUTED', 'POLICY_EVALUATED', 'APPLICATION_PACKAGE_ASSEMBLED', 'PROVIDER_SELECTED', 'EMAIL_DELIVERY_ATTEMPTED', 'EMAIL_DELIVERY_CONFIRMED', 'EMAIL_DELIVERY_FAILED', 'REPLY_RECEIVED', 'INTERVIEW_SCHEDULED');

-- CreateEnum
CREATE TYPE "ExecutionEventStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "execution_events" (
    "id" TEXT NOT NULL,
    "eventType" "ExecutionEventType" NOT NULL,
    "campaignId" TEXT,
    "executionId" TEXT,
    "summary" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "ExecutionEventStatus" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execution_events_campaignId_idx" ON "execution_events"("campaignId");

-- CreateIndex
CREATE INDEX "execution_events_executionId_idx" ON "execution_events"("executionId");

-- CreateIndex
CREATE INDEX "execution_events_occurredAt_idx" ON "execution_events"("occurredAt");
