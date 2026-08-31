import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Enforce UAT DB test environment guard before PrismaClient
process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();

const prisma = new PrismaClient();

test.describe('ONP-19 — Questionnaire Dropdown Scoping & Stale Selection Reset Regression Contract', () => {
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let relationshipAOrgName: string;
    let supplierBOrgName: string;
    let engagementAId: string;
    let supplierOrgB: any;
    let engagementB: any;
    let questionnaireA: any;
    let questionnaireB: any;
    let questionnaireSupplierBeta: any;
    let commonQnrC: any;

    const testPrefix = `ONP19_${Date.now()}`;
    const questionnaireAName = `${testPrefix} Questionnaire Alpha`;
    const questionnaireBName = `${testPrefix} Questionnaire Beta`;
    const questionnaireSupplierBetaName = `${testPrefix} Questionnaire Supplier Beta`;
    const commonQnrCName = `${testPrefix} Common Gamma`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        relationshipAOrgName = manifest.supplierOrgA.name;
        supplierBOrgName = `${testPrefix} Supplier Org B`;
        engagementAId = manifest.relationshipAlpha.id;

        // 1. Create Questionnaire A attached strictly to Relationship A (Supplier Org A <-> Alpha ClientLE)
        questionnaireA = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: engagementAId,
                name: questionnaireAName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [
                        {
                            text: `${testPrefix} Question Alpha 1`,
                            order: 1,
                            expectedDataType: 'TEXT',
                        }
                    ]
                }
            }
        });

        // 2. Create a disposable Supplier Organisation for Relationship B (two suppliers for same ClientLE)
        supplierOrgB = await prisma.organization.create({
            data: {
                name: supplierBOrgName,
                shortCode: `onp19b_${Date.now()}`.slice(0, 16),
                types: ['SUPPLIER'],
                status: 'ACTIVE',
            }
        });

        // 3. Create Relationship B (Engagement between Alpha ClientLE and Supplier Org B)
        engagementB = await prisma.fIEngagement.create({
            data: {
                clientLEId: clientLEId,
                fiOrgId: supplierOrgB.id,
                status: 'CONNECTED',
            }
        });

        // 4. Create Questionnaire B attached strictly to Relationship B (Supplier Org B <-> Alpha ClientLE)
        questionnaireB = await prisma.questionnaire.create({
            data: {
                fiOrgId: supplierOrgB.id,
                fiEngagementId: engagementB.id,
                name: questionnaireBName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [
                        {
                            text: `${testPrefix} Question Beta 1`,
                            order: 1,
                            expectedDataType: 'TEXT',
                        }
                    ]
                }
            }
        });

        // 5. Create Questionnaire Supplier Beta attached strictly to Supplier Org A's relationship with Beta ClientLE
        questionnaireSupplierBeta = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: manifest.relationshipBeta.id,
                name: questionnaireSupplierBetaName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [
                        {
                            text: `${testPrefix} Question Supplier Beta 1`,
                            order: 1,
                            expectedDataType: 'TEXT',
                        }
                    ]
                }
            }
        });

        // 6. Create Common Questionnaire C applicable across all relationships for Alpha ClientLE
        commonQnrC = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.systemOrg.id,
                name: commonQnrCName,
                status: 'ACTIVE',
                kind: 'COMMON_QUESTIONNAIRE',
                commonForClients: {
                    connect: { id: clientLEId }
                },
                questions: {
                    create: [
                        {
                            text: `${testPrefix} Question Common Gamma 1`,
                            order: 1,
                            expectedDataType: 'TEXT',
                        }
                    ]
                }
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (questionnaireA?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: questionnaireA.id } });
                await prisma.questionnaire.delete({ where: { id: questionnaireA.id } });
            }
            if (questionnaireB?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: questionnaireB.id } });
                await prisma.questionnaire.delete({ where: { id: questionnaireB.id } });
            }
            if (questionnaireSupplierBeta?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: questionnaireSupplierBeta.id } });
                await prisma.questionnaire.delete({ where: { id: questionnaireSupplierBeta.id } });
            }
            if (commonQnrC?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: commonQnrC.id } });
                await prisma.questionnaire.delete({ where: { id: commonQnrC.id } });
            }
            if (engagementB?.id) {
                await prisma.fIEngagement.delete({ where: { id: engagementB.id } });
            }
            if (supplierOrgB?.id) {
                await prisma.organization.delete({ where: { id: supplierOrgB.id } });
            }
        } catch (err) {
            console.warn('[ONP-19] Cleanup error:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Client RED A: Questionnaire dropdown under Relationship A excludes Questionnaire B', async ({ browser }) => {
        const clientContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.leAdminAlpha,
        });
        const page = await clientContext.newPage();

        try {
            // Step 1: Navigate to Client Workbench for Alpha ClientLE
            await page.goto(`/app/le/${clientLEId}/workbench4`);
            await page.waitForLoadState('networkidle');

            const relCombobox = page.locator('button[role="combobox"]').nth(0);
            const qCombobox = page.locator('button[role="combobox"]').nth(1);

            await expect(relCombobox).toBeVisible({ timeout: 15000 });
            await expect(qCombobox).toBeVisible({ timeout: 15000 });

            // Step 2: Select Relationship A (UAT Supplier Org A)
            await relCombobox.click();
            const relAOption = page.getByRole('option', { name: relationshipAOrgName });
            await expect(relAOption).toBeVisible();
            await relAOption.click();

            // Step 3: Open Questionnaire dropdown under Relationship A
            await qCombobox.click();

            // Questionnaire A MUST be visible
            await expect(page.getByRole('option', { name: questionnaireAName })).toBeVisible();

            // Common Questionnaire C MUST be visible
            await expect(page.getByRole('option', { name: commonQnrCName })).toBeVisible();

            // Questionnaire B (belonging only to Relationship B) MUST NOT be visible under Relationship A
            // (On unfixed dev, this assertion FAILS because questionnaireOptions is derived globally)
            await expect(page.getByRole('option', { name: questionnaireBName })).not.toBeVisible();
        } finally {
            await clientContext.close();
        }
    });

    test('2. Client RED B: Switching relationship resets stale questionnaire selection and URL parameter', async ({ browser }) => {
        const clientContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.leAdminAlpha,
        });
        const page = await clientContext.newPage();

        try {
            // Step 1: Navigate to Client Workbench for Alpha ClientLE
            await page.goto(`/app/le/${clientLEId}/workbench4`);
            await page.waitForLoadState('networkidle');

            const relCombobox = page.locator('button[role="combobox"]').nth(0);
            const qCombobox = page.locator('button[role="combobox"]').nth(1);

            await expect(relCombobox).toBeVisible({ timeout: 15000 });
            await expect(qCombobox).toBeVisible({ timeout: 15000 });

            // Step 2: Select Relationship A (UAT Supplier Org A)
            await relCombobox.click();
            await page.getByRole('option', { name: relationshipAOrgName }).click();

            // Step 3: Select Questionnaire A under Relationship A
            await qCombobox.click();
            await page.getByRole('option', { name: questionnaireAName }).click();

            // Verify URL and grid reflect Questionnaire A selection
            await expect(page).toHaveURL(/(q=|questionnaireId=)/);
            await expect(page.getByText(`${testPrefix} Question Alpha 1`)).toBeVisible();

            // Step 4: Switch relationship to Relationship B (Supplier Org B)
            await relCombobox.click();
            const relBOption = page.getByRole('option', { name: supplierBOrgName });
            await expect(relBOption).toBeVisible();
            await relBOption.click();

            // Step 5: Assert stale selection is cleared/reset from URL and combobox
            // (On unfixed dev, this assertion FAILS because questionnaire filter is preserved across relationship switch)
            await expect(page).not.toHaveURL(/(q=|questionnaireId=)/);
            await expect(qCombobox).toContainText(/All Questionnaires|Questionnaire/);

            // Step 6: Open Questionnaire dropdown under Relationship B
            await qCombobox.click();

            // Questionnaire B MUST be visible under Relationship B
            await expect(page.getByRole('option', { name: questionnaireBName })).toBeVisible();

            // Questionnaire A MUST NOT be visible under Relationship B
            await expect(page.getByRole('option', { name: questionnaireAName })).not.toBeVisible();

            // Close dropdown and verify questions from Relationship B are visible (not blank 0-question grid)
            await page.keyboard.press('Escape');
            await expect(page.getByText(`${testPrefix} Question Beta 1`)).toBeVisible();
        } finally {
            await clientContext.close();
        }
    });

    test('3. Supplier RED A: Questionnaire dropdown under Client LE A excludes Beta-only questionnaire', async ({ browser }) => {
        const supplierContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA,
        });
        const page = await supplierContext.newPage();

        try {
            // Step 1: Navigate to Supplier Questions Workbench for Supplier Org A
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);
            await page.waitForLoadState('networkidle');

            const relCombobox = page.locator('button[role="combobox"]').nth(0);
            const qCombobox = page.locator('button[role="combobox"]').nth(1);

            await expect(relCombobox).toBeVisible({ timeout: 15000 });
            await expect(qCombobox).toBeVisible({ timeout: 15000 });

            // Step 2: Select Relationship / Client LE A (UAT Alpha Limited)
            await relCombobox.click();
            const clientAOption = page.getByRole('option', { name: manifest.alphaClientLE.name });
            await expect(clientAOption).toBeVisible();
            await clientAOption.click();

            // Step 3: Open Questionnaire selector under Client LE A
            await qCombobox.click();

            // Questionnaire Alpha MUST be visible
            await expect(page.getByRole('option', { name: questionnaireAName })).toBeVisible();

            // Questionnaire Supplier Beta (belonging only to Beta Client LE) MUST NOT be visible under Client LE A
            // (On unfixed dev, this assertion FAILS because Supplier Questions Workbench renders data.questionnaires globally)
            await expect(page.getByRole('option', { name: questionnaireSupplierBetaName })).not.toBeVisible();
        } finally {
            await supplierContext.close();
        }
    });

    test('4. Supplier RED B: Switching Client LE resets stale questionnaire selection and URL parameter', async ({ browser }) => {
        const supplierContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA,
        });
        const page = await supplierContext.newPage();

        try {
            // Step 1: Navigate to Supplier Questions Workbench for Supplier Org A
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);
            await page.waitForLoadState('networkidle');

            const relCombobox = page.locator('button[role="combobox"]').nth(0);
            const qCombobox = page.locator('button[role="combobox"]').nth(1);

            await expect(relCombobox).toBeVisible({ timeout: 15000 });
            await expect(qCombobox).toBeVisible({ timeout: 15000 });

            // Step 2: Select Relationship / Client LE A (UAT Alpha Limited)
            await relCombobox.click();
            await page.getByRole('option', { name: manifest.alphaClientLE.name }).click();

            // Step 3: Select Questionnaire Alpha under Client LE A
            await qCombobox.click();
            await page.getByRole('option', { name: questionnaireAName }).click();
            await expect(page).toHaveURL(/q=/);

            // Step 4: Switch relationship to Client LE B (UAT Beta Limited)
            await relCombobox.click();
            const clientBOption = page.getByRole('option', { name: manifest.betaClientLE.name });
            await expect(clientBOption).toBeVisible();
            await clientBOption.click();

            // Step 5: Assert stale qFilter is cleared from URL and combobox
            // (On unfixed dev, this assertion FAILS because q is preserved across client switch)
            await expect(page).not.toHaveURL(/q=/);
            await expect(qCombobox).toContainText(/All Questionnaires|Questionnaire/);

            // Step 6: Open Questionnaire selector under Client LE B
            await qCombobox.click();

            // Questionnaire Supplier Beta MUST be visible under Client LE B
            await expect(page.getByRole('option', { name: questionnaireSupplierBetaName })).toBeVisible();

            // Questionnaire Alpha MUST NOT be visible under Client LE B
            await expect(page.getByRole('option', { name: questionnaireAName })).not.toBeVisible();
        } finally {
            await supplierContext.close();
        }
    });
});
