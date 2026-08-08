-- CreateEnum: MasterFieldAssignmentStatus
DO $$ BEGIN
    CREATE TYPE "MasterFieldAssignmentStatus" AS ENUM ('OPEN', 'DONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add status column to master_field_assignments
ALTER TABLE "master_field_assignments" ADD COLUMN IF NOT EXISTS "status" "MasterFieldAssignmentStatus" NOT NULL DEFAULT 'OPEN';
