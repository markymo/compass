-- Migration: add_category_retirement_columns
-- Adds archive/retirement audit columns to master_data_categories.
-- All columns are non-breaking: isActive defaults to TRUE (all existing rows
-- remain active), the three audit columns are nullable.
-- Safe to apply to production with zero downtime.

ALTER TABLE "master_data_categories"
  ADD COLUMN IF NOT EXISTS "isActive"      BOOLEAN   NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "archivedAt"    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "archivedById"  TEXT,
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

-- Index mirrors the pattern on master_field_definitions for efficient
-- active-only category queries (getCategoriesWithFields filter).
CREATE INDEX IF NOT EXISTS "master_data_categories_isActive_order_idx"
  ON "master_data_categories" ("isActive", "order");
