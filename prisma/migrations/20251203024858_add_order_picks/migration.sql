-- AlterEnum (add new status values to OrderStatus)
DO $$ BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_PICK';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SHIP';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "order_picks" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "inventory_lot_id" UUID NOT NULL,
    "quantity_picked" DOUBLE PRECISION NOT NULL,
    "picked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "picked_by_user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_picks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_picks_order_item_id_idx" ON "order_picks"("order_item_id");

-- CreateIndex
CREATE INDEX "order_picks_inventory_lot_id_idx" ON "order_picks"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "order_picks_picked_by_user_id_idx" ON "order_picks"("picked_by_user_id");

-- CreateIndex
CREATE INDEX "order_picks_picked_at_idx" ON "order_picks"("picked_at");

-- AddForeignKey
ALTER TABLE "order_picks" ADD CONSTRAINT "order_picks_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_picks" ADD CONSTRAINT "order_picks_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_picks" ADD CONSTRAINT "order_picks_picked_by_user_id_fkey" FOREIGN KEY ("picked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

