-- Add parent_lot_id to inventory_lots table
ALTER TABLE "inventory_lots" 
ADD COLUMN IF NOT EXISTS "parent_lot_id" UUID;

-- Add foreign key constraint for parent_lot_id
ALTER TABLE "inventory_lots" 
ADD CONSTRAINT "inventory_lots_parent_lot_id_fkey" 
FOREIGN KEY ("parent_lot_id") 
REFERENCES "inventory_lots"("id") 
ON DELETE SET NULL;

-- Create index for parent_lot_id
CREATE INDEX IF NOT EXISTS "inventory_lots_parent_lot_id_idx" ON "inventory_lots"("parent_lot_id");

-- Create production_runs table
CREATE TABLE IF NOT EXISTS "production_runs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "source_lot_id" UUID NOT NULL,
    "destination_lot_id" UUID NOT NULL,
    "quantity_consumed" DOUBLE PRECISION NOT NULL,
    "quantity_produced" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "production_runs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for production_runs
ALTER TABLE "production_runs" 
ADD CONSTRAINT "production_runs_user_id_fkey" 
FOREIGN KEY ("user_id") 
REFERENCES "users"("id") 
ON DELETE RESTRICT;

ALTER TABLE "production_runs" 
ADD CONSTRAINT "production_runs_source_lot_id_fkey" 
FOREIGN KEY ("source_lot_id") 
REFERENCES "inventory_lots"("id") 
ON DELETE RESTRICT;

ALTER TABLE "production_runs" 
ADD CONSTRAINT "production_runs_destination_lot_id_fkey" 
FOREIGN KEY ("destination_lot_id") 
REFERENCES "inventory_lots"("id") 
ON DELETE RESTRICT;

-- Create indexes for production_runs
CREATE INDEX IF NOT EXISTS "production_runs_user_id_idx" ON "production_runs"("user_id");
CREATE INDEX IF NOT EXISTS "production_runs_source_lot_id_idx" ON "production_runs"("source_lot_id");
CREATE INDEX IF NOT EXISTS "production_runs_destination_lot_id_idx" ON "production_runs"("destination_lot_id");
CREATE INDEX IF NOT EXISTS "production_runs_created_at_idx" ON "production_runs"("created_at");









