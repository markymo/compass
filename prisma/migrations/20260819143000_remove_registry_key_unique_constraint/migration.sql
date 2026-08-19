-- Migration: Remove unique constraint on registry_authorities.registryKey and backfill UK / FCA authorities
-- Enables multiple regional authorities (e.g. RA000585, RA000586, RA000587) to share registryKey = 'GB_COMPANIES_HOUSE'

-- 1. Drop the legacy unique constraint/index on registryKey
DROP INDEX IF EXISTS "registry_authorities_registryKey_key";

-- 2. Backfill RA000585, RA000586, RA000587 to registryKey = 'GB_COMPANIES_HOUSE', mappingSourceKey = 'COMPANIES_HOUSE'
UPDATE "registry_authorities"
SET "registryKey" = 'GB_COMPANIES_HOUSE',
    "mapping_source_key" = 'COMPANIES_HOUSE'
WHERE "id" IN ('RA000585', 'RA000586', 'RA000587');

-- 3. Backfill RA000592 (FCA Financial Services Register) to registryKey = 'UK_FCA'
UPDATE "registry_authorities"
SET "registryKey" = 'UK_FCA',
    "mapping_source_key" = NULL
WHERE "id" = 'RA000592';
