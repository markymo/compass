-- AlterTable
ALTER TABLE "master_field_definitions" ADD COLUMN     "optionSetId" TEXT;

-- CreateTable
CREATE TABLE "master_data_option_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'STRING',
    "options" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_data_option_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_data_option_sets_name_key" ON "master_data_option_sets"("name");

-- AddForeignKey
ALTER TABLE "master_field_definitions" ADD CONSTRAINT "master_field_definitions_optionSetId_fkey" FOREIGN KEY ("optionSetId") REFERENCES "master_data_option_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
