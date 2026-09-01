import { test, expect, Page, TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();
const prisma = new PrismaClient();

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
    const image = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${name}-screenshot.png`, { body: image, contentType: 'image/png' });
}

const password = process.env.UAT_PASSWORD || 'Password123!';

async function login(page: Page, email: string, pass: string) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(pass);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 });
}

test.describe('ONP-174 / ONP-145 FR-22A — Question Bank Relationship Isolation Security Boundary', () => {
    test.setTimeout(120000);
    const runId = Date.now();
    let manifest: ReturnType<typeof loadUATManifest>;
    let foreignEngagementId: string;
    let foreignQuestionnaireId: string;
    let foreignQuestionId: string;

    const foreignQName = `ONP174 Foreign Relationship Q ${runId}`;
    const foreignQuestionText = `ONP174 Secret Question from Foreign Relationship ${runId}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        // 1. Create a foreign engagement on Alpha ClientLE with a different supplier org
        const foreignEng = await prisma.fIEngagement.create({
            data: {
                clientLEId: manifest.alphaClientLE.id,
                fiOrgId: manifest.systemOrg.id, // Foreign supplier org
                status: 'CONNECTED',
                isDeleted: false,
            }
        });
        foreignEngagementId = foreignEng.id;

        // 2. Create a confidential questionnaire in the foreign engagement
        const foreignQ = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.systemOrg.id,
                fiEngagementId: foreignEng.id,
                name: foreignQName,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{
                        text: foreignQuestionText,
                        order: 1,
                        expectedDataType: 'TEXT',
                        masterFieldNo: 3,
                    }]
                }
            },
            include: { questions: true }
        });
        foreignQuestionnaireId = foreignQ.id;
        foreignQuestionId = foreignQ.questions[0].id;
    });

    test.afterAll(async () => {
        try {
            if (foreignQuestionId) {
                await prisma.question.deleteMany({ where: { id: foreignQuestionId } });
            }
            if (foreignQuestionnaireId) {
                await prisma.questionnaire.deleteMany({ where: { id: foreignQuestionnaireId } });
            }
            if (foreignEngagementId) {
                await prisma.fIEngagement.deleteMany({ where: { id: foreignEngagementId } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-174 FR-22A — Supplier relationship-only user is denied access to Client Question Bank (/app/le/[id]/workbench4)', async ({ browser }, testInfo) => {
        // relationshipAdminAlpha only holds RELATIONSHIP_ADMIN on manifest.relationshipAlpha
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.relationshipAdminAlpha.email, password);
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/workbench4`);
            await attachScreenshot(page, testInfo, 'FR-22A-direct-access');

            // Security requirement: Direct access to Client LE Question Bank must return 404 Not Found for relationship users
            await expect(page.getByText(/404|This page could not be found/i).first()).toBeVisible({ timeout: 10000 });

            // Foreign relationship questionnaire content must never be visible
            await expect(page.getByText(foreignQName)).toHaveCount(0);
            await expect(page.getByText(foreignQuestionText)).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test('ONP-174 FR-22A — Home metric drilldowns for Supplier nodes never direct to Client Question Bank (/app/le/...)', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.relationshipAdminAlpha.email, password);
            await page.goto('/app');
            await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible({ timeout: 20000 });

            // Find all anchor links on the dashboard
            const leHrefs = await page.locator('a[href*="/workbench4"]').evaluateAll(nodes =>
                nodes.map(n => (n as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[]
            );

            // A Supplier persona must not receive any links pointing to /app/le/.../workbench4
            expect(leHrefs.filter(h => h.includes('/app/le/'))).toEqual([]);
            await attachScreenshot(page, testInfo, 'FR-22A-dashboard-links');
        } finally {
            await context.close();
        }
    });

    test('ONP-174 FR-22A — Authorized Client LE Admin preserves full access to Client Question Bank', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.leAdminAlpha.email, password);
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/workbench4`);
            await expect(page.getByPlaceholder('Search questions...')).toBeVisible({ timeout: 20000 });
            await expect(page.getByRole('link', { name: 'Question Bank' })).toBeVisible();
            await attachScreenshot(page, testInfo, 'FR-22A-client-access');
        } finally {
            await context.close();
        }
    });
});
