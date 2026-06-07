/**
 * One-shot migration runner for 20260607_add_questionnaire_visibility.
 * Uses Prisma $executeRawUnsafe so it runs through the same client as the app.
 * Idempotent: skips statements that fail with "already exists".
 * Run: npx vitest run scripts/run-visibility-migration.test.ts
 */
import { describe, it } from 'vitest';
import prisma from '@/lib/prisma';

const STATEMENTS = [
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

describe.skipIf(!process.env.DATABASE_URL)('Apply visibility migration', () => {
    it('runs all DDL statements idempotently', async () => {
        for (const stmt of STATEMENTS) {
            const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
            try {
                await (prisma as any).$executeRawUnsafe(stmt);
                console.log(`  ✓ ${preview}`);
            } catch (e: any) {
                const msg: string = e.message ?? '';
                if (
                    msg.includes('already exists') ||
                    msg.includes('duplicate column') ||
                    msg.includes('does not exist') && stmt.startsWith('UPDATE')
                ) {
                    console.log(`  ~ ${preview} (already applied)`);
                } else {
                    throw e;
                }
            }
        }
    }, 30_000);
});
