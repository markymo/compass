-- CreateEnum
CREATE TYPE "GroupDisplayStyle" AS ENUM ('LIST', 'COMPACT');

-- AlterTable
ALTER TABLE "master_field_groups" ADD COLUMN "displayStyle" "GroupDisplayStyle" NOT NULL DEFAULT 'LIST';
