-- Add explicit indexes for Product table (sku and gtin already have unique constraints, but explicit indexes help with query planning)
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "products_gtin_idx" ON "products"("gtin");

-- Add index for InventoryLot lot_number (already has unique constraint, but explicit index helps)
CREATE INDEX IF NOT EXISTS "inventory_lots_lot_number_idx" ON "inventory_lots"("lot_number");

-- Note: Other indexes (product_id, receiving_event_id, status, received_date, expiry_date) already exist
-- Note: AuditLog indexes (entity_id, createdAt) already exist


