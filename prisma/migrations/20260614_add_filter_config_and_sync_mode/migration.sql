-- AlterTable
ALTER TABLE "source_field_mappings" ADD COLUMN     "filterConfig" JSONB,
ADD COLUMN     "syncMode" TEXT NOT NULL DEFAULT 'UPSERT_ONLY';
