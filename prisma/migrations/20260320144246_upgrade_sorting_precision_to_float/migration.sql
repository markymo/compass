-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "allowAttachments" SET DEFAULT true;

-- AlterTable
ALTER TABLE "master_data_categories" ALTER COLUMN "order" SET DEFAULT 0,
ALTER COLUMN "order" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
CREATE SEQUENCE master_field_definitions_fieldno_seq;
ALTER TABLE "master_field_definitions" ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT[] DEFAULT ARRAY['Onboarding']::TEXT[],
ALTER COLUMN "fieldNo" SET DEFAULT nextval('master_field_definitions_fieldno_seq'),
ALTER COLUMN "order" SET DEFAULT 0,
ALTER COLUMN "order" SET DATA TYPE DOUBLE PRECISION;
ALTER SEQUENCE master_field_definitions_fieldno_seq OWNED BY "master_field_definitions"."fieldNo";

-- AlterTable
ALTER TABLE "master_field_groups" ALTER COLUMN "order" SET DEFAULT 0,
ALTER COLUMN "order" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "registry_references" ADD COLUMN     "lastSyncAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncStatus" "SyncStatus",
ADD COLUMN     "lastSyncSucceededAt" TIMESTAMP(3);
