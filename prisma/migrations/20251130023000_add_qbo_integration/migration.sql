-- Add QBO fields to Customer table
ALTER TABLE "customers" ADD COLUMN "qbo_id" TEXT;
ALTER TABLE "customers" ADD COLUMN "qbo_sync_token" TEXT;
CREATE INDEX "customers_qbo_id_idx" ON "customers"("qbo_id");

-- Add QBO fields to Product table
ALTER TABLE "products" ADD COLUMN "qbo_id" TEXT;
ALTER TABLE "products" ADD COLUMN "qbo_sync_token" TEXT;
CREATE INDEX "products_qbo_id_idx" ON "products"("qbo_id");

-- Create IntegrationSettings table
CREATE TABLE "integration_settings" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "realm_id" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_settings_provider_key" ON "integration_settings"("provider");

