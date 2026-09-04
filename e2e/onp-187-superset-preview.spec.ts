import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();
const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/c70b4cd3-f739-4614-90ca-5ffb6e193baf';

test.describe('ONP-187: Superset Working Copy Preview Verification', () => {
    test.describe.configure({ mode: 'serial' });
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

        // Check for existing SUPERSET Working Copy (non-destructive hygiene)
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
            console.log(`[beforeAll] Existing SUPERSET Working Copy detected (${targetQuestionnaireId}). Reusing without force.`);
        } else {
            createdByTest = true;
            console.log('[beforeAll] No existing SUPERSET Working Copy found. Will generate through UI.');
        }
    });

    test.afterAll(async () => {
        // Repeatable and non-destructive: leave the human-review Superset in place!
        console.log(`[afterAll] Preserving human-review SUPERSET Working Copy (${targetQuestionnaireId}) for manual inspection.`);
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

        // 3. Verify Superset Control Card is visible
        const controlTitle = page.getByText('Superset from Master Schema').first();
        await expect(controlTitle).toBeVisible({ timeout: 20000 });

        if (createdByTest) {
            // Case A: No existing Superset - verify "Generate Superset from Master Schema" button and active count
            await expect(page.getByText(`${activeFieldCount} active Master Fields`)).toBeVisible({ timeout: 10000 });
            const generateButton = page.getByRole('button', { name: /generate superset from master schema/i });
            await expect(generateButton).toBeVisible({ timeout: 10000 });

            // Click Generate
            await generateButton.click();

            // Wait for navigation into Questionnaire Mapper
            await page.waitForURL(/\/app\/admin\/questionnaires\/[0-9a-f-]+/, { timeout: 30000 });
            const urlMatch = page.url().match(/\/app\/admin\/questionnaires\/([0-9a-f-]+)/);
            expect(urlMatch).not.toBeNull();
            targetQuestionnaireId = urlMatch![1];
            console.log(`[UI Flow] Generated Superset Working Copy with ID: ${targetQuestionnaireId}`);
        } else {
            // Case B: Existing Superset - verify "Open Superset" button and click it
            const openButton = page.getByRole('button', { name: /open superset/i });
            await expect(openButton).toBeVisible({ timeout: 10000 });
            await openButton.click();
            await page.waitForURL(/\/app\/admin\/questionnaires\/[0-9a-f-]+/, { timeout: 30000 });
        }

        // 4. Verify questionnaire opens normally in Mapper
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toHaveValue(/SUPERSET_UNPUBLISHED_ONPRO_/);

        // 5. Verify question count matches active field count
        await expect(page.getByText(`${activeFieldCount} Questions`).first()).toBeVisible({ timeout: 15000 });

        // 6. Strengthened Representative Mapping Assertions (Early, Middle, Late)
        const searchInput = page.locator('input[placeholder="Filter questions..."]');
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

            // Assert question visibly resolves its expected Master Field mapping in the table
            const mappedBadge = questionRow.locator('text=Mapped');
            await expect(mappedBadge).toBeVisible({ timeout: 5000 });
            await expect(questionRow.getByText(rep.fieldName.slice(0, 25)).first()).toBeVisible({ timeout: 5000 });

            // Click question label to inspect mapping in detail sheet (avoid clicking mapping dropdown)
            await questionRow.locator('span.truncate').first().click();
            const detailSheet = page.locator('[role="dialog"]').filter({ hasText: 'Map to Data Field' });
            await expect(detailSheet).toBeVisible({ timeout: 5000 });
            await expect(detailSheet.getByText('Mapped to Standard Field')).toBeVisible({ timeout: 5000 });

            // Close detail sheet
            await page.keyboard.press('Escape');
            await expect(detailSheet).toBeHidden({ timeout: 5000 });
            await page.waitForTimeout(200);

            // Clear search filter
            await searchInput.fill('');
            await page.waitForTimeout(300);
        }

        // Screenshot 1: Editor view with mapped questions
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'preview-editor.png') });

        // 7. Navigate back to Working Copies tab
        await page.goto('/app/admin/questionnaires-v2?tab=working-copy', { waitUntil: 'networkidle' });

        // 8. Verify the Superset row is visible in the table
        const supersetRow = page.locator('tr[role="button"]', { hasText: 'SUPERSET' }).first();
        await expect(supersetRow).toBeVisible({ timeout: 20000 });

        // 9. Verify Superset Control Card displays Open & Refresh buttons
        const openBtn = page.getByRole('button', { name: /open superset/i });
        const refreshBtn = page.getByRole('button', { name: /refresh from master schema/i });
        await expect(openBtn).toBeVisible({ timeout: 10000 });
        await expect(refreshBtn).toBeVisible({ timeout: 10000 });

        // 10. Test Refresh Confirmation Dialog (Cancel flow to preserve questionnaire)
        await refreshBtn.click();
        const confirmDialog = page.locator('div.fixed.inset-0').filter({ hasText: 'Refresh Superset from Master Schema?' });
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        await expect(confirmDialog.getByText(/any custom edits or manual modifications/i)).toBeVisible({ timeout: 5000 });
        const cancelBtn = confirmDialog.getByRole('button', { name: /cancel/i });
        await cancelBtn.click();
        await expect(confirmDialog).toBeHidden({ timeout: 5000 });

        // Screenshot 2: Working Copies list showing active SUPERSET card and table row
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'preview-working-copies.png') });
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
