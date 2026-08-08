-- AlterTable: Add note column to master_field_assignments
ALTER TABLE "master_field_assignments" ADD COLUMN IF NOT EXISTS "note" VARCHAR(1000);
