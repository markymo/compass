-- AlterTable: Document (Nullability and Ownership)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "ownerOrgId" TEXT;
ALTER TABLE "Document" ALTER COLUMN "clientLEId" DROP NOT NULL;

-- Recreate Foreign Key for Document clientLEId (due to nullability change and Cascade semantic update)
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_clientLEId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Questionnaire (Source Document)
ALTER TABLE "Questionnaire" ADD COLUMN IF NOT EXISTS "sourceDocumentId" TEXT;

-- AddForeignKey: Questionnaire -> Document
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
