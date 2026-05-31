-- Migration: add mappingSourceKey to RegistryAuthority
-- Adds a non-unique nullable grouping key that lets multiple RA codes share one
-- set of SourceFieldMappings under a canonical source identity (e.g. "COMPANIES_HOUSE").
-- registryKey is NOT changed — it remains the unique connector routing key.

ALTER TABLE registry_authorities ADD COLUMN mapping_source_key TEXT;

-- No default, no NOT NULL constraint: nullable by design.
-- Engine fallback: if null, use id (the GLEIF RA code) as the mapping source key.
