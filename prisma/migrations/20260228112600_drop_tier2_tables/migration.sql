-- AlterEnum: Remove STAKEHOLDER from DocumentOwnerType
BEGIN;
CREATE TYPE "DocumentOwnerType_new" AS ENUM ('LEGAL_ENTITY');
ALTER TABLE "document_registry" ALTER COLUMN "ownerType" TYPE "DocumentOwnerType_new" USING ("ownerType"::text::"DocumentOwnerType_new");
ALTER TYPE "DocumentOwnerType" RENAME TO "DocumentOwnerType_old";
ALTER TYPE "DocumentOwnerType_new" RENAME TO "DocumentOwnerType";
DROP TYPE "public"."DocumentOwnerType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "entity_names" DROP CONSTRAINT "entity_names_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "industry_classifications" DROP CONSTRAINT "industry_classifications_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "stakeholders" DROP CONSTRAINT "stakeholders_legalEntityId_fkey";

-- DropTable
DROP TABLE "entity_names";

-- DropTable
DROP TABLE "industry_classifications";

-- DropTable
DROP TABLE "stakeholders";

-- DropEnum
DROP TYPE "StakeholderRole";

-- DropEnum
DROP TYPE "StakeholderType";

-- DropEnum (leftover from Tier 1 - contacts table already dropped)
DROP TYPE IF EXISTS "ContactType";
