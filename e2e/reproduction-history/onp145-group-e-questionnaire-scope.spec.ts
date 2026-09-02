import { test, expect, Page, TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();
const prisma = new PrismaClient();

async function attachScreenshot(page: Page, testInfo: TestInfo, fr: string) {
    const image = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${fr}-current-ui.png`, { body: image, contentType: 'image/png' });
}

test.describe('ONP-145 field report — Group E: Questionnaire & Workbench Scoping Reproduction Evidence', () => {
    test.setTimeout(120000);
    const runId = Date.now();
    let manifest: ReturnType<typeof loadUATManifest>;
    let commonQId: string;
    let otherOrgEngagementId: string;
    let otherOrgQId: string;

    const commonQName = `FR21 Common Q ${runId}`;
    const otherQName = `FR22 Other Relationship Q ${runId}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        // 1. Common Questionnaire attached to Alpha ClientLE
        const cq = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.systemOrg.id,
                name: commonQName,
                status: 'ACTIVE',
                kind: 'COMMON_QUESTIONNAIRE',
                commonForClients: { connect: { id: manifest.alphaClientLE.id } },
                questions: {
                    create: [{
                        text: `FR21 Common Question ${runId}`,
                        order: 1,
                        expectedDataType: 'TEXT',
                        masterFieldNo: 3, // Legal Name (Master-mapped)
                    }]
                }
            }
        });
        commonQId = cq.id;

        // 2. Engagement with a different supplier org on Alpha ClientLE
        const otherEngagement = await prisma.fIEngagement.create({
            data: {
                clientLEId: manifest.alphaClientLE.id,
                fiOrgId: manifest.systemOrg.id, // different org
                status: 'CONNECTED',
                isDeleted: false,
            }
        });
        otherOrgEngagementId = otherEngagement.id;

        const otherQ = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.systemOrg.id,
                fiEngagementId: otherEngagement.id,
                name: otherQName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{
                        text: `FR22 Unrelated Question ${runId}`,
                        order: 1,
                        expectedDataType: 'TEXT',
                        masterFieldNo: 3,
                    }]
                }
            }
        });
        otherOrgQId = otherQ.id;
    });

    test.afterAll(async () => {
        try {
            const qIds = [commonQId, otherOrgQId].filter(Boolean);
            await prisma.question.deleteMany({ where: { questionnaireId: { in: qIds } } });
            await prisma.questionnaire.deleteMany({ where: { id: { in: qIds } } });
            if (otherOrgEngagementId) {
                await prisma.fIEngagement.deleteMany({ where: { id: otherOrgEngagementId } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-145 FR-21 — Relationship-only user on Common-only setup sees no navigable relationship route on Home', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto('/app');
            await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible({ timeout: 20000 });

            // On Home, Common Questionnaires for Alpha are not rendered as navigable items for a relationship user
            await attachScreenshot(page, testInfo, 'FR-21');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-22 (Part 1) — Relationship user can access Client Workbench4 and observe questionnaires from other relationships', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();
        try {
            // As relationshipAdminAlpha, directly navigate to Client Workbench4 (/app/le/${alphaClientLE.id}/workbench4)
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/workbench4`);
            await expect(page.getByPlaceholder('Search questions...')).toBeVisible({ timeout: 20000 });
            await expect(page.getByRole('link', { name: 'Question Bank' })).toBeVisible();

            // Filter or check for other relationship's questionnaire
            await page.getByPlaceholder('Search questions...').fill(`FR22 Unrelated Question ${runId}`);
            await expect(page.getByText(`FR22 Unrelated Question ${runId}`)).toBeVisible({ timeout: 20000 });
            await attachScreenshot(page, testInfo, 'FR-22-isolation');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-22 (Part 2) — Master-backed questions in Client Workbench4 expose direct question editing / mapping controls', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/workbench4`);
            await expect(page.getByPlaceholder('Search questions...')).toBeVisible({ timeout: 20000 });

            // Filter for our master-backed question
            await page.getByPlaceholder('Search questions...').fill(`FR22 Unrelated Question ${runId}`);
            await expect(page.getByText(`FR22 Unrelated Question ${runId}`)).toBeVisible({ timeout: 20000 });

            // In Workbench4, the question exposes mapping combobox and "Edit value" button
            const questionContainer = page.locator('div').filter({ hasText: `FR22 Unrelated Question ${runId}` }).first();
            await expect(questionContainer).toBeVisible();
            await expect(questionContainer.getByRole('button', { name: /Edit value|✏️/i })).toBeVisible();

            await attachScreenshot(page, testInfo, 'FR-22-master-edit');
        } finally {
            await context.close();
        }
    });
});
