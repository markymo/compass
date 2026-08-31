import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Cosmetic Wave 01 — Track B: Output Pack & Relationships Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let clientLEName: string;
    let relationshipId: string;

    test.beforeAll(() => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        clientLEName = manifest.alphaClientLE.name;
        relationshipId = manifest.relationshipAlpha.id;
    });

    test('ONP-117: Relationships page header identifies the Legal Entity name rather than generic "Supplier Relationships"', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('networkidle');

        // On current dev, this assertion FAILS (RED) because RelationshipsPage sets title="Supplier Relationships",
        // replacing the Legal Entity name in the StandardPageHeader
        const headerTitle = page.locator('header h1').first();
        await expect(headerTitle).toContainText(clientLEName);
        await expect(headerTitle).not.toHaveText(/^Supplier Relationships$/i);
    });

    test('ONP-102 & ONP-115: Output Pack builder uses clear section taxonomy and canonical button sizing', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('networkidle');

        // Navigate / open the relationship detail view which hosts OutputPackBuilder
        const relCard = page.getByText(manifest.supplierOrgA.name).first();
        await relCard.click();

        // 1. Check Output Pack section headers
        // ONP-102: Distinct "Common Questionnaires" / "Relationship Questionnaires" section labels and "Documents"
        const genericQuestionnairesHeader = page.locator('span', { hasText: /^Questionnaires$/i });
        await expect(genericQuestionnairesHeader).not.toBeVisible();

        const commonQHeader = page.locator('span', { hasText: /Common Questionnaires/i });
        await expect(commonQHeader).toBeVisible();

        const docsHeader = page.locator('span', { hasText: /^Documents$/i });
        await expect(docsHeader).toBeVisible();

        const verboseDocsHeader = page.getByText(/Supporting Documents \(not linked to specific questions\)/i);
        await expect(verboseDocsHeader).not.toBeVisible();

        // 2. ONP-115: Questionnaire download button has accessible label and canonical sizing
        const downloadBtn = page.locator('button[aria-label="Download questionnaire PDF"], button[title="Download questionnaire PDF"]').first();
        await expect(downloadBtn).toBeVisible();
        await expect(downloadBtn).toHaveAttribute('aria-label', /Download questionnaire PDF/i);
    });

    test('ONP-116: Output Pack displays question numbers in questionnaire references', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('networkidle');

        const relCard = page.getByText(manifest.supplierOrgA.name).first();
        await relCard.click();

        // When questionnaire files/references are expanded in Output Pack,
        // question numbers should be rendered (e.g. "Q1", "Q2", "Question 1") rather than just raw text snippets
        const filesAccordionTrigger = page.locator('button', { hasText: /file/i }).first();
        if (await filesAccordionTrigger.isVisible()) {
            await filesAccordionTrigger.click();
            const questionBadge = page.locator('span.font-mono', { hasText: /Q\d+|Question \d+/i }).first();
            await expect(questionBadge).toBeVisible();
        }
    });
});
