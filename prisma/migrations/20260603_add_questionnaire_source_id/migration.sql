-- Migration: add_questionnaire_source_id
-- Adds a nullable self-referential foreign key to Questionnaire for lineage tracking.
-- ancestry only — no inheritance, sync, or merge semantics.
-- onDelete: SET NULL ensures children are not deleted if a parent is hard-deleted.

ALTER TABLE "Questionnaire" ADD COLUMN "sourceId" TEXT;

ALTER TABLE "Questionnaire"
  ADD CONSTRAINT "Questionnaire_sourceId_fkey"
  FOREIGN KEY ("sourceId")
  REFERENCES "Questionnaire"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
