-- Migration: add TO_CODE_LIST to MappingTransformType enum
-- Additive only. No existing rows are modified.
-- Safe to run while the application is live.
-- Must run on production BEFORE the source_field_mappings row is updated to use TO_CODE_LIST.

ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_CODE_LIST';
