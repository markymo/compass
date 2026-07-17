-- CreateEnum
CREATE TYPE "CCPartyDocumentOperation" AS ENUM ('ATTACH', 'REPLACE', 'REMOVE');

-- CreateTable
CREATE TABLE "cc_party_documents" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "operation" "CCPartyDocumentOperation" NOT NULL DEFAULT 'ATTACH',
    "idempotencyKey" TEXT,
    "assertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assertedById" TEXT,

    CONSTRAINT "cc_party_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cc_party_documents_idempotencyKey_key" ON "cc_party_documents"("idempotencyKey");

-- CreateIndex
CREATE INDEX "cc_party_documents_partyId_instanceId_assertedAt_id_idx" ON "cc_party_documents"("partyId", "instanceId", "assertedAt", "id");

-- CreateIndex
CREATE INDEX "cc_party_documents_documentId_assertedAt_idx" ON "cc_party_documents"("documentId", "assertedAt");

-- CreateIndex
CREATE INDEX "cc_party_documents_partyId_assertedAt_idx" ON "cc_party_documents"("partyId", "assertedAt");

-- AddForeignKey
ALTER TABLE "cc_party_documents" ADD CONSTRAINT "cc_party_documents_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "cc_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cc_party_documents" ADD CONSTRAINT "cc_party_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cc_party_documents" ADD CONSTRAINT "cc_party_documents_assertedById_fkey" FOREIGN KEY ("assertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

