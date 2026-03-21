/*
  Warnings:

  - The values [INTERNAL_REVIEW,SUPPLIER_REVIEW,QUERY,CLIENT_SIGNED_OFF,SUPPLIER_SIGNED_OFF] on the enum `QuestionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `master_data_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('ASSERTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('USER_INPUT', 'GLEIF', 'COMPANIES_HOUSE', 'NATIONAL_REGISTRY', 'AI_EXTRACTION', 'SYSTEM_DERIVED');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('LEGAL_ENTITY', 'PERSON', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "MappingTransformType" AS ENUM ('DIRECT', 'DATE_TO_ISO', 'DATETIME_TO_ISO', 'COUNTRY_TO_NAME', 'COUNTRY_TO_ISO2', 'ENUM_MAP', 'FIRST_ARRAY_ITEM', 'JOIN_ARRAY');

-- AlterEnum
ALTER TYPE "OrgType" ADD VALUE 'SUPPLIER';

-- AlterEnum
BEGIN;
CREATE TYPE "QuestionStatus_new" AS ENUM ('DRAFT', 'APPROVED', 'SHARED', 'RELEASED');
ALTER TABLE "public"."Question" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Question" ALTER COLUMN "status" TYPE "QuestionStatus_new" USING ("status"::text::"QuestionStatus_new");
ALTER TYPE "QuestionStatus" RENAME TO "QuestionStatus_old";
ALTER TYPE "QuestionStatus_new" RENAME TO "QuestionStatus";
DROP TYPE "public"."QuestionStatus_old";
ALTER TABLE "Question" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "master_data_events" DROP CONSTRAINT "master_data_events_evidenceId_fkey";

-- DropForeignKey
ALTER TABLE "master_data_events" DROP CONSTRAINT "master_data_events_legalEntityId_fkey";

-- AlterTable
ALTER TABLE "ClientLE" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "legalEntityId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "masterFieldKey" TEXT,
ADD COLUMN     "prefilledForQuestionId" TEXT,
ADD COLUMN     "questionId" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- AlterTable
ALTER TABLE "FIEngagement" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "clientLEId" TEXT,
ADD COLUMN     "organizationId" TEXT,
ALTER COLUMN "fiEngagementId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "allowAttachments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "approvedMappingConfig" JSONB,
ADD COLUMN     "assignedByUserId" TEXT,
ADD COLUMN     "expectedDataType" TEXT NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "prefilledValue" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedByUserId" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3),
ADD COLUMN     "sharedByUserId" TEXT,
ADD COLUMN     "supplierNote" TEXT,
ADD COLUMN     "supplierNoteUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "supplierNoteUpdatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Questionnaire" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UsageLog" ADD COLUMN     "env" TEXT NOT NULL DEFAULT 'unknown';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "notificationPrefs" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}';

-- DropTable
DROP TABLE "master_data_events";

-- CreateTable
CREATE TABLE "master_field_assignments" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_field_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_field_notes" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_field_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LEActivity" (
    "id" TEXT NOT NULL,
    "leId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LEActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_notes" (
    "id" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "authorEmail" TEXT,
    "authorName" TEXT,
    "assignedToId" TEXT,
    "sessionTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "feedback_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "primaryNationality" TEXT,
    "isPublicFigure" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_claims" (
    "id" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "subjectLeId" TEXT,
    "subjectPersonId" TEXT,
    "subjectOrgId" TEXT,
    "collectionId" TEXT,
    "instanceId" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(65,30),
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "valuePersonId" TEXT,
    "valueLeId" TEXT,
    "valueOrgId" TEXT,
    "valueDocId" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'ASSERTED',
    "ownerScopeId" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "sourceReference" TEXT,
    "evidenceId" TEXT,
    "assertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "field_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_field_definitions" (
    "fieldNo" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "appDataType" TEXT NOT NULL,
    "isMultiValue" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "category" TEXT,
    "categoryId" TEXT,
    "categoryLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modelField" TEXT,

    CONSTRAINT "master_field_definitions_pkey" PRIMARY KEY ("fieldNo")
);

-- CreateTable
CREATE TABLE "master_data_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "master_data_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_field_groups" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_field_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_field_group_items" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fieldNo" INTEGER NOT NULL,
    "hideFromFieldPicker" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_field_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_field_mappings" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "targetFieldNo" INTEGER NOT NULL,
    "confidenceDefault" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "transformType" "MappingTransformType" NOT NULL DEFAULT 'DIRECT',
    "transformConfig" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "source_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_sample_payloads" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_sample_payloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_authorities" (
    "id" TEXT NOT NULL,
    "registryKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT,
    "jurisdiction" TEXT,
    "lookupStrategy" TEXT,
    "apiType" TEXT,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_references" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "sourceSystem" "SourceType" NOT NULL DEFAULT 'GLEIF',
    "sourceRecordId" TEXT,
    "registryAuthorityId" TEXT NOT NULL,
    "localRegistrationNumber" TEXT NOT NULL,
    "registryCountryCode" TEXT,
    "derivedFromEvidenceId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_fetches" (
    "id" TEXT NOT NULL,
    "registryReferenceId" TEXT NOT NULL,
    "connectorKey" TEXT,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawPayloadJson" JSONB,
    "normalizedJson" JSONB,
    "evidenceId" TEXT,

    CONSTRAINT "registry_fetches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_field_assignments_clientLEId_fieldNo_key" ON "master_field_assignments"("clientLEId", "fieldNo");

-- CreateIndex
CREATE UNIQUE INDEX "master_field_notes_clientLEId_fieldNo_key" ON "master_field_notes"("clientLEId", "fieldNo");

-- CreateIndex
CREATE INDEX "LEActivity_leId_createdAt_idx" ON "LEActivity"("leId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LEActivity_userId_idx" ON "LEActivity"("userId");

-- CreateIndex
CREATE INDEX "feedback_notes_sessionTag_createdAt_idx" ON "feedback_notes"("sessionTag", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "field_claims_subjectLeId_fieldNo_idx" ON "field_claims"("subjectLeId", "fieldNo");

-- CreateIndex
CREATE INDEX "field_claims_subjectPersonId_fieldNo_idx" ON "field_claims"("subjectPersonId", "fieldNo");

-- CreateIndex
CREATE INDEX "field_claims_subjectOrgId_fieldNo_idx" ON "field_claims"("subjectOrgId", "fieldNo");

-- CreateIndex
CREATE INDEX "field_claims_ownerScopeId_idx" ON "field_claims"("ownerScopeId");

-- CreateIndex
CREATE INDEX "field_claims_fieldNo_idx" ON "field_claims"("fieldNo");

-- CreateIndex
CREATE INDEX "field_claims_supersedesId_idx" ON "field_claims"("supersedesId");

-- CreateIndex
CREATE INDEX "field_claims_subjectLeId_ownerScopeId_fieldNo_collectionId_idx" ON "field_claims"("subjectLeId", "ownerScopeId", "fieldNo", "collectionId");

-- CreateIndex
CREATE INDEX "field_claims_collectionId_instanceId_idx" ON "field_claims"("collectionId", "instanceId");

-- CreateIndex
CREATE INDEX "master_field_definitions_isActive_order_idx" ON "master_field_definitions"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "master_data_categories_key_key" ON "master_data_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "master_field_groups_key_key" ON "master_field_groups"("key");

-- CreateIndex
CREATE INDEX "master_field_groups_isActive_order_idx" ON "master_field_groups"("isActive", "order");

-- CreateIndex
CREATE INDEX "master_field_groups_category_idx" ON "master_field_groups"("category");

-- CreateIndex
CREATE INDEX "master_field_group_items_groupId_order_idx" ON "master_field_group_items"("groupId", "order");

-- CreateIndex
CREATE INDEX "master_field_group_items_fieldNo_idx" ON "master_field_group_items"("fieldNo");

-- CreateIndex
CREATE INDEX "master_field_group_items_hideFromFieldPicker_idx" ON "master_field_group_items"("hideFromFieldPicker");

-- CreateIndex
CREATE UNIQUE INDEX "master_field_group_items_groupId_fieldNo_key" ON "master_field_group_items"("groupId", "fieldNo");

-- CreateIndex
CREATE INDEX "source_field_mappings_sourceType_isActive_idx" ON "source_field_mappings"("sourceType", "isActive");

-- CreateIndex
CREATE INDEX "source_field_mappings_sourceType_priority_idx" ON "source_field_mappings"("sourceType", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "source_field_mappings_sourceType_sourcePath_targetFieldNo_key" ON "source_field_mappings"("sourceType", "sourcePath", "targetFieldNo");

-- CreateIndex
CREATE INDEX "source_sample_payloads_sourceType_isDefault_idx" ON "source_sample_payloads"("sourceType", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "registry_authorities_registryKey_key" ON "registry_authorities"("registryKey");

-- CreateIndex
CREATE INDEX "registry_references_status_idx" ON "registry_references"("status");

-- CreateIndex
CREATE UNIQUE INDEX "registry_references_clientLEId_registryAuthorityId_localReg_key" ON "registry_references"("clientLEId", "registryAuthorityId", "localRegistrationNumber");

-- CreateIndex
CREATE INDEX "registry_fetches_registryReferenceId_idx" ON "registry_fetches"("registryReferenceId");

-- CreateIndex
CREATE INDEX "ClientLE_legalEntityId_idx" ON "ClientLE"("legalEntityId");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_clientLEId_idx" ON "Invitation"("clientLEId");

-- CreateIndex
CREATE INDEX "Invitation_fiEngagementId_idx" ON "Invitation"("fiEngagementId");

-- CreateIndex
CREATE INDEX "Invitation_sentToEmail_idx" ON "Invitation"("sentToEmail");

-- CreateIndex
CREATE INDEX "UsageLog_env_createdAt_idx" ON "UsageLog"("env", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ClientLE" ADD CONSTRAINT "ClientLE_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_prefilledForQuestionId_fkey" FOREIGN KEY ("prefilledForQuestionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_supplierNoteUpdatedByUserId_fkey" FOREIGN KEY ("supplierNoteUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_assignments" ADD CONSTRAINT "master_field_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_assignments" ADD CONSTRAINT "master_field_assignments_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_assignments" ADD CONSTRAINT "master_field_assignments_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_notes" ADD CONSTRAINT "master_field_notes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_notes" ADD CONSTRAINT "master_field_notes_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LEActivity" ADD CONSTRAINT "LEActivity_leId_fkey" FOREIGN KEY ("leId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LEActivity" ADD CONSTRAINT "LEActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence_store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_ownerScopeId_fkey" FOREIGN KEY ("ownerScopeId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_subjectLeId_fkey" FOREIGN KEY ("subjectLeId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_subjectOrgId_fkey" FOREIGN KEY ("subjectOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_subjectPersonId_fkey" FOREIGN KEY ("subjectPersonId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "field_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_valueDocId_fkey" FOREIGN KEY ("valueDocId") REFERENCES "document_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_valueLeId_fkey" FOREIGN KEY ("valueLeId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_valueOrgId_fkey" FOREIGN KEY ("valueOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_valuePersonId_fkey" FOREIGN KEY ("valuePersonId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_definitions" ADD CONSTRAINT "master_field_definitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "master_data_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_group_items" ADD CONSTRAINT "master_field_group_items_fieldNo_fkey" FOREIGN KEY ("fieldNo") REFERENCES "master_field_definitions"("fieldNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_field_group_items" ADD CONSTRAINT "master_field_group_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "master_field_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_field_mappings" ADD CONSTRAINT "source_field_mappings_targetFieldNo_fkey" FOREIGN KEY ("targetFieldNo") REFERENCES "master_field_definitions"("fieldNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_references" ADD CONSTRAINT "registry_references_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_references" ADD CONSTRAINT "registry_references_registryAuthorityId_fkey" FOREIGN KEY ("registryAuthorityId") REFERENCES "registry_authorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_fetches" ADD CONSTRAINT "registry_fetches_registryReferenceId_fkey" FOREIGN KEY ("registryReferenceId") REFERENCES "registry_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;
