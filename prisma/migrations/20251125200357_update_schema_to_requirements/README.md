-- Migration: Update schema to requirements
-- This migration updates the schema according to the new requirements:
-- 1. User: password is now required
-- 2. Product: Added varieties and image_url, removed category and unit
-- 3. InventoryLot: Changed to UUID id, Int quantities, new fields (origin_country, grower_id), LotStatus enum

-- Note: This is a template. Run 'npx prisma migrate dev' to generate the actual migration SQL.
