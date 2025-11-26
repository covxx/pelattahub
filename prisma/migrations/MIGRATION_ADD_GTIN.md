# Migration: Add GTIN field to Product model

## Migration SQL

To apply this migration, run:

```sql
-- Add gtin column to products table
ALTER TABLE "products" ADD COLUMN "gtin" TEXT;
```

Or use Prisma migrate:

```bash
npx prisma migrate dev --name add_gtin_to_product
```

## Changes

- Added `gtin` field (String, Optional/Nullable) to Product model
- Field is used for Global Trade Item Number (barcode/UPC)
- All product forms and actions have been updated to support GTIN
- Receiving logic now includes GTIN in product data

