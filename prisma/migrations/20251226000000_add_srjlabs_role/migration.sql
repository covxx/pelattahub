-- Add SRJLABS role to Role enum (idempotent for reruns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel = 'SRJLABS'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'SRJLABS';
  END IF;
END $$;

