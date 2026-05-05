-- DropIndex
DROP INDEX "Membership_userId_organizationId_clientLEId_key";

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "fiEngagementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_clientLEId_fiEngagementId_key" ON "Membership"("userId", "organizationId", "clientLEId", "fiEngagementId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_fiEngagementId_fkey" FOREIGN KEY ("fiEngagementId") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

