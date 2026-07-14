-- CreateEnum
CREATE TYPE "PrivateDocumentUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "field_claims" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "master_field_definitions" ADD COLUMN     "allowAttachments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PrivateDocumentUploadIntent" (
    "id" TEXT NOT NULL,
    "clientLEId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "storagePathname" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "declaredMimeType" TEXT,
    "status" "PrivateDocumentUploadStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "PrivateDocumentUploadIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivateDocumentUploadIntent_storagePathname_key" ON "PrivateDocumentUploadIntent"("storagePathname");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateDocumentUploadIntent_documentId_key" ON "PrivateDocumentUploadIntent"("documentId");

-- CreateIndex
CREATE INDEX "PrivateDocumentUploadIntent_clientLEId_status_idx" ON "PrivateDocumentUploadIntent"("clientLEId", "status");

-- CreateIndex
CREATE INDEX "PrivateDocumentUploadIntent_initiatedById_createdAt_idx" ON "PrivateDocumentUploadIntent"("initiatedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "field_claims_idempotencyKey_key" ON "field_claims"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "PrivateDocumentUploadIntent" ADD CONSTRAINT "PrivateDocumentUploadIntent_clientLEId_fkey" FOREIGN KEY ("clientLEId") REFERENCES "ClientLE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateDocumentUploadIntent" ADD CONSTRAINT "PrivateDocumentUploadIntent_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateDocumentUploadIntent" ADD CONSTRAINT "PrivateDocumentUploadIntent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

