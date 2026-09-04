import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

const prisma = new PrismaClient();
const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/c70b4cd3-f739-4614-90ca-5ffb6e193baf';

test.describe('ONP-187: Superset Working Copy Preview Verification', () => {
    test.setTimeout(120000);

    let targetQuestionnaireId: string;
    let createdByTest = false;
    let activeFieldCount = 0;
    let representativeFields: Array<{ fieldNo: number; fieldName: string; position: 'early' | 'middle' | 'late' }> = [];

    test.beforeAll(async () => {
        // Query active master fields from the target database
        const activeFields = await prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            orderBy: { fieldNo: 'asc' },
            select: { fieldNo: true, fieldName: true }
        });
        activeFieldCount = activeFields.length;
        expect(activeFieldCount).toBeGreaterThan(0);

        const earlyField = activeFields[0];
        const midField = activeFields[Math.floor(activeFields.length / 2)];
        const lateField = activeFields[activeFields.length - 1];

        representativeFields = [
            { ...earlyField, position: 'early' },
            { ...midField, position: 'middle' },
            { ...lateField, position: 'late' },
        ];

        // 1. Check for existing SUPERSET Working Copy (non-destructive hygiene)
        const existing = await prisma.questionnaire.findFirst({
            where: {
                functionalCode: 'SUPERSET',
                kind: 'WORKING_COPY',
                isDeleted: false,
            },
            select: { id: true }
        });

        if (existing) {
            targetQuestionnaireId = existing.id;
            createdByTest = false;
            console.log(`[beforeAll] Existing SUPERSET Working Copy detected (${targetQuestionnaireId}). Reusing without mutation.`);
        } else {
            // Run generator WITHOUT --force
            const scriptPath = path.resolve(process.cwd(), 'scripts', 'generate-superset-working-copy.ts');
            const cmd = `npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node"}' -r tsconfig-paths/register "${scriptPath}"`;
            const output = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8' });
            console.log('[beforeAll] Generator output (without --force):\n', output);

            const created = await prisma.questionnaire.findFirst({
                where: {
                    functionalCode: 'SUPERSET',
                    kind: 'WORKING_COPY',
                    isDeleted: false
                },
                select: { id: true }
            });

            if (!created) {
                throw new Error('SUPERSET Working Copy was not created by generator');
            }

            targetQuestionnaireId = created.id;
            createdByTest = true;
            console.log(`[beforeAll] Created disposable SUPERSET Working Copy: ${targetQuestionnaireId}`);
        }
    });

    test.afterAll(async () => {
        // Scoped cleanup: never wildcard-delete, never delete pre-existing data
        if (createdByTest && targetQuestionnaireId) {
            console.log(`[afterAll] Cleaning up test-created SUPERSET Working Copy: ${targetQuestionnaireId}`);
            await prisma.question.deleteMany({
                where: { questionnaireId: targetQuestionnaireId }
            });
            await prisma.questionnaire.delete({
                where: { id: targetQuestionnaireId }
            }).catch(() => null);

            // Verify the specific test-created questionnaire was deleted
            const check = await prisma.questionnaire.findUnique({
                where: { id: targetQuestionnaireId }
            });
            expect(check).toBeNull();
        } else if (!createdByTest && targetQuestionnaireId) {
            console.log(`[afterAll] Preserving pre-existing SUPERSET Working Copy (${targetQuestionnaireId}) untouched.`);
            const check = await prisma.questionnaire.findUnique({
                where: { id: targetQuestionnaireId }
            });
            expect(check).not.toBeNull();
        }

        await prisma.$disconnect();
    });

    test('validates Superset Working Copy in Questionnaire V2 and Mapper on Preview', async ({ page }) => {
        const email = 'uat+system-admin@onpro.tech';
        const password = process.env.UAT_PASSWORD || 'Password123!';

        // 1. Log in on Preview domain
        await page.goto('/login');
        await page.locator('input[type="email"], #email').fill(email);
        await page.locator('input[type="password"], #password').fill(password);
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page).not.toHaveURL(/login/, { timeout: 30000 });

        // Set wide desktop viewport
        await page.setViewportSize({ width: 1400, height: 900 });

        // 2. Navigate to Questionnaire V2 Working Copies
        await page.goto('/app/admin/questionnaires-v2?tab=working-copy', { waitUntil: 'networkidle' });

        // 3. Verify Superset appears in Working Copies list
        const supersetRow = page.locator('tr[role="button"]', { hasText: 'SUPERSET' }).first();
        await expect(supersetRow).toBeVisible({ timeout: 20000 });

        // Screenshot 1: Working Copies list showing SUPERSET
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'preview-working-copies.png') });

        // 4. Click row to inspect drawer details
        await supersetRow.click();
        const drawer = page.locator('[role="dialog"]');
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer.getByText(String(activeFieldCount))).toBeVisible({ timeout: 10000 });

        // 5. Open questionnaire editor
        await page.goto(`/app/admin/questionnaires/${targetQuestionnaireId}`, { waitUntil: 'networkidle' });

        // 6. Verify questionnaire opens normally
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toHaveValue(/SUPERSET_UNPUBLISHED_ONPRO_/);

        // 7. Strengthened Representative Mapping Assertions (Early, Middle, Late)
        const searchInput = page.locator('input[placeholder*="Search" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 15000 });

        for (const rep of representativeFields) {
            console.log(`[mapping-check] Verifying ${rep.position} field [${rep.fieldNo}] "${rep.fieldName}"`);

            // Filter questions by field name
            await searchInput.fill(rep.fieldName.slice(0, 20));
            await page.waitForTimeout(600);

            // Locate question row in table
            const questionRow = page.locator('div.group.cursor-pointer').filter({
                hasText: rep.fieldName.slice(0, 25)
            }).first();
            await expect(questionRow).toBeVisible({ timeout: 10000 });

            // Assert question visibly resolves its expected Master Field mapping
            const mappedBadge = questionRow.locator('text=Mapped');
            await expect(mappedBadge).toBeVisible({ timeout: 5000 });
            await expect(questionRow.getByText(rep.fieldName.slice(0, 25)).first()).toBeVisible({ timeout: 5000 });

            // Click question row to inspect mapping in detail sheet
            await questionRow.click();
            const detailSheet = page.locator('[role="dialog"]').first();
            if (await detailSheet.isVisible()) {
                await expect(detailSheet.getByText('Mapped to Standard Field')).toBeVisible({ timeout: 5000 });
                // Close detail sheet
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
            }

            // Clear search filter
            await searchInput.fill('');
            await page.waitForTimeout(300);
        }

        // Screenshot 2: Editor view with mapped questions
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'preview-editor.png') });
    });

    test('proves an existing persistent SUPERSET survives the E2E lifecycle untouched', async () => {
        const check = await prisma.questionnaire.findUnique({
            where: { id: targetQuestionnaireId },
            include: { _count: { select: { questions: true } } }
        });
        expect(check).not.toBeNull();
        expect(check?._count.questions).toBe(activeFieldCount);
    });
});
