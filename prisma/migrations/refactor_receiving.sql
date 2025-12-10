-- Migration: refactor_receiving
-- Description: Add batch receiving support with vendors, receiving events, and enhanced product tracking

-- Create UnitType enum
CREATE TYPE "UnitType" AS ENUM ('CASE', 'LBS', 'EACH');

-- Create vendors table
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create receiving_events table
CREATE TABLE receiving_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  received_date TIMESTAMP(3) NOT NULL,
  created_by TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT receiving_events_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT receiving_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Create indexes for receiving_events
CREATE INDEX receiving_events_vendor_id_idx ON receiving_events(vendor_id);
CREATE INDEX receiving_events_created_by_idx ON receiving_events(created_by);
CREATE INDEX receiving_events_received_date_idx ON receiving_events(received_date);

-- Update products table
ALTER TABLE products 
  ADD COLUMN default_origin_country TEXT,
  ADD COLUMN unit_type "UnitType" DEFAULT 'CASE'::"UnitType";

-- Make gtin required (first set a default for existing NULL values)
UPDATE products SET gtin = 'TEMP-' || id WHERE gtin IS NULL;
ALTER TABLE products ALTER COLUMN gtin SET NOT NULL;

-- Update default_origin_country for existing products
UPDATE products SET default_origin_country = 'USA' WHERE default_origin_country IS NULL;
ALTER TABLE products ALTER COLUMN default_origin_country SET NOT NULL;

-- Update inventory_lots table
ALTER TABLE inventory_lots
  ADD COLUMN receiving_event_id UUID,
  ADD COLUMN original_quantity INTEGER;

-- Set original_quantity to quantity_received for existing lots
UPDATE inventory_lots SET original_quantity = quantity_received WHERE original_quantity IS NULL;
ALTER TABLE inventory_lots ALTER COLUMN original_quantity SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE inventory_lots
  ADD CONSTRAINT inventory_lots_receiving_event_id_fkey 
  FOREIGN KEY (receiving_event_id) REFERENCES receiving_events(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX inventory_lots_receiving_event_id_idx ON inventory_lots(receiving_event_id);

-- Insert seed vendors
INSERT INTO vendors (name, code, active) VALUES
  ('Sysco Corporation', 'SYSCO', true),
  ('Local Farms Co-op', 'LOCAL', true),
  ('Global Produce Inc', 'GLOBAL', true)
ON CONFLICT (code) DO NOTHING;

