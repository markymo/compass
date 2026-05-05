-- Drop the broad unique constraint that did not work properly with NULLs
DROP INDEX IF EXISTS "Membership_userId_organizationId_clientLEId_fiEngagementId_key";
DROP INDEX IF EXISTS "Membership_userId_organizationId_clientLEId_key";

-- Add CHECK constraint to enforce exactly one scope
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_single_scope_check" CHECK (
    ( ("organizationId" IS NOT NULL)::int + ("clientLEId" IS NOT NULL)::int + ("fiEngagementId" IS NOT NULL)::int ) = 1
);

-- Add Partial Unique Indexes
CREATE UNIQUE INDEX "Membership_userId_organizationId_idx" ON "Membership"("userId", "organizationId") WHERE "organizationId" IS NOT NULL AND "clientLEId" IS NULL AND "fiEngagementId" IS NULL;

CREATE UNIQUE INDEX "Membership_userId_clientLEId_idx" ON "Membership"("userId", "clientLEId") WHERE "clientLEId" IS NOT NULL AND "organizationId" IS NULL AND "fiEngagementId" IS NULL;

CREATE UNIQUE INDEX "Membership_userId_fiEngagementId_idx" ON "Membership"("userId", "fiEngagementId") WHERE "fiEngagementId" IS NOT NULL AND "organizationId" IS NULL AND "clientLEId" IS NULL;
