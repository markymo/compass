-- Migration: add_ra_code_to_name_transform
-- Adds the RA_CODE_TO_NAME enum value to MappingTransformType and creates
-- the canonical GLEIF → Field 17 mapping row.
--
-- Safe to run in production: ALTER TYPE ADD VALUE is non-destructive;
-- the INSERT uses ON CONFLICT DO NOTHING for idempotency.

-- 1. Extend the enum (Postgres allows adding values without a full table rewrite)
ALTER TYPE "MappingTransformType" ADD VALUE IF NOT EXISTS 'RA_CODE_TO_NAME';

-- 2. Seed the F17 GLEIF source mapping (idempotent)
--    source path: entity.registeredAt.id → resolves to e.g. "RA000192"
--    transform:   RA_CODE_TO_NAME  → looks up registry_authorities.name at enrichment time
--    priority 100 is consistent with other GLEIF identity fields
--    confidenceDefault 0.95 — fallback to raw code with penalty for unknown RA codes
INSERT INTO source_field_mappings (
    id,
    "sourceType",
    "sourceReference",
    "mappingScope",
    "payloadSubtype",
    "sourcePath",
    "targetFieldNo",
    "confidenceDefault",
    "transformType",
    "transformConfig",
    priority,
    "isActive",
    notes,
    version,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid(),
    'GLEIF',
    NULL,
    'BASELINE',
    'GENERAL',
    'entity.registeredAt.id',
    17,
    0.95,
    'RA_CODE_TO_NAME',
    NULL,
    100,
    true,
    'Maps GLEIF registeredAt.id (e.g. RA000192) to the human-readable authority name from registry_authorities.',
    1,
    NOW(),
    NOW()
)
ON CONFLICT ("sourceType", "sourceReference", "mappingScope", "payloadSubtype", "sourcePath", "targetFieldNo")
    WHERE "sourceReference" IS NULL
    DO NOTHING;
