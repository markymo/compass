-- CreateEnum
CREATE TYPE "ClaimRole" AS ENUM ('VALUE', 'FILE_ATTACHMENT');

-- DropIndex
DROP INDEX "field_claims_subjectLeId_ownerScopeId_fieldNo_collectionId_idx";

-- AlterTable
ALTER TABLE "field_claims" ADD COLUMN     "claimRole" "ClaimRole" NOT NULL DEFAULT 'VALUE';

-- CreateIndex
CREATE INDEX "field_claims_subjectLeId_ownerScopeId_fieldNo_collectionId__idx" ON "field_claims"("subjectLeId", "ownerScopeId", "fieldNo", "collectionId", "claimRole");

