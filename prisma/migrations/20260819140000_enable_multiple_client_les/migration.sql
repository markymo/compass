-- Drop unique constraint on ClientLE.lei
DROP INDEX IF EXISTS "ClientLE_lei_key";

-- Add dossierLabel column to ClientLE
ALTER TABLE "ClientLE" ADD COLUMN IF NOT EXISTS "dossierLabel" TEXT;

-- Create index on ClientLE.lei
CREATE INDEX IF NOT EXISTS "ClientLE_lei_idx" ON "ClientLE"("lei");
