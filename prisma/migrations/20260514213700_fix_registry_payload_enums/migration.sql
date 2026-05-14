-- Alter columns to use Enum types instead of TEXT
ALTER TABLE "registry_source_payloads" ALTER COLUMN "sourceType" TYPE "SourceType" USING "sourceType"::"SourceType";
ALTER TABLE "registry_source_payloads" ALTER COLUMN "payloadSubtype" TYPE "PayloadSubtype" USING "payloadSubtype"::"PayloadSubtype";
