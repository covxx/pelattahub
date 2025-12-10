-- Fix IntegrationSettings table to match schema
-- Add missing fields if they don't exist

-- Add token_expires_at if it doesn't exist (it should, but ensure it)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'integration_settings' 
        AND column_name = 'token_expires_at'
    ) THEN
        ALTER TABLE "integration_settings" ADD COLUMN "token_expires_at" TIMESTAMP(3);
    END IF;
END $$;

-- Add refresh_token_expires_at if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'integration_settings' 
        AND column_name = 'refresh_token_expires_at'
    ) THEN
        ALTER TABLE "integration_settings" ADD COLUMN "refresh_token_expires_at" TIMESTAMP(3);
    END IF;
END $$;

-- Add is_connected if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'integration_settings' 
        AND column_name = 'is_connected'
    ) THEN
        ALTER TABLE "integration_settings" ADD COLUMN "is_connected" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Remove old expires_at column if token_expires_at exists (cleanup)
-- Note: We keep expires_at for now to avoid breaking anything, but it's deprecated



