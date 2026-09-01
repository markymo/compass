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

test.describe('ONP-145 field report — Group C: Questionnaire Lifecycle & Relationships UX', () => {
    test.setTimeout(120000);
    const runId = Date.now();
    let manifest: ReturnType<typeof loadUATManifest>;
    let testQId: string;
    let testQuestionId: string;

    const testQName = `FR12 Test Questionnaire ${runId}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        const q = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: manifest.relationshipAlpha.id,
                name: testQName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{
                        text: `FR12 Question ${runId}`,
                        order: 1,
                        expectedDataType: 'TEXT',
                        status: 'DRAFT',
                        masterFieldNo: 3,
                        answer: 'Draft answer text'
                    }]
                }
            },
            include: { questions: true }
        });
        testQId = q.id;
        testQuestionId = q.questions[0].id;
    });

    test.afterAll(async () => {
        try {
            if (testQuestionId) {
                await prisma.question.deleteMany({ where: { id: testQuestionId } });
            }
            if (testQId) {
                await prisma.questionnaire.deleteMany({ where: { id: testQId } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-145 FR-12 — Release and Mapping Approval are separate sequential lifecycle actions in Workbench', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/workbench4?q=${encodeURIComponent(testQName)}`);
            await expect(page.getByText(`FR12 Question ${runId}`)).toBeVisible({ timeout: 20000 });

            // Step 1: In DRAFT status, "Approve Mapped Response" is visible
            const approveBtn = page.getByRole('button', { name: /Approve Mapped Response/i });
            await expect(approveBtn).toBeVisible({ timeout: 10000 });
            await approveBtn.click();

            // Step 2: After approval, status becomes APPROVED, revealing Share and Release buttons
            const releaseBtn = page.getByRole('button', { name: /Release/i });
            await expect(releaseBtn).toBeVisible({ timeout: 10000 });

            // Step 3: Click Release -> status becomes RELEASED and locks
            await releaseBtn.click();
            await expect(page.getByText('Question Released')).toBeVisible({ timeout: 10000 });
            await expect(page.getByText(/Locked/i)).toBeVisible({ timeout: 10000 });

            await attachScreenshot(page, testInfo, 'FR-12');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-13 — Client LE Relationships page visual presentation and layout review', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);
            await expect(page.getByRole('heading', { name: manifest.alphaClientLE.name })).toBeVisible({ timeout: 20000 });

            // Capture full-page screenshot of Relationships surface
            await attachScreenshot(page, testInfo, 'FR-13');
        } finally {
            await context.close();
        }
    });
});
