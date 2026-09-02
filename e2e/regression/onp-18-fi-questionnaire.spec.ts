import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QNR-05 — An authorised user can add/assign a questionnaire through the supported relationship questionnaire flow
// Linear: ONP-18

const prisma = new PrismaClient();

test.describe('QNR-05 / ONP-18 — Relationship Questionnaire Assignment & Visibility Flow', () => {
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let testClientLEId: string;
    let testClientLEName: string;
    let testSupplierOrgId: string;
    let testEngagementId: string;
    let templateQuestionnaireId: string;
    let assignedQuestionnaireId: string;

    const testTimestamp = Date.now();
    const testPrefix = `QNR05 ${testTimestamp}`;
    const distinctiveTemplateName = `${testPrefix} DD Questionnaire`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const clientLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: clientLE.id, isDeleted: false },
            include: { org: true }
        });
        if (!engagement) throw new Error(`Active engagement for ${clientLE.id} not found`);

        testClientLEId = clientLE.id;
        testClientLEName = clientLE.name;
        testSupplierOrgId = engagement.fiOrgId;
        testEngagementId = engagement.id;

        // Create a distinct template questionnaire in the reference library
        const template = await prisma.questionnaire.create({
            data: {
                fiOrg: { connect: { id: testSupplierOrgId } },
                name: distinctiveTemplateName,
                description: 'Template for QNR-05 automated regression verification',
                isTemplate: true,
                isGlobal: true,
                visibility: 'GLOBAL',
                status: 'ACTIVE',
                kind: 'REFERENCE_SNAPSHOT',
                referenceCode: `TPL_${testTimestamp.toString().slice(-6)}`,
                questions: {
                    create: [
                        {
                            text: `${testPrefix}: What is the primary operational jurisdiction?`,
                            order: 1,
                            masterFieldNo: 2,
                            status: 'SHARED'
                        }
                    ]
                }
            }
        });
        templateQuestionnaireId = template.id;
    });

    test.afterAll(async () => {
        try {
            if (assignedQuestionnaireId) {
                await prisma.question.deleteMany({ where: { questionnaireId: assignedQuestionnaireId } });
                await prisma.questionnaire.delete({ where: { id: assignedQuestionnaireId } });
            }
            if (templateQuestionnaireId) {
                await prisma.question.deleteMany({ where: { questionnaireId: templateQuestionnaireId } });
                await prisma.questionnaire.delete({ where: { id: templateQuestionnaireId } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-18:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Client LE Admin assigns questionnaire via relationship UI and verifies persistence', async ({ browser }) => {
        const clientContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await clientContext.newPage();

        try {
            // Navigate to relationship management page
            await page.goto(`/app/le/${testClientLEId}/relationships`);
            await page.waitForLoadState('domcontentloaded');

            // Find and expand outer engagement card for supplier
            const supplierHeading = page.locator('text="UAT Supplier Org A"').first();
            await expect(supplierHeading).toBeVisible({ timeout: 15000 });
            await supplierHeading.click();

            // Locate Questionnaires section Add button
            const addQBtn = page.locator('button:has-text("Add")').first();
            await expect(addQBtn).toBeVisible({ timeout: 10000 });
            await addQBtn.click();

            // Search / select template in popover
            const templateItem = page.locator(`text="${distinctiveTemplateName}"`).last();
            await expect(templateItem).toBeVisible({ timeout: 10000 });
            await templateItem.click();

            // Wait for assignment completion
            await page.waitForTimeout(2000);

            // Verify assigned questionnaire appears in the relationship questionnaires list
            const qListEntry = page.locator(`text=${distinctiveTemplateName}`).first();
            await expect(qListEntry).toBeVisible({ timeout: 15000 });

            // Fetch created instance ID for cleanup
            const createdInstance = await prisma.questionnaire.findFirst({
                where: {
                    name: distinctiveTemplateName,
                    fiEngagementId: testEngagementId
                }
            });
            if (createdInstance) {
                assignedQuestionnaireId = createdInstance.id;
            }

            // Reload page and assert persistence
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            await page.locator('text="UAT Supplier Org A"').first().click();
            await expect(page.locator(`text=${distinctiveTemplateName}`).first()).toBeVisible({ timeout: 15000 });
        } finally {
            await clientContext.close();
        }
    });

    test('2. Supplier Relationship Admin sees assigned questionnaire and navigates to Questions Workbench', async ({ browser }) => {
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await supplierContext.newPage();

        try {
            // Navigate directly to Questions Workbench with questionnaire filter
            await page.goto(`/app/s/${testSupplierOrgId}/questions?q=${encodeURIComponent(distinctiveTemplateName)}`);
            await page.waitForLoadState('domcontentloaded');

            // Assert navigated to Questions Workbench with question visible
            const workbenchHeading = page.locator(`h3:has-text("${testPrefix}")`).first();
            await expect(workbenchHeading).toBeVisible({ timeout: 20000 });
        } finally {
            await supplierContext.close();
        }
    });
});
