-- Consolidate SUPPLIER_ADMIN into generic ORG_ADMIN with safe deduplication

-- 1. Deduplicate Memberships:
-- Delete SUPPLIER_ADMIN memberships where the user already has an ORG_ADMIN membership for the same organization
DELETE FROM "Membership" m1
WHERE m1."role" = 'SUPPLIER_ADMIN'
  AND m1."organizationId" IS NOT NULL
  AND m1."clientLEId" IS NULL
  AND m1."fiEngagementId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Membership" m2
    WHERE m2."userId" = m1."userId"
      AND m2."organizationId" = m1."organizationId"
      AND m2."clientLEId" IS NULL
      AND m2."fiEngagementId" IS NULL
      AND m2."role" = 'ORG_ADMIN'
      AND m2."id" != m1."id"
  );

-- Convert any remaining SUPPLIER_ADMIN memberships to ORG_ADMIN
UPDATE "Membership"
SET "role" = 'ORG_ADMIN'
WHERE "role" = 'SUPPLIER_ADMIN';

-- 2. Deduplicate Pending Invitations:
-- Delete SUPPLIER_ADMIN invitations where there is already an active ORG_ADMIN invitation for the same email and organization
DELETE FROM "Invitation" i1
WHERE i1."role" = 'SUPPLIER_ADMIN'
  AND i1."organizationId" IS NOT NULL
  AND i1."clientLEId" IS NULL
  AND i1."fiEngagementId" IS NULL
  AND i1."usedAt" IS NULL
  AND i1."revokedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Invitation" i2
    WHERE i2."sentToEmail" = i1."sentToEmail"
      AND i2."organizationId" = i1."organizationId"
      AND i2."clientLEId" IS NULL
      AND i2."fiEngagementId" IS NULL
      AND i2."usedAt" IS NULL
      AND i2."revokedAt" IS NULL
      AND i2."role" = 'ORG_ADMIN'
      AND i2."id" != i1."id"
  );

-- Convert any remaining SUPPLIER_ADMIN invitations to ORG_ADMIN
UPDATE "Invitation"
SET "role" = 'ORG_ADMIN'
WHERE "role" = 'SUPPLIER_ADMIN';
