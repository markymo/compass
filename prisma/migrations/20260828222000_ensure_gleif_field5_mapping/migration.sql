-- Migration: ensure_gleif_field5_mapping
-- Guarantees that the canonical GLEIF Field 5 mapping exists and is configured with TO_NAME_HISTORY_LIST and SNAPSHOT_SYNC.

-- 1. Converge if already exists
UPDATE "source_field_mappings"
SET "transformType" = 'TO_NAME_HISTORY_LIST',
    "syncMode" = 'SNAPSHOT_SYNC',
    "priority" = 110,
    "isActive" = true,
    "notes" = 'GLEIF otherNames — TO_NAME_HISTORY_LIST handles string[] or {name,type}[] tolerantly. Dates typically absent.'
WHERE "sourceType" = 'GLEIF'
  AND "sourceReference" IS NULL
  AND "mappingScope" = 'BASELINE'
  AND "payloadSubtype" IS NULL
  AND "sourcePath" = 'entity.otherNames'
  AND "targetFieldNo" = 5;

-- 2. Insert if not exists (for completely blank databases)
INSERT INTO "source_field_mappings" (
    "id",
    "sourceType",
    "sourceReference",
    "mappingScope",
    "payloadSubtype",
    "sourcePath",
    "targetFieldNo",
    "confidenceDefault",
    "transformType",
    "transformConfig",
    "filterConfig",
    "syncMode",
    "priority",
    "isActive",
    "notes",
    "version",
    "createdAt",
    "updatedAt"
)
SELECT
    'a08d12e2-7a76-49ba-991e-a28f82e37bde',
    'GLEIF',
    NULL,
    'BASELINE',
    NULL,
    'entity.otherNames',
    5,
    1.0,
    'TO_NAME_HISTORY_LIST',
    NULL,
    NULL,
    'SNAPSHOT_SYNC',
    110,
    true,
    'GLEIF otherNames — TO_NAME_HISTORY_LIST handles string[] or {name,type}[] tolerantly. Dates typically absent.',
    1,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM "source_field_mappings"
    WHERE "sourceType" = 'GLEIF'
      AND "sourceReference" IS NULL
      AND "mappingScope" = 'BASELINE'
      AND "payloadSubtype" IS NULL
      AND "sourcePath" = 'entity.otherNames'
      AND "targetFieldNo" = 5
);
