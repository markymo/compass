-- AlterTable
ALTER TABLE "Questionnaire" ADD COLUMN     "functionalCode" TEXT,
ADD COLUMN     "referenceCode" TEXT;

-- CreateIndex
CREATE INDEX "Questionnaire_referenceCode_idx" ON "Questionnaire"("referenceCode");
