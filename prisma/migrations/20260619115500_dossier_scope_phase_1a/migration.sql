-- AlterTable
ALTER TABLE "field_claims" ADD COLUMN     "clientLeScopeId" TEXT;

-- CreateIndex
CREATE INDEX "field_claims_clientLeScopeId_idx" ON "field_claims"("clientLeScopeId");

