import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();

const prisma = new PrismaClient();

test.describe('Cosmetic Wave 01 — Track B: Output Pack & Relationships Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let clientLEName: string;
    let relationshipId: string;
    let createdDocId: string | null = null;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        clientLEName = manifest.alphaClientLE.name;
        relationshipId = manifest.relationshipAlpha.id;

        // Find or create question with order 2 in Alpha's questionnaire and attach a disposable document for ONP-116 testing
        let alphaQuestion = await prisma.question.findFirst({
            where: {
                questionnaire: {
                    fiEngagementId: relationshipId,
                    isDeleted: false,
                    kind: 'ENGAGEMENT_QUESTIONNAIRE'
                },
                order: 2
            }
        });

        if (!alphaQuestion) {
            const createdQ = await prisma.questionnaire.create({
                data: {
                    name: 'Alpha Relationship Due Diligence',
                    fiEngagementId: relationshipId,
                    fiOrgId: manifest.supplierOrgA.id,
                    status: 'ACTIVE',
                    kind: 'ENGAGEMENT_QUESTIONNAIRE',
                    questions: {
                        create: [
                            { text: 'Question 1', order: 1, expectedDataType: 'TEXT' },
                            { text: 'Question 2', order: 2, expectedDataType: 'TEXT' }
                        ]
                    }
                },
                include: { questions: true }
            });
            alphaQuestion = createdQ.questions.find(q => q.order === 2) || createdQ.questions[0];
        }

        if (alphaQuestion) {
            const doc = await prisma.document.create({
                data: {
                    name: `test_attachment_onp116_${Date.now()}.pdf`,
                    storagePathname: `test/onp116_${Date.now()}.pdf`,
                    mimeType: 'application/pdf',
                    questionId: alphaQuestion.id,
                    isDeleted: false
                }
            });
            createdDocId = doc.id;
        }
    });

    test.afterAll(async () => {
        try {
            if (createdDocId) {
                await prisma.document.delete({ where: { id: createdDocId } });
            }
        } catch (err) {
            console.warn('[ONP-116] Cleanup warning:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-117: Relationships page header identifies the Legal Entity name rather than generic "Supplier Relationships"', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/relationships`);
        await page.waitForLoadState('networkidle');

        // On unfixed dev, this assertion FAILS (RED) because RelationshipsPage sets title="Supplier Relationships",
        // replacing the Legal Entity name in the StandardPageHeader
        const headerTitle = page.locator('h1').first();
        await expect(headerTitle).toContainText(clientLEName);
        await expect(headerTitle).not.toHaveText(/^Supplier Relationships$/i);
    });

    test('ONP-102A: Output Pack builder renders distinct "Common Questionnaires" heading for common questionnaires', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('networkidle');

        const outputPanel = page
            .locator('[role="tabpanel"][data-state="active"]')
            .filter({ has: page.getByText('Output Pack', { exact: true }) });

        // 1. Generic single "Questionnaires" section heading must NOT be used
        const genericSectionHeader = outputPanel.locator('span.uppercase', { hasText: /^Questionnaires$/i });
        await expect(genericSectionHeader).not.toBeVisible();

        // 2. Distinct "Common Questionnaires" heading must be visible
        const commonQHeader = outputPanel.locator('span', { hasText: /Common Questionnaires/i });
        await expect(commonQHeader).toBeVisible();
    });

    test('ONP-102B: Output Pack builder renders distinct "Relationship Questionnaires" heading for relationship questionnaires', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('networkidle');

        const outputPanel = page
            .locator('[role="tabpanel"][data-state="active"]')
            .filter({ has: page.getByText('Output Pack', { exact: true }) });

        // Distinct "Relationship Questionnaires" heading must be visible
        const relQHeader = outputPanel.locator('span', { hasText: /Relationship Questionnaires/i });
        await expect(relQHeader).toBeVisible();
    });

    test('ONP-102C: Output Pack builder simplifies supporting documents heading to "Documents"', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('networkidle');

        const outputPanel = page
            .locator('[role="tabpanel"][data-state="active"]')
            .filter({ has: page.getByText('Output Pack', { exact: true }) });

        // 1. Verbose phrase must NOT be present
        const verboseDocsHeader = outputPanel.getByText(/Supporting Documents \(not linked to specific questions\)/i);
        await expect(verboseDocsHeader).not.toBeVisible();

        // 2. Clear concise "Documents" heading must be visible
        const docsHeader = outputPanel.locator('span', { hasText: /^Documents$/i });
        await expect(docsHeader).toBeVisible();
    });

    test('ONP-115A: Individual questionnaire download button has accessible name', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('networkidle');

        const downloadBtn = page.locator('button[title*="Download questionnaire"], button[aria-label*="Download questionnaire"]').first();
        await expect(downloadBtn).toBeVisible();

        // On unfixed dev, button lacks aria-label (returns null)
        const ariaLabel = await downloadBtn.getAttribute('aria-label');
        expect(ariaLabel).not.toBeNull();
        expect(ariaLabel).toMatch(/Download questionnaire/i);
    });

    test('ONP-115B: Individual questionnaire download button satisfies minimum 32px x 32px hit target geometry', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('networkidle');

        const downloadBtn = page.locator('button[title*="Download questionnaire"], button[aria-label*="Download questionnaire"]').first();
        await expect(downloadBtn).toBeVisible();

        // On unfixed dev, bare button has computed bounding box < 32px (p-1.5 = 28px)
        const box = await downloadBtn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
            expect(box.height).toBeGreaterThanOrEqual(32);
            expect(box.width).toBeGreaterThanOrEqual(32);
        }
    });

    test('ONP-116: Output Pack questionnaire attachments display canonical persisted question number', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/engagement-new/${relationshipId}?tab=output`);
        await page.waitForLoadState('networkidle');

        // Expand questionnaire attachments list
        const filesAccordionTrigger = page.locator('button', { hasText: /file/i }).first();
        await expect(filesAccordionTrigger).toBeVisible();
        await filesAccordionTrigger.click();

        // On unfixed dev, the reference badge only renders text snippet (f.questionRef) without canonical Q number
        const questionBadge = page.locator('div.border-t span.font-mono').first();
        await expect(questionBadge).toBeVisible();
        await expect(questionBadge).toHaveText(/^Q\d+(:|\s|$)/i);
    });
});
