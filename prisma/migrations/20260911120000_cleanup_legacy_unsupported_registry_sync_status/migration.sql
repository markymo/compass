-- Normalize legacy FAILED rows for authorities that do not have
-- an automated connector in the current registry architecture.
UPDATE "registry_references" rr
SET "status" = 'UNSUPPORTED',
    "lastSyncStatus" = NULL
WHERE rr."status" = 'FAILED'
  AND rr."lastSyncStatus" = 'FAILED'
  AND rr."lastSyncSucceededAt" IS NULL
  AND rr."registryAuthorityId" NOT IN ('RA000585', 'RA000586', 'RA000587')
  AND NOT EXISTS (
    SELECT 1
    FROM "registry_authorities" ra
    WHERE ra."id" = rr."registryAuthorityId"
      AND ra."registryKey" IN (
        'GB_COMPANIES_HOUSE',
        'DE_HANDELSREGISTER',
        'FR_RECHERCHE_ENTREPRISES'
      )
  );

-- Clear invalid historical FAILED sync state from references already
-- classified as UNSUPPORTED.
UPDATE "registry_references"
SET "lastSyncStatus" = NULL
WHERE "status" = 'UNSUPPORTED'
  AND "lastSyncStatus" = 'FAILED';
