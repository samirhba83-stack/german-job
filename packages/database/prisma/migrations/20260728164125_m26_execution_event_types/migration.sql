-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExecutionEventType" ADD VALUE 'CAMPAIGN_EXECUTION_REJECTED';
ALTER TYPE "ExecutionEventType" ADD VALUE 'CAMPAIGN_EXECUTION_COMPLETED';
ALTER TYPE "ExecutionEventType" ADD VALUE 'CHECKPOINT_SAVED';
ALTER TYPE "ExecutionEventType" ADD VALUE 'TASK_RETRY_SCHEDULED';
ALTER TYPE "ExecutionEventType" ADD VALUE 'TASK_TERMINATED';
ALTER TYPE "ExecutionEventType" ADD VALUE 'DELIVERY_RESULT_UNKNOWN';
