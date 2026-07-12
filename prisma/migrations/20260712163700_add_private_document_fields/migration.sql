-- AlterTable
ALTER TABLE "Document" ADD COLUMN "storageProvider" TEXT,
ADD COLUMN "storagePathname" TEXT,
ADD COLUMN "sizeBytes" BIGINT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "checksum" TEXT;
