-- Migration: Add missing MappingTransformType enum values to production
-- Applied manually: 2026-05-21 to ep-silent-flower-abi2jpdp
-- These values existed in dev but were missing from production, causing
-- TO_PARTY_LIST and TO_PARTY_OBJECT transforms to fail for fields 62/63/64.

ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_ADDRESS_OBJECT';
ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_PARTY_LIST';
ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_PARTY_OBJECT';
