-- Migration: ensure_companies_house_field5_mapping
-- Guarantees that the canonical Companies House Field 5 mapping exists and is configured with TO_NAME_HISTORY_LIST and SNAPSHOT_SYNC.

-- 1. Converge if already exists (for existing databases)
UPDATE "source_field_mappings"
SET "transformType" = 'TO_NAME_HISTORY_LIST',
    "syncMode" = 'SNAPSHOT_SYNC',
    "priority" = 100,
    "isActive" = true,
    "notes" = 'UK Previous Legal Names — TO_NAME_HISTORY_LIST produces one structured row per entry (name, effectiveFrom, effectiveTo). Path: previous_company_names in COMPANY_PROFILE payload.'
WHERE "sourceType" = 'REGISTRATION_AUTHORITY'
  AND "sourceReference" = 'COMPANIES_HOUSE'
  AND "mappingScope" = 'RAW_PAYLOAD'
  AND "payloadSubtype" = 'COMPANY_PROFILE'
  AND "sourcePath" = 'previous_company_names'
  AND "targetFieldNo" = 5;

-- 2. Insert if not exists (guarantees convergence on clean/blank DBs)
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
    '342fe97e-8459-47bb-be99-5d16ebf7692a',
    'REGISTRATION_AUTHORITY',
    'COMPANIES_HOUSE',
    'RAW_PAYLOAD',
    'COMPANY_PROFILE',
    'previous_company_names',
    5,
    1.0,
    'TO_NAME_HISTORY_LIST',
    NULL,
    NULL,
    'SNAPSHOT_SYNC',
    100,
    true,
    'UK Previous Legal Names — TO_NAME_HISTORY_LIST produces one structured row per entry (name, effectiveFrom, effectiveTo). Path: previous_company_names in COMPANY_PROFILE payload.',
    1,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM "source_field_mappings"
    WHERE "sourceType" = 'REGISTRATION_AUTHORITY'
      AND "sourceReference" = 'COMPANIES_HOUSE'
      AND "mappingScope" = 'RAW_PAYLOAD'
      AND "payloadSubtype" = 'COMPANY_PROFILE'
      AND "sourcePath" = 'previous_company_names'
      AND "targetFieldNo" = 5
);
