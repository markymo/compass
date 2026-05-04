-- CreateEnum
CREATE TYPE "MappingScope" AS ENUM ('BASELINE', 'RAW_PAYLOAD');

-- CreateEnum
CREATE TYPE "PayloadSubtype" AS ENUM ('GENERAL', 'COMPANY_PROFILE', 'OFFICERS', 'PSC', 'FILINGS', 'SHAREHOLDERS');

-- AlterTable
ALTER TABLE "source_field_mappings" ADD COLUMN "mappingScope" "MappingScope" NOT NULL DEFAULT 'BASELINE',
ADD COLUMN "payloadSubtype" "PayloadSubtype" DEFAULT 'GENERAL',
ADD COLUMN "sourceReference" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX IF EXISTS "source_field_mappings_sourceType_isActive_idx";
DROP INDEX IF EXISTS "source_field_mappings_sourceType_sourcePath_targetFieldNo_key";

-- CreateIndex
CREATE INDEX "source_field_mappings_sourceType_sourceReference_isActive_idx" ON "source_field_mappings"("sourceType", "sourceReference", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "source_field_mappings_sourceType_sourceReference_mappingSco_key" ON "source_field_mappings"("sourceType", "sourceReference", "mappingScope", "payloadSubtype", "sourcePath", "targetFieldNo");

-- CreateTable
CREATE TABLE "admin_momentum_observations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scopeName" TEXT,
    "totalFields" INTEGER NOT NULL,
    "described" INTEGER NOT NULL,
    "mappedUkCh" INTEGER NOT NULL,
    "complete" INTEGER NOT NULL,
    "actionsLeft" INTEGER NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "admin_momentum_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_momentum_observations_scopeType_scopeKey_createdAt_idx" ON "admin_momentum_observations"("scopeType", "scopeKey", "createdAt");

-- CreateIndex
CREATE INDEX "admin_momentum_observations_createdAt_idx" ON "admin_momentum_observations"("createdAt");

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

-- CreateIndex
CREATE INDEX "master_field_graph_bindings_fieldNo_isActive_idx" ON "master_field_graph_bindings"("fieldNo", "isActive");

-- CreateIndex
CREATE INDEX "master_field_graph_bindings_graphNodeType_writeBackEdgeType_idx" ON "master_field_graph_bindings"("graphNodeType", "writeBackEdgeType");

-- AddForeignKey
ALTER TABLE "master_field_graph_bindings" ADD CONSTRAINT "master_field_graph_bindings_fieldNo_fkey" FOREIGN KEY ("fieldNo") REFERENCES "master_field_definitions"("fieldNo") ON DELETE CASCADE ON UPDATE CASCADE;
