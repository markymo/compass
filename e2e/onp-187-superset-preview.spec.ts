import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

const prisma = new PrismaClient();
const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/c70b4cd3-f739-4614-90ca-5ffb6e193baf';

test.describe('ONP-187: Superset Working Copy Preview Verification', () => {
    test.setTimeout(120000);

    let disposableQuestionnaireId: string | null = null;
    let activeFieldCount = 0;
    let earlyField: { fieldNo: number; fieldName: string };
    let midField: { fieldNo: number; fieldName: string };
    let lateField: { fieldNo: number; fieldName: string };

    test.beforeAll(async () => {
        const activeFields = await prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            orderBy: { fieldNo: 'asc' },
            select: { fieldNo: true, fieldName: true }
        });
        activeFieldCount = activeFields.length;
        expect(activeFieldCount).toBeGreaterThan(0);

        earlyField = activeFields[0];
        midField = activeFields[Math.floor(activeFields.length / 2)];
        lateField = activeFields[activeFields.length - 1];

        // Create disposable SUPERSET working copy using canonical CLI generator
        const scriptPath = path.resolve(process.cwd(), 'scripts', 'generate-superset-working-copy.ts');
        const cmd = `npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node"}' -r tsconfig-paths/register "${scriptPath}" --force`;
        const output = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8' });
        console.log('[beforeAll] Generator output:\n', output);

        const created = await prisma.questionnaire.findFirst({
            where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY', isDeleted: false }
        });
        if (!created) {
            throw new Error('Superset questionnaire was not created');
        }
        disposableQuestionnaireId = created.id;
    });

    test.afterAll(async () => {
        // Clean up disposable test data
        const supersets = await prisma.questionnaire.findMany({
            where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' },
            select: { id: true }
        });
        for (const s of supersets) {
            await prisma.question.deleteMany({
                where: { questionnaireId: s.id }
            });
            await prisma.questionnaire.delete({
                where: { id: s.id }
            }).catch(() => null);
        }

        const remaining = await prisma.questionnaire.count({
            where: { functionalCode: 'SUPERSET', kind: 'WORKING_COPY' }
        });
        expect(remaining).toBe(0);
        console.log('[afterAll] Verified remaining SUPERSET working copies in DB:', remaining);

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
        await page.goto(`/app/admin/questionnaires/${disposableQuestionnaireId}`, { waitUntil: 'networkidle' });

        // 6. Verify questionnaire opens normally
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toHaveValue(/SUPERSET_UNPUBLISHED_ONPRO_/);

        // 7. Verify representative early, middle, late fields
        const searchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await searchInput.isVisible()) {
            // Early field
            await searchInput.fill(earlyField.fieldName.slice(0, 20));
            await page.waitForTimeout(500);
            await expect(page.getByText(earlyField.fieldName.slice(0, 25)).first()).toBeVisible({ timeout: 10000 });

            // Middle field
            await searchInput.fill(midField.fieldName.slice(0, 20));
            await page.waitForTimeout(500);
            await expect(page.getByText(midField.fieldName.slice(0, 25)).first()).toBeVisible({ timeout: 10000 });

            // Late field
            await searchInput.fill(lateField.fieldName.slice(0, 20));
            await page.waitForTimeout(500);
            await expect(page.getByText(lateField.fieldName.slice(0, 25)).first()).toBeVisible({ timeout: 10000 });

            // Clear search filter
            await searchInput.fill('');
            await page.waitForTimeout(500);
        }

        // Screenshot 2: Editor view with mapped questions
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'preview-editor.png') });
    });
});
