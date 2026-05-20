-- Migration: add TO_NAME_HISTORY_LIST to MappingTransformType enum
-- This is a safe additive change. No existing rows are modified.

ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'TO_NAME_HISTORY_LIST';
