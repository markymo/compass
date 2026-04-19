-- AlterTable
ALTER TABLE "SystemSetting" ALTER COLUMN "value" TYPE JSONB USING "value"::jsonb;
ALTER TABLE "SystemSetting" DROP COLUMN "createdAt";

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "field_claims" ADD COLUMN "subjectAddressId" TEXT;
ALTER TABLE "field_claims" ADD COLUMN "valueAddressId" TEXT;

-- CreateIndex
CREATE INDEX "field_claims_subjectAddressId_fieldNo_idx" ON "field_claims"("subjectAddressId", "fieldNo");

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_subjectAddressId_fkey" FOREIGN KEY ("subjectAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_valueAddressId_fkey" FOREIGN KEY ("valueAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
