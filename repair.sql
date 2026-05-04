-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING_LEI', 'PENDING_ENRICHMENT', 'ENRICHED', 'PARTIAL', 'FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'END');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MappingTransformType" ADD VALUE 'TO_ADDRESS_OBJECT';
ALTER TYPE "MappingTransformType" ADD VALUE 'TO_PARTY_OBJECT';
ALTER TYPE "MappingTransformType" ADD VALUE 'TO_PARTY_LIST';

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
DROP INDEX "registry_fetches_registryReferenceId_idx";

-- DropIndex
DROP INDEX "source_field_mappings_sourceType_isActive_idx";

-- DropIndex
DROP INDEX "source_field_mappings_sourceType_sourcePath_targetFieldNo_key";

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
ALTER TABLE "legal_entities" ADD COLUMN     "localRegistrationNumber" TEXT,
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "master_field_graph_bindings" (
    "id" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "graphNodeType" TEXT NOT NULL,
    "filterEdgeType" TEXT,
    "filterActiveOnly" BOOLEAN NOT NULL DEFAULT true,
    "writeBackEdgeType" TEXT,
    "writeBackIsActive" BOOLEAN NOT NULL DEFAULT true,
    "pickerLabel" TEXT,
    "allowCreate" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_field_graph_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_runs" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "registrationAuthorityId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL_REFRESH',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "initiatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "enrichment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_source_payloads" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "enrichmentRunId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "externalId" TEXT,
    "payloadSubtype" "PayloadSubtype" NOT NULL,
    "payload" JSONB NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_source_payloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_baseline_extracts" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "enrichmentRunId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "countryCode" TEXT,
    "registrationAuthorityId" TEXT NOT NULL,
    "entityStatus" TEXT,
    "registeredAddress" JSONB,
    "incorporationDate" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_baseline_extracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_le_graph_nodes" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "personId" TEXT,
    "legalEntityId" TEXT,
    "addressId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastModifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_le_graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_le_graph_edges" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT,
    "edgeType" TEXT NOT NULL,
    "naturesOfControl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifiedOn" TIMESTAMP(3),
    "ceasedOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastModifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_le_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_field_graph_bindings_fieldNo_isActive_idx" ON "master_field_graph_bindings"("fieldNo", "isActive");

-- CreateIndex
CREATE INDEX "master_field_graph_bindings_graphNodeType_writeBackEdgeType_idx" ON "master_field_graph_bindings"("graphNodeType", "writeBackEdgeType");

-- CreateIndex
CREATE INDEX "enrichment_runs_legalEntityId_createdAt_idx" ON "enrichment_runs"("legalEntityId", "createdAt");

-- CreateIndex
CREATE INDEX "registry_source_payloads_legalEntityId_sourceType_isLatest_idx" ON "registry_source_payloads"("legalEntityId", "sourceType", "isLatest");

-- CreateIndex
CREATE INDEX "registry_source_payloads_sourceReference_externalId_idx" ON "registry_source_payloads"("sourceReference", "externalId");

-- CreateIndex
CREATE INDEX "registry_baseline_extracts_legalEntityId_extractedAt_idx" ON "registry_baseline_extracts"("legalEntityId", "extractedAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_le_graph_nodes_clientLEId_personId_key" ON "client_le_graph_nodes"("clientLEId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "client_le_graph_nodes_clientLEId_legalEntityId_key" ON "client_le_graph_nodes"("clientLEId", "legalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "client_le_graph_nodes_clientLEId_addressId_key" ON "client_le_graph_nodes"("clientLEId", "addressId");

-- CreateIndex
CREATE INDEX "client_le_graph_edges_clientLEId_idx" ON "client_le_graph_edges"("clientLEId");

-- CreateIndex
CREATE INDEX "client_le_graph_edges_fromNodeId_idx" ON "client_le_graph_edges"("fromNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "client_le_graph_edges_fromNodeId_toNodeId_edgeType_key" ON "client_le_graph_edges"("fromNodeId", "toNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "registry_fetches_registryReferenceId_status_idx" ON "registry_fetches"("registryReferenceId", "status");

-- CreateIndex
CREATE INDEX "registry_fetches_requestedAt_idx" ON "registry_fetches"("requestedAt");

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
ALTER TABLE "master_field_graph_bindings" ADD CONSTRAINT "master_field_graph_bindings_fieldNo_fkey" FOREIGN KEY ("fieldNo") REFERENCES "master_field_definitions"("fieldNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_runs" ADD CONSTRAINT "enrichment_runs_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_source_payloads" ADD CONSTRAINT "registry_source_payloads_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_source_payloads" ADD CONSTRAINT "registry_source_payloads_enrichmentRunId_fkey" FOREIGN KEY ("enrichmentRunId") REFERENCES "enrichment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_baseline_extracts" ADD CONSTRAINT "registry_baseline_extracts_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_baseline_extracts" ADD CONSTRAINT "registry_baseline_extracts_enrichmentRunId_fkey" FOREIGN KEY ("enrichmentRunId") REFERENCES "enrichment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_nodes" ADD CONSTRAINT "client_le_graph_nodes_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_nodes" ADD CONSTRAINT "client_le_graph_nodes_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_nodes" ADD CONSTRAINT "client_le_graph_nodes_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_nodes" ADD CONSTRAINT "client_le_graph_nodes_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_nodes" ADD CONSTRAINT "client_le_graph_nodes_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_edges" ADD CONSTRAINT "client_le_graph_edges_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_edges" ADD CONSTRAINT "client_le_graph_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "client_le_graph_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_edges" ADD CONSTRAINT "client_le_graph_edges_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_le_graph_edges" ADD CONSTRAINT "client_le_graph_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "client_le_graph_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "sourceType_sourceReference_mappingScope_payloadSubtype_sourcePa" RENAME TO "source_field_mappings_sourceType_sourceReference_mappingSco_key";

