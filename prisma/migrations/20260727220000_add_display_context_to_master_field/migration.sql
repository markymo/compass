-- AlterTable: Add display context fields to master_field_definitions
ALTER TABLE "master_field_definitions" ADD COLUMN IF NOT EXISTS "displayContext" TEXT;
ALTER TABLE "master_field_definitions" ADD COLUMN IF NOT EXISTS "displayContextEnabled" BOOLEAN NOT NULL DEFAULT false;
