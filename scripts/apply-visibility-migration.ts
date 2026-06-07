/**
 * Applies the 20260607_add_questionnaire_visibility migration SQL
 * using Prisma's $executeRawUnsafe.
 * Run: npx ts-node --project tsconfig.json scripts/apply-visibility-migration.ts
 */
import prisma from '../src/lib/prisma';

const statements = [
    `CREATE TYPE "QuestionnaireVisibility" AS ENUM ('PRIVATE', 'RESTRICTED', 'GLOBAL')`,
    `ALTER TABLE "Questionnaire" ADD COLUMN "visibility" "QuestionnaireVisibility"`,
    `UPDATE "Questionnaire" SET "visibility" = 'GLOBAL' WHERE "kind" = 'REFERENCE_SNAPSHOT' AND "isGlobal" = true`,
    `UPDATE "Questionnaire" SET "visibility" = 'PRIVATE' WHERE "visibility" IS NULL`,
    `ALTER TABLE "Questionnaire" ALTER COLUMN "visibility" SET NOT NULL`,
    `ALTER TABLE "Questionnaire" ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE'`,
    `CREATE TABLE "QuestionnaireVisibilityGrant" (
        "id"              TEXT NOT NULL,
        "questionnaireId" TEXT NOT NULL,
        "organizationId"  TEXT NOT NULL,
        "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "QuestionnaireVisibilityGrant_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "QuestionnaireVisibilityGrant"
        ADD CONSTRAINT "QuestionnaireVisibilityGrant_questionnaireId_fkey"
        FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "QuestionnaireVisibilityGrant"
        ADD CONSTRAINT "QuestionnaireVisibilityGrant_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `CREATE UNIQUE INDEX "QuestionnaireVisibilityGrant_questionnaireId_organizationId_key"
        ON "QuestionnaireVisibilityGrant"("questionnaireId", "organizationId")`,
    `CREATE INDEX "QuestionnaireVisibilityGrant_organizationId_idx"
        ON "QuestionnaireVisibilityGrant"("organizationId")`,
];

async function main() {
    for (const stmt of statements) {
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
        process.stdout.write(`  → ${preview}... `);
        try {
            await (prisma as any).$executeRawUnsafe(stmt);
            console.log('OK');
        } catch (e: any) {
            if (e.message?.includes('already exists')) {
                console.log('already exists, skipping');
            } else {
                console.error(`\nFAILED: ${e.message}`);
                process.exit(1);
            }
        }
    }
    console.log('\nMigration applied successfully.');
    await prisma.$disconnect();
}

main();
