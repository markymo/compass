-- Migration: expand_node_fields
-- Adds MVP fields to persons and legal_entities tables.
-- All columns are nullable — zero-risk additive migration.
-- No existing data is altered. No backfill required.

-- ── persons ────────────────────────────────────────────────────────────────

ALTER TABLE "persons"
    ADD COLUMN IF NOT EXISTS "title"               TEXT,
    ADD COLUMN IF NOT EXISTS "officerRole"         TEXT,
    ADD COLUMN IF NOT EXISTS "occupation"          TEXT,
    ADD COLUMN IF NOT EXISTS "countryOfResidence"  TEXT;

-- ── legal_entities ─────────────────────────────────────────────────────────

ALTER TABLE "legal_entities"
    ADD COLUMN IF NOT EXISTS "jurisdiction"             TEXT,
    ADD COLUMN IF NOT EXISTS "legalForm"                TEXT,
    ADD COLUMN IF NOT EXISTS "entityStatus"             TEXT,
    ADD COLUMN IF NOT EXISTS "countryOfIncorporation"   TEXT;
