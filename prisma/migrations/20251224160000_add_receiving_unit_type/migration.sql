-- Migration: add_receiving_unit_type
-- Description: Add receiving_unit_type field to inventory_lots to track the unit type used during receiving

-- Add receiving_unit_type column to inventory_lots table
ALTER TABLE "inventory_lots" 
  ADD COLUMN "receiving_unit_type" "UnitType";

-- Add comment to explain the field
COMMENT ON COLUMN "inventory_lots"."receiving_unit_type" IS 'Unit type used during receiving (for display purposes when different from product unit_type)';

