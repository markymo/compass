-- Migration: add pickerConfig to master_field_graph_bindings
-- Nullable JSONB column. No default. No backfill.
-- Null means legacy/default picker behaviour (hardcoded displayLabel/subLabel).
-- Not consumed by picker UI yet (Phase 3+).

ALTER TABLE "master_field_graph_bindings"
    ADD COLUMN IF NOT EXISTS "pickerConfig" JSONB;
