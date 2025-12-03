-- Add order_number column to orders table
ALTER TABLE "orders" ADD COLUMN "order_number" TEXT;

-- Create index on order_number
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- Generate order numbers for existing orders starting from 100000
-- This ensures new orders start at 100001
DO $$
DECLARE
    order_record RECORD;
    order_num INTEGER := 100000;
BEGIN
    FOR order_record IN SELECT id FROM orders ORDER BY "createdAt" ASC
    LOOP
        order_num := order_num + 1;
        UPDATE orders SET order_number = order_num::TEXT WHERE id = order_record.id;
    END LOOP;
END $$;

-- Make order_number NOT NULL and unique after populating
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

