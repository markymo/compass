-- Migration: seed_ra_code_to_name_mapping (part 2 of 2)
-- Seeds the SourceFieldMapping row for GLEIF → Field 17 using RA_CODE_TO_NAME.
--
-- This MUST run in a separate migration from the ALTER TYPE above.
-- PostgreSQL requires the enum value to be committed before it can be used
-- in an INSERT (error 55P04 if both are in the same transaction).

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
