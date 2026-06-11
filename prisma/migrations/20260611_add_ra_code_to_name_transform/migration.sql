-- Migration: add_ra_code_to_name_transform (part 1 of 2)
-- Extends the MappingTransformType enum.
--
-- MUST be a separate migration from the INSERT that uses RA_CODE_TO_NAME.
-- PostgreSQL error 55P04: new enum values must be committed before they can be used.

ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'RA_CODE_TO_NAME';
