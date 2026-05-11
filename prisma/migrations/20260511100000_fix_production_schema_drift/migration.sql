-- ============================================================
-- Fix all production schema drift (applied manually to dev via repair.sql
-- but never committed as migrations, leaving production behind).
-- All statements use IF NOT EXISTS / IF EXISTS for idempotency.
-- ============================================================

-- 1. legal_entities: add missing 'name' column
--    (localRegistrationNumber was fixed in migration 20260511000000)
ALTER TABLE "legal_entities" ADD COLUMN IF NOT EXISTS "name" TEXT;

-- 2. client_le_graph_nodes: entire table missing from production
CREATE TABLE IF NOT EXISTS "client_le_graph_nodes" (
    "id"               TEXT NOT NULL,
    "clientLEId"       TEXT NOT NULL,
    "nodeType"         TEXT NOT NULL,
    "personId"         TEXT,
    "legalEntityId"    TEXT,
    "addressId"        TEXT,
    "source"           TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastModifiedById" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_le_graph_nodes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_le_graph_nodes_clientLEId_personId_key"
    ON "client_le_graph_nodes"("clientLEId", "personId");

CREATE UNIQUE INDEX IF NOT EXISTS "client_le_graph_nodes_clientLEId_legalEntityId_key"
    ON "client_le_graph_nodes"("clientLEId", "legalEntityId");

CREATE UNIQUE INDEX IF NOT EXISTS "client_le_graph_nodes_clientLEId_addressId_key"
    ON "client_le_graph_nodes"("clientLEId", "addressId");

ALTER TABLE "client_le_graph_nodes"
    DROP CONSTRAINT IF EXISTS "client_le_graph_nodes_clientLEId_fkey";
ALTER TABLE "client_le_graph_nodes"
    ADD CONSTRAINT "client_le_graph_nodes_clientLEId_fkey"
    FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_nodes"
    DROP CONSTRAINT IF EXISTS "client_le_graph_nodes_personId_fkey";
ALTER TABLE "client_le_graph_nodes"
    ADD CONSTRAINT "client_le_graph_nodes_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_nodes"
    DROP CONSTRAINT IF EXISTS "client_le_graph_nodes_legalEntityId_fkey";
ALTER TABLE "client_le_graph_nodes"
    ADD CONSTRAINT "client_le_graph_nodes_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_nodes"
    DROP CONSTRAINT IF EXISTS "client_le_graph_nodes_addressId_fkey";
ALTER TABLE "client_le_graph_nodes"
    ADD CONSTRAINT "client_le_graph_nodes_addressId_fkey"
    FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_nodes"
    DROP CONSTRAINT IF EXISTS "client_le_graph_nodes_lastModifiedById_fkey";
ALTER TABLE "client_le_graph_nodes"
    ADD CONSTRAINT "client_le_graph_nodes_lastModifiedById_fkey"
    FOREIGN KEY ("lastModifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. client_le_graph_edges: entire table missing from production
CREATE TABLE IF NOT EXISTS "client_le_graph_edges" (
    "id"               TEXT NOT NULL,
    "clientLEId"       TEXT NOT NULL,
    "fromNodeId"       TEXT NOT NULL,
    "toNodeId"         TEXT,
    "edgeType"         TEXT NOT NULL,
    "naturesOfControl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifiedOn"       TIMESTAMP(3),
    "ceasedOn"         TIMESTAMP(3),
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "source"           TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastModifiedById" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_le_graph_edges_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "client_le_graph_edges"
    DROP CONSTRAINT IF EXISTS "client_le_graph_edges_clientLEId_fkey";
ALTER TABLE "client_le_graph_edges"
    ADD CONSTRAINT "client_le_graph_edges_clientLEId_fkey"
    FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_edges"
    DROP CONSTRAINT IF EXISTS "client_le_graph_edges_fromNodeId_fkey";
ALTER TABLE "client_le_graph_edges"
    ADD CONSTRAINT "client_le_graph_edges_fromNodeId_fkey"
    FOREIGN KEY ("fromNodeId") REFERENCES "client_le_graph_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_edges"
    DROP CONSTRAINT IF EXISTS "client_le_graph_edges_toNodeId_fkey";
ALTER TABLE "client_le_graph_edges"
    ADD CONSTRAINT "client_le_graph_edges_toNodeId_fkey"
    FOREIGN KEY ("toNodeId") REFERENCES "client_le_graph_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_le_graph_edges"
    DROP CONSTRAINT IF EXISTS "client_le_graph_edges_lastModifiedById_fkey";
ALTER TABLE "client_le_graph_edges"
    ADD CONSTRAINT "client_le_graph_edges_lastModifiedById_fkey"
    FOREIGN KEY ("lastModifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. enrichment_runs: entire table missing from production
CREATE TABLE IF NOT EXISTS "enrichment_runs" (
    "id"                      TEXT NOT NULL,
    "legalEntityId"           TEXT NOT NULL,
    "registrationAuthorityId" TEXT,
    "triggerType"             TEXT NOT NULL DEFAULT 'MANUAL_REFRESH',
    "status"                  TEXT NOT NULL DEFAULT 'PENDING',
    "summary"                 JSONB,
    "initiatedBy"             TEXT,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"             TIMESTAMP(3),

    CONSTRAINT "enrichment_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "enrichment_runs_legalEntityId_createdAt_idx"
    ON "enrichment_runs"("legalEntityId", "createdAt" DESC);

ALTER TABLE "enrichment_runs"
    DROP CONSTRAINT IF EXISTS "enrichment_runs_legalEntityId_fkey";
ALTER TABLE "enrichment_runs"
    ADD CONSTRAINT "enrichment_runs_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. registry_source_payloads: entire table missing from production
CREATE TABLE IF NOT EXISTS "registry_source_payloads" (
    "id"              TEXT NOT NULL,
    "legalEntityId"   TEXT NOT NULL,
    "enrichmentRunId" TEXT NOT NULL,
    "sourceType"      TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "externalId"      TEXT,
    "payloadSubtype"  TEXT NOT NULL,
    "payload"         JSONB NOT NULL,
    "isLatest"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_source_payloads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "registry_source_payloads"
    DROP CONSTRAINT IF EXISTS "registry_source_payloads_legalEntityId_fkey";
ALTER TABLE "registry_source_payloads"
    ADD CONSTRAINT "registry_source_payloads_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registry_source_payloads"
    DROP CONSTRAINT IF EXISTS "registry_source_payloads_enrichmentRunId_fkey";
ALTER TABLE "registry_source_payloads"
    ADD CONSTRAINT "registry_source_payloads_enrichmentRunId_fkey"
    FOREIGN KEY ("enrichmentRunId") REFERENCES "enrichment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. registry_baseline_extracts: entire table missing from production
CREATE TABLE IF NOT EXISTS "registry_baseline_extracts" (
    "id"                      TEXT NOT NULL,
    "legalEntityId"           TEXT NOT NULL,
    "enrichmentRunId"         TEXT NOT NULL,
    "legalName"               TEXT NOT NULL,
    "registrationNumber"      TEXT NOT NULL,
    "countryCode"             TEXT,
    "registrationAuthorityId" TEXT NOT NULL,
    "entityStatus"            TEXT,
    "registeredAddress"       JSONB,
    "incorporationDate"       TIMESTAMP(3),
    "extractedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_baseline_extracts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "registry_baseline_extracts"
    DROP CONSTRAINT IF EXISTS "registry_baseline_extracts_legalEntityId_fkey";
ALTER TABLE "registry_baseline_extracts"
    ADD CONSTRAINT "registry_baseline_extracts_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registry_baseline_extracts"
    DROP CONSTRAINT IF EXISTS "registry_baseline_extracts_enrichmentRunId_fkey";
ALTER TABLE "registry_baseline_extracts"
    ADD CONSTRAINT "registry_baseline_extracts_enrichmentRunId_fkey"
    FOREIGN KEY ("enrichmentRunId") REFERENCES "enrichment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Also update ClientLE table to reference new tables (back-references handled by Prisma, not DB FKs)
