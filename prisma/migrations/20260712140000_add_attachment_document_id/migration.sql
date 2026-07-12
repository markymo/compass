-- AlterTable
ALTER TABLE "field_claims" ADD COLUMN "attachmentDocumentId" TEXT;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_attachmentDocumentId_fkey" FOREIGN KEY ("attachmentDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "field_claims_attachmentDocumentId_idx" ON "field_claims"("attachmentDocumentId");
