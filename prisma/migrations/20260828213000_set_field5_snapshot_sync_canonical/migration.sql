-- Narrowly scoped data migration for Field 5 (NAME_HISTORY / Previous Legal Names)
-- Converges Companies House and GLEIF mappings to canonical transformType and syncMode.

-- 1. Companies House Field 5 mapping
UPDATE "source_field_mappings"
SET "transformType" = 'TO_NAME_HISTORY_LIST',
    "syncMode" = 'SNAPSHOT_SYNC',
    "priority" = 100,
    "notes" = 'UK Previous Legal Names — TO_NAME_HISTORY_LIST produces one structured row per entry (name, effectiveFrom, effectiveTo). Path: previous_company_names in COMPANY_PROFILE payload.'
WHERE "sourceType" = 'REGISTRATION_AUTHORITY'
  AND "sourceReference" IN ('COMPANIES_HOUSE', 'RA000585')
  AND "mappingScope" = 'RAW_PAYLOAD'
  AND "payloadSubtype" = 'COMPANY_PROFILE'
  AND "sourcePath" = 'previous_company_names'
  AND "targetFieldNo" = 5;

-- 2. GLEIF Field 5 mapping
UPDATE "source_field_mappings"
SET "transformType" = 'TO_NAME_HISTORY_LIST',
    "syncMode" = 'SNAPSHOT_SYNC',
    "priority" = 110,
    "notes" = 'GLEIF otherNames — TO_NAME_HISTORY_LIST handles string[] or {name,type}[] tolerantly. Dates typically absent.'
WHERE "sourceType" = 'GLEIF'
  AND "mappingScope" = 'BASELINE'
  AND "sourcePath" = 'entity.otherNames'
  AND "targetFieldNo" = 5;
