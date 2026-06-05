-- Migration: 20260604_schema_reconciliation
-- 
-- Reconciles schema changes applied outside the Prisma migration system.
-- All DDL below was already applied to dev (via db push) and prod (via raw SQL).
--
-- This file was marked as applied using:
--   prisma migrate resolve --applied 20260604_schema_reconciliation
-- on both dev and prod WITHOUT re-executing this SQL against either database.
--
-- The lockedAt column has a type mismatch between environments:
--   dev:  TIMESTAMP WITHOUT TIME ZONE (timestamp)  <- set by db push
--   prod: TIMESTAMP WITH TIME ZONE    (timestamptz) <- set by raw SQL
-- This is benign and is not corrected. Prisma treats both identically.
-- The canonical Prisma form (TIMESTAMP(3)) is written here for fresh-DB reproducibility.

-- 1. Organization short-code for human-readable LE/Org identifiers
ALTER TABLE "Organization" ADD COLUMN "shortCode" TEXT;
CREATE UNIQUE INDEX "Organization_shortCode_key" ON "Organization"("shortCode");

-- 2. ClientLE short-code
ALTER TABLE "ClientLE" ADD COLUMN "shortCode" TEXT;
CREATE UNIQUE INDEX "ClientLE_shortCode_key" ON "ClientLE"("shortCode");

-- 3. Questionnaire lock timestamp — records when a questionnaire entered the Reference Library
ALTER TABLE "Questionnaire" ADD COLUMN "lockedAt" TIMESTAMP(3);

-- 4. QuestionnaireKind enum — replaces the isGlobal+isTemplate boolean pair
CREATE TYPE "QuestionnaireKind" AS ENUM ('WORKING_COPY', 'REFERENCE_SNAPSHOT', 'ENGAGEMENT_QUESTIONNAIRE');

-- 5. Questionnaire.kind — the lifecycle classification field
ALTER TABLE "Questionnaire" ADD COLUMN "kind" "QuestionnaireKind";
