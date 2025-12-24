-- Add QBO integration fields to receiving_events table
ALTER TABLE "receiving_events" ADD COLUMN "qbo_id" TEXT;
ALTER TABLE "receiving_events" ADD COLUMN "qbo_sync_token" TEXT;

-- Create index on qbo_id for faster lookups
CREATE INDEX "receiving_events_qbo_id_idx" ON "receiving_events"("qbo_id");
