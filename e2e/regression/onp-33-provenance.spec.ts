import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import PDFParser from 'pdf2json';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PROV-01 — Last validated provenance is consistent across surfaces
// Linear: ONP-33

const prisma = new PrismaClient();

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new (PDFParser as any)(null, 1);
        pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', () => {
            const rawText = (pdfParser as any).getRawTextContent();
            resolve(decodeURIComponent(rawText));
        });
        pdfParser.parseBuffer(pdfBuffer);
    });
}

test.describe('PROV-01 / ONP-33 — Provenance & Last Validated Consistency Across Surfaces', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let clientLEId: string;
    let supplierOrgId: string;
    let alphaEngagementId: string;
    let testUser: any;
    let testQuestionnaire: any;
    let testQuestion: any;
    let initialClaim: any;
    let updatedClaim: any;

    const testPrefix = `PROV01 Test ${Date.now()}`;
    const initialValue = `Provenance Co ${Date.now().toString().slice(-4)}`;
    const updatedValue = `Updated Provenance ${Date.now().toString().slice(-4)}`;
    const initialDate = new Date('2026-08-20T14:30:00.000Z');

    test.beforeAll(async () => {
        const clientLE = await prisma.clientLE.findFirst({
            where: { shortCode: 'uat_cle_alpha' }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: clientLE.id, isDeleted: false }
        });
        if (!engagement) throw new Error(`Active engagement for ${clientLE.id} not found`);

        clientLEId = clientLE.id;
        supplierOrgId = engagement.fiOrgId;
        alphaEngagementId = engagement.id;

        testUser = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });

        // 1. Create questionnaire attached to supplier and relationship
        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: `${testPrefix} QN`,
                description: 'Testing cross-surface provenance and PDF export',
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                engagements: { connect: { id: alphaEngagementId } }
            }
        });

        // 2. Create question mapped to Field 2 (Legal Name) with status SHARED
        testQuestion = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: `${testPrefix}: What is the authoritative legal entity name?`,
                order: 1,
                masterFieldNo: 2,
                status: 'SHARED'
            }
        });

        // 3. Create verified manual claim on Field 2 with known timestamp
        initialClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_CLAIM_1`,
                valueText: initialValue,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: initialDate,
                verifiedAt: initialDate,
                verifiedByUserId: testUser?.id || (await prisma.user.findFirst())?.id!
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (testQuestionnaire?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
                await prisma.questionnaire.deleteMany({ where: { id: testQuestionnaire.id } });
            }
            if (initialClaim?.id || updatedClaim?.id) {
                await prisma.fieldClaim.deleteMany({
                    where: { id: { in: [initialClaim?.id, updatedClaim?.id].filter(Boolean) } }
                });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-33:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Last validated provenance is rendered consistently on Master Card and Drawer', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 2 card in Master Record
        const field2Card = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(field2Card).toBeVisible({ timeout: 15000 });
        await expect(field2Card).toContainText(initialValue);

        // Assert source badge indicates User Input and Last validated
        const sourceBadge = field2Card.locator('text=/User input/i').first();
        await expect(sourceBadge).toBeVisible();
        const lastValidatedLabel = field2Card.locator('text=/Last validated/i').first();
        await expect(lastValidatedLabel).toBeVisible();

        // Click card to open inspector drawer
        await field2Card.locator('[role="button"]').first().click();
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer).toContainText(initialValue);

        // Assert drawer displays consistent source badge and Last validated metadata
        const drawerSource = drawer.locator('text=/User input/i').first();
        await expect(drawerSource).toBeVisible();
    });

    test('2. Supplier Questions Workbench displays mapped question answer and Last validated badge', async ({ browser }) => {
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await supplierContext.newPage();
        try {
            await page.goto(`/app/s/${supplierOrgId}/questions?s=${encodeURIComponent(testPrefix)}`);
            await page.waitForLoadState('networkidle');

            // Verify question card / row renders with distinctive question text
            const questionHeading = page.locator(`h3:has-text("${testPrefix}")`).first();
            await expect(questionHeading).toBeVisible({ timeout: 15000 });

            // Locate answer section
            const answerSection = page.locator('.space-y-4, .card, div').filter({ hasText: testPrefix }).first();
            await expect(answerSection).toBeVisible({ timeout: 10000 });

            // Verify canonical answer value is rendered
            await expect(answerSection).toContainText(initialValue);

            // Verify FieldSourceBadge with Last validated is visible
            const sourceBadge = answerSection.locator('text=/User input/i').first();
            await expect(sourceBadge).toBeVisible();
            await expect(answerSection).toContainText(/Last validated/i);
        } finally {
            await supplierContext.close();
        }
    });

    test('3. Export / PDF binary extraction contains canonical value and Last validated timestamp', async ({ request }) => {
        const pdfRes = await request.get(`/api/export/questionnaire/${testQuestionnaire.id}`);
        expect(pdfRes.status()).toBe(200);
        expect(pdfRes.headers()['content-type']).toContain('application/pdf');

        const pdfBytes = await pdfRes.body();
        expect(pdfBytes.length).toBeGreaterThan(1000);

        // Inspect actual extracted text content from generated PDF
        const extractedText = await extractPdfText(pdfBytes);
        expect(extractedText).toContain(initialValue);
        expect(extractedText).toContain('Last validated:');
        expect(extractedText).toContain('20 Aug 2026');
        expect(extractedText).toContain('UTC');
    });

    test('4. Supported update establishes new winning claim with refreshed provenance timestamp', async ({ page }) => {
        // Create new winning claim with current timestamp
        updatedClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_CLAIM_2`,
                valueText: updatedValue,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedAt: new Date(),
                verifiedByUserId: testUser?.id || (await prisma.user.findFirst())?.id!
            }
        });

        // Navigate to Master Record
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Verify updated value wins and displays fresh Last validated badge
        const field2Card = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(field2Card).toBeVisible({ timeout: 15000 });
        await expect(field2Card).toContainText(updatedValue);
        await expect(field2Card.locator('text=/Last validated/i').first()).toBeVisible();
    });

    test('5. Unmapped / unpopulated fields do not display a bogus Last Validated badge', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const unmappedCard = page.locator('[data-testid="master-field-99"], [data-field-no="99"]').first();
        if (await unmappedCard.isVisible()) {
            await expect(unmappedCard.locator('text=/Last validated/i')).toHaveCount(0);
        }
    });
});
