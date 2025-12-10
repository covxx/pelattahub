-- CreateEnum: Add ReceivingStatus enum
CREATE TYPE "ReceivingStatus" AS ENUM ('OPEN', 'FINALIZED');

-- AlterTable: Add new columns to receiving_events
ALTER TABLE "receiving_events" ADD COLUMN "status" "ReceivingStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "receiving_events" ADD COLUMN "finalized_at" TIMESTAMP(3);
ALTER TABLE "receiving_events" ADD COLUMN "notes" TEXT;

-- CreateIndex: Add index on status
CREATE INDEX "receiving_events_status_idx" ON "receiving_events"("status");

