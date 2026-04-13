-- Phase 1: Add REGISTRATION_AUTHORITY to SourceType and EvidenceProvider enums
-- NOTE: The data migration must run as a separate statement after this commits,
-- because PostgreSQL requires new enum values to be committed before they can be used.

-- Add new enum values
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'REGISTRATION_AUTHORITY';
ALTER TYPE "EvidenceProvider" ADD VALUE IF NOT EXISTS 'REGISTRATION_AUTHORITY';
