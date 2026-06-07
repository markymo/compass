-- Migration: 20260607_add_questionnaire_visibility
--
-- Adds a clean first-class visibility model for Reference Snapshots.
-- isGlobal is NOT modified or removed; this is additive.
--
-- 1. QuestionnaireVisibility enum
-- 2. Questionnaire.visibility column (default PRIVATE)
-- 3. QuestionnaireVisibilityGrant join table (schema only, no UI yet)
-- 4. Data backfill: existing REFERENCE_SNAPSHOT rows with isGlobal=true → GLOBAL

-- 1. Create the enum type
CREATE TYPE "QuestionnaireVisibility" AS ENUM ('PRIVATE', 'RESTRICTED', 'GLOBAL');

-- 2. Add visibility column to Questionnaire (nullable first, backfill, then default)
ALTER TABLE "Questionnaire" ADD COLUMN "visibility" "QuestionnaireVisibility";

-- 3. Backfill: Reference Snapshots that were marked isGlobal=true become GLOBAL.
--    All others default to PRIVATE.
UPDATE "Questionnaire"
SET "visibility" = 'GLOBAL'
WHERE "kind" = 'REFERENCE_SNAPSHOT' AND "isGlobal" = true;

UPDATE "Questionnaire"
SET "visibility" = 'PRIVATE'
WHERE "visibility" IS NULL;

-- 4. Now set the column NOT NULL with a default of PRIVATE
ALTER TABLE "Questionnaire"
    ALTER COLUMN "visibility" SET NOT NULL,
    ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE';

-- 5. Create QuestionnaireVisibilityGrant join table
CREATE TABLE "QuestionnaireVisibilityGrant" (
    "id"              TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireVisibilityGrant_pkey" PRIMARY KEY ("id")
);

-- 6. Foreign keys
ALTER TABLE "QuestionnaireVisibilityGrant"
    ADD CONSTRAINT "QuestionnaireVisibilityGrant_questionnaireId_fkey"
    FOREIGN KEY ("questionnaireId")
    REFERENCES "Questionnaire"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionnaireVisibilityGrant"
    ADD CONSTRAINT "QuestionnaireVisibilityGrant_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Unique constraint (one grant per questionnaire+org pair)
CREATE UNIQUE INDEX "QuestionnaireVisibilityGrant_questionnaireId_organizationId_key"
    ON "QuestionnaireVisibilityGrant"("questionnaireId", "organizationId");

-- 8. Index on organizationId for reverse lookups
CREATE INDEX "QuestionnaireVisibilityGrant_organizationId_idx"
    ON "QuestionnaireVisibilityGrant"("organizationId");
