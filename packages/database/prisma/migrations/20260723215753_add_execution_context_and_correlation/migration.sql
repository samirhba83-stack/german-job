/*
  Warnings:

  - Added the required column `correlationId` to the `execution_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `traceId` to the `execution_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "federalState" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "execution_events" ADD COLUMN     "context" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "correlationId" TEXT NOT NULL,
ADD COLUMN     "traceId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "execution_events_correlationId_idx" ON "execution_events"("correlationId");

-- CreateIndex
CREATE INDEX "execution_events_traceId_idx" ON "execution_events"("traceId");
