-- Migration: Add TO_PERSON_OR_CONTACT_VALUE and TO_PERSON_OR_CONTACT_LIST to MappingTransformType enum
--
-- IMPORTANT: PostgreSQL ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- Prisma wraps migrations in transactions by default. To work around this,
-- these statements use the same pattern as 20260611_add_ra_code_to_name_transform.
--
-- Each ADD VALUE is idempotent when using IF NOT EXISTS (Postgres 12+).

ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_PERSON_OR_CONTACT_VALUE';
ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_PERSON_OR_CONTACT_LIST';
