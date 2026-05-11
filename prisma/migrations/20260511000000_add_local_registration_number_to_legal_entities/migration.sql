-- Add missing localRegistrationNumber column to legal_entities
-- This column exists in schema.prisma (line 528) but was never added via a migration.
-- It was applied manually to the dev DB via repair.sql, but is missing in production.

ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "localRegistrationNumber" TEXT;
