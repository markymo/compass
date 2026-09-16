import { test, expect } from '@playwright/test';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import PDFParser from 'pdf2json';

function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(null, true);
        parser.on("pdfParser_dataError", (err: any) => reject(err.parserError));
        parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
        parser.parseBuffer(buffer);
    });
}

test.describe('ONP-46 Staging Verification on dev.onpro.tech', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
    test.setTimeout(90000);

    test('1. Rob F104 Negative Case: Exported Questionnaire PDF excludes WORD_TEST_DOC.docx for Field 104', async ({ request }) => {
        const questionnaireId = 'b8160e64-f1f7-48b3-8600-bdbc6affde3c';
        const response = await request.get(`/api/export/questionnaire/${questionnaireId}`);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/pdf');

        const pdfBuffer = await response.body();
        expect(pdfBuffer.length).toBeGreaterThan(1000);

        const text = await parsePdfBuffer(pdfBuffer);

        // Field 104 must be present in the questionnaire PDF
        expect(text).toContain('SSI callback contact(s)');

        // ONP-46 Invariant: WORD_TEST_DOC.docx must NOT appear in the export
        expect(text).not.toContain('WORD_TEST_DOC');
    });

    test('2. Master surface: Field 104 on Enviromena does not display Party document as field attachment', async ({ page }) => {
        const enviromenaId = '56680ada-587f-4e20-b8fa-491b72157706';
        await page.goto(`/app/le/${enviromenaId}/master`);
        await page.waitForLoadState('networkidle');

        // Verify page loaded
        const bodyText = await page.textContent('body');
        expect(bodyText).toContain('ENVIROMENA');

        // Look for Field 104 row
        const f104Row = page.locator('text=SSI callback contact(s)');
        if (await f104Row.isVisible()) {
            // Ensure no field-level paperclip indicator is associated with F104
            const parentSection = f104Row.locator('xpath=ancestor::div[contains(@class, "border") or contains(@class, "py-")]').first();
            const paperclip = parentSection.locator('svg.lucide-paperclip');
            expect(await paperclip.count()).toBe(0);
        }
    });

    test('3. Master surface: Field 998 with allowAttachments=false retains visible historic FIELD attachment indicator', async ({ page }) => {
        const part2ClientLEId = 'f5e1eda9-003e-483a-b776-aa080a27fd93';
        await page.goto(`/app/le/${part2ClientLEId}/master`);
        await page.waitForLoadState('networkidle');

        const bodyText = await page.textContent('body');
        expect(bodyText).toBeDefined();

        // Check for testNoAttachment field
        const f998Row = page.locator('text=testNoAttachment');
        if (await f998Row.isVisible()) {
            const parentSection = f998Row.locator('xpath=ancestor::div[contains(@class, "border") or contains(@class, "py-")]').first();
            // Invariant: Indicator must be visible because a historic FIELD attachment exists
            const indicator = parentSection.locator('div[aria-label*="attachment"]');
            expect(await indicator.count()).toBeGreaterThan(0);
        }
    });
});
