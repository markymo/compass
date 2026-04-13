-- Phase 1 Data Migration: runs AFTER enum values are committed

-- Backfill sourceReference for old COMPANIES_HOUSE claims that don't have one
UPDATE field_claims
SET "sourceReference" = 'GB_COMPANIES_HOUSE'
WHERE "sourceType" = 'COMPANIES_HOUSE' AND "sourceReference" IS NULL;

-- Migrate FieldClaim rows
UPDATE field_claims
SET "sourceType" = 'REGISTRATION_AUTHORITY'
WHERE "sourceType" IN ('COMPANIES_HOUSE', 'NATIONAL_REGISTRY');

-- Migrate SourceFieldMapping rows
UPDATE source_field_mappings
SET "sourceType" = 'REGISTRATION_AUTHORITY'
WHERE "sourceType" IN ('COMPANIES_HOUSE', 'NATIONAL_REGISTRY');

-- Migrate SourceSamplePayload rows
UPDATE source_sample_payloads
SET "sourceType" = 'REGISTRATION_AUTHORITY'
WHERE "sourceType" IN ('COMPANIES_HOUSE', 'NATIONAL_REGISTRY');

-- Migrate EvidenceStore rows
UPDATE evidence_store
SET "provider" = 'REGISTRATION_AUTHORITY'
WHERE "provider" = 'COMPANIES_HOUSE';

-- Migrate RegistryReference sourceSystem (if any use old values)
UPDATE registry_references
SET "sourceSystem" = 'REGISTRATION_AUTHORITY'
WHERE "sourceSystem" IN ('COMPANIES_HOUSE', 'NATIONAL_REGISTRY');
