import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import PDFParser from 'pdf2json';

function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(null, true);
        parser.on("pdfParser_dataError", (err: any) => reject(err.parserError));
        parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
        parser.parseBuffer(buffer);
    });
}

const prisma = new PrismaClient();

async function ensureFieldVisible(page: any, fieldName: string) {
    const expandAll = page.getByRole('button', { name: 'Expand all' });
    if (await expandAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expandAll.click();
        await page.waitForTimeout(500);
    }
    const searchInput = page.getByPlaceholder('Search fields...');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill(fieldName);
        await page.waitForTimeout(500);
    }
}

test.describe('ONP-203 — Staging Verification on dev.onpro.tech (F134 & F143)', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(120000);

    test('1. F134 (Country of formation): /master, RHS drawer, TEXT editor check, raw claim integrity', async ({ page }) => {
        const manifest = loadUATManifest();
        const clientLEId = manifest.alphaClientLE.id;
        const masterUrl = `/app/le/${clientLEId}/master`;

        console.log(`Navigating to ${masterUrl}...`);
        await page.goto(masterUrl, { waitUntil: 'networkidle' });

        await ensureFieldVisible(page, 'Country of formation');

        // A. /master row displays expanded GLEIF label
        const fieldRow = page.locator('[data-testid="master-field-134"]');
        await expect(fieldRow).toBeVisible({ timeout: 15000 });
        await expect(fieldRow).toContainText('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
        console.log('✓ Staging /master row displays: GB – United Kingdom of Great Britain and Northern Ireland');

        // B. RHS drawer displays the same expanded label
        await fieldRow.click();
        const sheet = page.locator('[role="dialog"]').first();
        await expect(sheet).toBeVisible({ timeout: 10000 });
        await expect(sheet).toContainText('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
        console.log('✓ Staging RHS drawer displays expanded label');

        // C. Manual edit remains TEXT editor, NOT combobox
        const editButton = sheet.getByRole('button', { name: /Add value|Edit/i }).first();
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        const combobox = sheet.getByRole('combobox');
        const isComboboxVisible = await combobox.isVisible({ timeout: 1500 }).catch(() => false);
        expect(isComboboxVisible).toBe(false);
        console.log('✓ Editor is NOT a combobox (isComboboxVisible: false)');

        const textInput = sheet.locator('input[type="text"], input:not([type])').first();
        await expect(textInput).toBeVisible({ timeout: 5000 });
        console.log('✓ Editor remains standard TEXT input');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // D. Verify raw claim in database remains strictly code only
        const claim = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 134 }
        });
        expect(claim?.valueText).toBe('GB');
        console.log('✓ Database raw claim strictly preserves code: "GB"');
    });

    test('2. F134: Workbench4 and PDF Export canonical resolution', async ({ page }) => {
        const manifest = loadUATManifest();
        const clientLEId = manifest.alphaClientLE.id;
        const qnId = 'aefdb294-6796-472d-bb30-7959c3f744fd'; // Alpha Common Due Diligence
        const questionId = '56622fc5-5861-4d98-acb0-848cf851abe3'; // Common Question 1

        try {
            // Temporarily map question to F134
            await prisma.question.update({
                where: { id: questionId },
                data: { masterFieldNo: 134 }
            });

            // A. Surface 3: Workbench4
            await page.goto(`/app/le/${clientLEId}/workbench4`, { waitUntil: 'networkidle' });
            const questionHeading = page.getByText('Common Question 1', { exact: true });
            await expect(questionHeading).toBeVisible({ timeout: 15000 });
            const questionCard = questionHeading.locator('xpath=ancestor::div[contains(@class, "p-4")][1]');
            await expect(questionCard).toBeVisible({ timeout: 5000 });
            await expect(questionCard).toContainText('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
            console.log('✓ Workbench4 renders canonical display label: GB – United Kingdom of Great Britain and Northern Ireland');

            // B. Surface 4: PDF Export
            const response = await page.request.get(`/api/export/questionnaire/${qnId}?engagementId=${manifest.relationshipAlpha.id}`);
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type']).toContain('application/pdf');

            const pdfBuffer = await response.body();
            expect(pdfBuffer.length).toBeGreaterThan(1000);

            const pdfText = await parsePdfBuffer(pdfBuffer);
            expect(pdfText).toContain('Common Question 1');
            expect(pdfText).toContain('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
            console.log('✓ PDF Export resolves canonical label: GB – United Kingdom of Great Britain and Northern Ireland');
        } finally {
            // Restore question mapping to null
            await prisma.question.update({
                where: { id: questionId },
                data: { masterFieldNo: null }
            });
        }
    });

    test('3. F143 (Tax residence 1): SELECT/combobox, code & name search, stores code only, resolves label', async ({ page }) => {
        const manifest = loadUATManifest();
        const clientLEId = manifest.alphaClientLE.id;
        const masterUrl = `/app/le/${clientLEId}/master`;

        await page.goto(masterUrl, { waitUntil: 'networkidle' });
        await ensureFieldVisible(page, 'Tax residence 1');

        const fieldRow = page.locator('[data-testid="master-field-143"]');
        await expect(fieldRow).toBeVisible({ timeout: 15000 });

        const inspectBtn = fieldRow.getByRole('button', { name: /Inspect field 143/i });
        if (await inspectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await inspectBtn.click();
        } else {
            await fieldRow.click();
        }

        const sheet = page.locator('[role="dialog"]').first();
        await expect(sheet).toBeVisible({ timeout: 10000 });

        const editButton = sheet.getByRole('button', { name: /Add value|Edit/i }).first();
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        // Combobox available
        const comboboxButton = sheet.getByRole('combobox').first();
        await expect(comboboxButton).toBeVisible({ timeout: 5000 });
        console.log('✓ F143 combobox is available');
        await comboboxButton.click();

        const cmdkInput = page.locator('[cmdk-input]');
        await expect(cmdkInput).toBeVisible({ timeout: 5000 });

        // Code search: US-DE
        await cmdkInput.fill('US-DE');
        const usDeItem = page.locator('[cmdk-item]').filter({ hasText: /US-DE/i });
        await expect(usDeItem).toBeVisible({ timeout: 5000 });
        console.log('✓ Code search for "US-DE" found:', (await usDeItem.innerText()).trim());

        // Name search: Delaware
        await cmdkInput.fill('');
        await cmdkInput.fill('Delaware');
        const delawareItem = page.locator('[cmdk-item]').filter({ hasText: /Delaware/i });
        await expect(delawareItem).toBeVisible({ timeout: 5000 });
        console.log('✓ Name search for "Delaware" found:', (await delawareItem.innerText()).trim());

        // Select Delaware
        await delawareItem.click();

        // Save
        const saveButton = sheet.getByRole('button', { name: 'Save', exact: true });
        await expect(saveButton).toBeVisible();
        await saveButton.click();

        // Read-only display shows code + full name
        await expect(sheet).toContainText('US-DE \u2013 Delaware (United States of America)');
        console.log('✓ Staging RHS drawer resolves to: US-DE – Delaware (United States of America)');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        await page.reload({ waitUntil: 'networkidle' });
        await ensureFieldVisible(page, 'Tax residence 1');
        await expect(fieldRow).toContainText('US-DE \u2013 Delaware (United States of America)');
        console.log('✓ Staging /master row resolves to: US-DE – Delaware (United States of America)');

        // Verify stored value in staging database is strictly 'US-DE'
        const claim = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 143 },
            orderBy: { assertedAt: 'desc' }
        });
        expect(claim?.valueText).toBe('US-DE');
        console.log('✓ Staging database claim strictly stored code only: "US-DE"');
    });
});
