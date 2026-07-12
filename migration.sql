-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING_LEI', 'PENDING_ENRICHMENT', 'ENRICHED', 'PARTIAL', 'FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'END');

-- AlterEnum
ALTER TYPE "OrgType" ADD VALUE 'OTHER';

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "ClientLERecord" DROP CONSTRAINT "ClientLERecord_clientLEId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_clientLEId_fkey";

-- DropForeignKey
ALTER TABLE "FIEngagement" DROP CONSTRAINT "FIEngagement_clientLEId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_clientLEId_fkey";

-- DropForeignKey
ALTER TABLE "Questionnaire" DROP CONSTRAINT "Questionnaire_fiEngagementId_fkey";

-- DropIndex
DROP INDEX "AuditLog_entityId_idx";

-- DropIndex
DROP INDEX "AuditLog_userId_idx";

-- DropIndex
DROP INDEX "enrichment_runs_legalEntityId_createdAt_idx";

-- DropIndex
DROP INDEX "registry_fetches_registryReferenceId_idx";

-- DropIndex
DROP INDEX "source_field_mappings_sourceType_isActive_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "details",
DROP COLUMN "userId",
ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "changedFields" TEXT[],
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "newData" JSONB,
ADD COLUMN     "oldData" JSONB,
ADD COLUMN     "sourceType" TEXT NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL,
ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Questionnaire" ALTER COLUMN "lockedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "master_data_categories" ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "client_le_graph_edges_clientLEId_idx" ON "client_le_graph_edges"("clientLEId");

-- CreateIndex
CREATE INDEX "client_le_graph_edges_fromNodeId_idx" ON "client_le_graph_edges"("fromNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "client_le_graph_edges_fromNodeId_toNodeId_edgeType_key" ON "client_le_graph_edges"("fromNodeId", "toNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "enrichment_runs_legalEntityId_createdAt_idx" ON "enrichment_runs"("legalEntityId", "createdAt");

-- CreateIndex
CREATE INDEX "registry_baseline_extracts_legalEntityId_extractedAt_idx" ON "registry_baseline_extracts"("legalEntityId", "extractedAt");

-- CreateIndex
CREATE INDEX "registry_fetches_registryReferenceId_status_idx" ON "registry_fetches"("registryReferenceId", "status");

-- CreateIndex
CREATE INDEX "registry_fetches_requestedAt_idx" ON "registry_fetches"("requestedAt");

-- CreateIndex
CREATE INDEX "registry_source_payloads_legalEntityId_sourceType_isLatest_idx" ON "registry_source_payloads"("legalEntityId", "sourceType", "isLatest");

-- CreateIndex
CREATE INDEX "registry_source_payloads_sourceReference_externalId_idx" ON "registry_source_payloads"("sourceReference", "externalId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLERecord" ADD CONSTRAINT "ClientLERecord_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FIEngagement" ADD CONSTRAINT "FIEngagement_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_fiEngagementId_fkey" FOREIGN KEY ("fiEngagementId") REFERENCES "FIEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_attachmentDocumentId_fkey" FOREIGN KEY ("attachmentDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "sourceType_sourceReference_mappingScope_payloadSubtype_sourcePa" RENAME TO "source_field_mappings_sourceType_sourceReference_mappingSco_key";

