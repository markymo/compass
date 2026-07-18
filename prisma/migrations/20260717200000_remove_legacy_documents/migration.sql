-- Drop references to Legacy Documents before deleting them to satisfy RESTRICT foreign key constraints
UPDATE "PrivateDocumentUploadIntent" SET "documentId" = NULL WHERE "documentId" IN (SELECT id FROM "Document" WHERE "storageProvider" IS NULL);
UPDATE "Questionnaire" SET "sourceDocumentId" = NULL WHERE "sourceDocumentId" IN (SELECT id FROM "Document" WHERE "storageProvider" IS NULL);
UPDATE "field_claims" SET "attachmentDocumentId" = NULL WHERE "attachmentDocumentId" IN (SELECT id FROM "Document" WHERE "storageProvider" IS NULL);
DELETE FROM "cc_party_documents" WHERE "documentId" IN (SELECT id FROM "Document" WHERE "storageProvider" IS NULL);

-- Drop Legacy Documents that were solely relying on public blob urls
DELETE FROM "Document" WHERE "storageProvider" IS NULL;

-- DropForeignKey
ALTER TABLE "document_registry" DROP CONSTRAINT IF EXISTS "document_registry_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "field_claims" DROP CONSTRAINT IF EXISTS "field_claims_valueDocId_fkey";

-- AlterTable
ALTER TABLE "Document" 
  DROP COLUMN IF EXISTS "docType",
  DROP COLUMN IF EXISTS "fileType",
  DROP COLUMN IF EXISTS "fileUrl",
  DROP COLUMN IF EXISTS "isVerified",
  DROP COLUMN IF EXISTS "kbSize",
  DROP COLUMN IF EXISTS "masterFieldKey";

-- AlterTable
ALTER TABLE "Questionnaire" DROP COLUMN IF EXISTS "fileUrl";

-- AlterTable
ALTER TABLE "field_claims" DROP COLUMN IF EXISTS "valueDocId";

-- DropTable
DROP TABLE IF EXISTS "document_registry";
