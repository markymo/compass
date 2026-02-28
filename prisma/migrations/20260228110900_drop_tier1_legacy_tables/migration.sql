-- AlterEnum: Remove AUTHORIZED_TRADER from DocumentOwnerType
BEGIN;
CREATE TYPE "DocumentOwnerType_new" AS ENUM ('LEGAL_ENTITY', 'STAKEHOLDER');
ALTER TABLE "document_registry" ALTER COLUMN "ownerType" TYPE "DocumentOwnerType_new" USING ("ownerType"::text::"DocumentOwnerType_new");
ALTER TYPE "DocumentOwnerType" RENAME TO "DocumentOwnerType_old";
ALTER TYPE "DocumentOwnerType_new" RENAME TO "DocumentOwnerType";
DROP TYPE "public"."DocumentOwnerType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "authorized_traders" DROP CONSTRAINT "authorized_traders_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "compliance_profiles" DROP CONSTRAINT "compliance_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "constitutional_profiles" DROP CONSTRAINT "constitutional_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "contact_profiles" DROP CONSTRAINT "contact_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "derivatives_profiles" DROP CONSTRAINT "derivatives_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "entity_info_profiles" DROP CONSTRAINT "entity_info_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "financial_profiles" DROP CONSTRAINT "financial_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "identity_profiles" DROP CONSTRAINT "identity_profiles_clientLEId_fkey";

-- DropForeignKey
ALTER TABLE "identity_profiles" DROP CONSTRAINT "identity_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "lei_registrations" DROP CONSTRAINT "lei_registrations_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "relationship_profiles" DROP CONSTRAINT "relationship_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "settlement_instructions" DROP CONSTRAINT "settlement_instructions_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "tax_profiles" DROP CONSTRAINT "tax_profiles_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "tax_registrations" DROP CONSTRAINT "tax_registrations_legalEntityId_fkey";

-- DropForeignKey
ALTER TABLE "trading_profiles" DROP CONSTRAINT "trading_profiles_legalEntityId_fkey";

-- DropTable
DROP TABLE "authorized_traders";

-- DropTable
DROP TABLE "compliance_profiles";

-- DropTable
DROP TABLE "constitutional_profiles";

-- DropTable
DROP TABLE "contact_profiles";

-- DropTable
DROP TABLE "contacts";

-- DropTable
DROP TABLE "derivatives_profiles";

-- DropTable
DROP TABLE "entity_info_profiles";

-- DropTable
DROP TABLE "financial_profiles";

-- DropTable
DROP TABLE "identity_profiles";

-- DropTable
DROP TABLE "lei_registrations";

-- DropTable
DROP TABLE "relationship_profiles";

-- DropTable
DROP TABLE "settlement_instructions";

-- DropTable
DROP TABLE "tax_profiles";

-- DropTable
DROP TABLE "tax_registrations";

-- DropTable
DROP TABLE "trading_profiles";

-- Also drop unused ContactType enum (no longer needed after contacts table deleted)
DROP TYPE IF EXISTS "ContactType";
