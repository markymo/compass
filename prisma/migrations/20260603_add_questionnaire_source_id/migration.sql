-- Migration: add_questionnaire_source_id
-- Adds a nullable self-referential foreign key to Questionnaire for lineage tracking.
-- ancestry only — no inheritance, sync, or merge semantics.
-- onDelete: SET NULL ensures children are not deleted if a parent is hard-deleted.
-- Idempotent: IF NOT EXISTS guards make this safe to run more than once.

ALTER TABLE "Questionnaire" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Questionnaire_sourceId_fkey'
      AND table_name = 'Questionnaire'
  ) THEN
    ALTER TABLE "Questionnaire"
      ADD CONSTRAINT "Questionnaire_sourceId_fkey"
      FOREIGN KEY ("sourceId")
      REFERENCES "Questionnaire"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
