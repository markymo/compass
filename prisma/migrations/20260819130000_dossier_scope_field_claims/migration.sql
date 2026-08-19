-- Step 1: Safe conditional rename of clientLeScopeId -> clientLEId
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='field_claims' AND column_name='clientLeScopeId'
    ) THEN
        ALTER TABLE "field_claims" RENAME COLUMN "clientLeScopeId" TO "clientLEId";
    END IF;
END $$;

-- Step 2: Backfill any legacy/test claims where clientLEId is null using ClientLE with matching legalEntityId
UPDATE "field_claims" fc
SET "clientLEId" = cle."id"
FROM "ClientLE" cle
WHERE fc."clientLEId" IS NULL
  AND fc."subjectLeId" = cle."legalEntityId";

-- Step 3: Remove any un-scoped legacy/test claims where clientLEId is NULL or does not exist in ClientLE table
DELETE FROM "field_claims" fc
WHERE fc."clientLEId" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "ClientLE" cle WHERE cle."id" = fc."clientLEId");

-- Step 4: Enforce NOT NULL on clientLEId
ALTER TABLE "field_claims" ALTER COLUMN "clientLEId" SET NOT NULL;

-- Step 5: Drop obsolete index
DROP INDEX IF EXISTS "field_claims_clientLeScopeId_idx";

-- Step 6: Create new composite indexes for dossier-first claim queries
CREATE INDEX IF NOT EXISTS "field_claims_clientLEId_fieldNo_claimRole_status_idx" ON "field_claims"("clientLEId", "fieldNo", "claimRole", "status");
CREATE INDEX IF NOT EXISTS "field_claims_clientLEId_assertedAt_idx" ON "field_claims"("clientLEId", "assertedAt");

-- Step 7: Add foreign key constraint from FieldClaim to ClientLE if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='field_claims_clientLEId_fkey'
    ) THEN
        ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
