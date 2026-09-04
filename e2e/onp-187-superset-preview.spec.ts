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
    let activeFields: Array<{ fieldNo: number; fieldName: string }> = [];

    test.beforeAll(async () => {
        // Query active master fields from the target database
        activeFields = await prisma.masterFieldDefinition.findMany({
            where: { isActive: true },
            orderBy: { fieldNo: 'asc' },
            select: { fieldNo: true, fieldName: true }
        });
        activeFieldCount = activeFields.length;
        console.log(`[beforeAll] Active field count on target database: ${activeFieldCount}`);
        expect(activeFieldCount).toBeGreaterThan(0);

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
        if (createdByTest && targetQuestionnaireId) {
            console.log(`[afterAll] Cleaning up disposable test-created SUPERSET Working Copy (${targetQuestionnaireId}).`);
            await prisma.question.deleteMany({ where: { questionnaireId: targetQuestionnaireId } });
            await prisma.questionnaire.delete({ where: { id: targetQuestionnaireId } }).catch(() => null);
        } else {
            console.log(`[afterAll] Preserving pre-existing human-review SUPERSET Working Copy (${targetQuestionnaireId}).`);
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
            // Case B: Existing Superset - verify active count badge and "Open Superset" button
            await expect(page.getByText(`${activeFieldCount} active fields`)).toBeVisible({ timeout: 10000 });
            const openButton = page.getByRole('button', { name: /open superset/i });
            await expect(openButton).toBeVisible({ timeout: 10000 });
            await openButton.click();
            await page.waitForURL(/\/app\/admin\/questionnaires\/[0-9a-f-]+/, { timeout: 30000 });
        }

        // 4. Verify questionnaire opens normally in Mapper
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('input[placeholder="Questionnaire Name"]')).toHaveValue(/SUPERSET_UNPUBLISHED_ONPRO_/);

        // 5. Verify total question count displayed in Mapper header matches active field count
        await expect(page.getByText(`${activeFieldCount} Questions`).first()).toBeVisible({ timeout: 15000 });

        // 6. Verify first questions in Questionnaire Mapper match canonical Master Record sequence:
        // 1. [3] Legal name
        // 2. [5] Previous legal names
        // 3. [4] Trading names
        const questionRows = page.locator('div.h-12.border-b.border-slate-100.group.cursor-pointer');
        await expect(questionRows.first()).toBeVisible({ timeout: 15000 });

        const firstRow = questionRows.nth(0);
        await expect(firstRow.locator('span.tabular-nums')).toHaveText('1');
        await expect(firstRow.locator('span.truncate').first()).toContainText('Legal name');

        const secondRow = questionRows.nth(1);
        await expect(secondRow.locator('span.tabular-nums')).toHaveText('2');
        await expect(secondRow.locator('span.truncate').first()).toContainText('Previous legal names');

        const thirdRow = questionRows.nth(2);
        await expect(thirdRow.locator('span.tabular-nums')).toHaveText('3');
        await expect(thirdRow.locator('span.truncate').first()).toContainText('Trading names');

        // 7. Verify Database Question rows for complete membership, ordering, and absence of duplicates
        const dbQuestions = await prisma.question.findMany({
            where: { questionnaireId: targetQuestionnaireId },
            orderBy: { order: 'asc' }
        });

        // 7a. Exact count matches activeFieldCount
        expect(dbQuestions.length).toBe(activeFieldCount);

        // 7b. Sequential Question.order = 1..activeFieldCount
        for (let i = 0; i < dbQuestions.length; i++) {
            expect(dbQuestions[i].order).toBe(i + 1);
        }

        // 7c. No duplicates: activeFieldCount unique masterFieldNos
        const dbFieldNos = dbQuestions.map(q => q.masterFieldNo);
        const uniqueFieldNos = new Set(dbFieldNos);
        expect(uniqueFieldNos.size).toBe(activeFieldCount);

        // 7d. Complete active Master Field membership: zero omissions
        const activeFieldNos = new Set(activeFields.map(f => f.fieldNo));
        expect(uniqueFieldNos).toEqual(activeFieldNos);

        // 7e. First questions in DB match canonical Master Record sequence
        expect(dbQuestions[0].masterFieldNo).toBe(3); // Legal name
        expect(dbQuestions[1].masterFieldNo).toBe(5); // Previous legal names
        expect(dbQuestions[2].masterFieldNo).toBe(4); // Trading names

        // 7f. Representative later-category fields follow Master Record relative ordering:
        // Cat 1 (Identity): Field 3
        // Cat 2 (Registration): Field 134 (Country of formation)
        // Cat 3 (Ownership & control): Field 74 (Ownership structure chart)
        // Cat 12 (LEI): Field 2 (LEI)
        // Cat 18 (SSI): Field 116 (SSI 1 Currency)
        // Cat 19 (ZZ): Field 202 (TEST ORG)
        // Residual inactive-category: Field 121 (temp field)
        const orderLegalName = dbQuestions.find(q => q.masterFieldNo === 3)!.order;
        const orderFormation = dbQuestions.find(q => q.masterFieldNo === 134)!.order;
        const orderOwnership = dbQuestions.find(q => q.masterFieldNo === 74)!.order;
        const orderLEI = dbQuestions.find(q => q.masterFieldNo === 2)!.order;
        const orderSSI = dbQuestions.find(q => q.masterFieldNo === 116)!.order;
        const orderZZ = dbQuestions.find(q => q.masterFieldNo === 202)!.order;
        const orderField121 = dbQuestions.find(q => q.masterFieldNo === 121)!.order;

        expect(orderLegalName).toBeLessThan(orderFormation);
        expect(orderFormation).toBeLessThan(orderOwnership);
        expect(orderOwnership).toBeLessThan(orderLEI);
        expect(orderLEI).toBeLessThan(orderSSI);
        expect(orderSSI).toBeLessThan(orderZZ);
        expect(orderZZ).toBeLessThan(orderField121);

        // 7g. Residual Field 121 remains present after all Master Record sequence fields
        expect(orderField121).toBe(activeFieldCount);
        expect(dbQuestions[activeFieldCount - 1].masterFieldNo).toBe(121);
        expect(dbQuestions[activeFieldCount - 1].text).toBe('temp field');

        // 8. Verify representative fields and residual Field 121 in Mapper filter UI
        const searchInput = page.locator('input[placeholder="Filter questions..."]');
        await expect(searchInput).toBeVisible({ timeout: 15000 });

        const fieldsToInspect = [
            { fieldNo: 3, label: 'Legal name', expectedPosition: 'early' },
            { fieldNo: 2, label: 'LEI', expectedPosition: 'mid' },
            { fieldNo: 121, label: 'temp field', expectedPosition: 'residual' },
        ];

        for (const f of fieldsToInspect) {
            console.log(`[filter-ui-check] Verifying ${f.expectedPosition} field [${f.fieldNo}] "${f.label}" in Mapper`);
            await searchInput.fill(f.label);
            await page.waitForTimeout(600);

            const row = page.locator('div.group.cursor-pointer').filter({ hasText: f.label }).first();
            await expect(row).toBeVisible({ timeout: 10000 });
            await expect(row.locator('text=Mapped')).toBeVisible({ timeout: 5000 });

            // Click row to inspect detail mapping sheet
            await row.locator('span.truncate').first().click();
            const detailSheet = page.locator('[role="dialog"]').filter({ hasText: 'Map to Data Field' });
            await expect(detailSheet).toBeVisible({ timeout: 5000 });
            await expect(detailSheet.getByText('Mapped to Standard Field')).toBeVisible({ timeout: 5000 });

            // Close detail sheet
            await page.keyboard.press('Escape');
            await expect(detailSheet).toBeHidden({ timeout: 5000 });
            await page.waitForTimeout(200);

            // Clear filter
            await searchInput.fill('');
            await page.waitForTimeout(300);
        }

        // Screenshot 1: Editor view with mapped questions
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'preview-editor.png') });

        // 9. Navigate back to Working Copies tab
        await page.goto('/app/admin/questionnaires-v2?tab=working-copy', { waitUntil: 'networkidle' });

        // 10. Verify the Superset row is visible in the table
        const supersetRow = page.locator('tr[role="button"]', { hasText: 'SUPERSET' }).first();
        await expect(supersetRow).toBeVisible({ timeout: 20000 });

        // 11. Verify Superset Control Card displays Open & Refresh buttons
        const openBtn = page.getByRole('button', { name: /open superset/i });
        const refreshBtn = page.getByRole('button', { name: /refresh from master schema/i });
        await expect(openBtn).toBeVisible({ timeout: 10000 });
        await expect(refreshBtn).toBeVisible({ timeout: 10000 });

        // 12. Test Refresh Confirmation Dialog (Cancel flow to preserve questionnaire idempotently)
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
