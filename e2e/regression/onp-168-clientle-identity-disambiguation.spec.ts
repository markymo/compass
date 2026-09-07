import { test, expect, Page, TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();

const prisma = new PrismaClient();

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
    const image = await page.screenshot();
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

test.describe('ONP-168 / ONP-145 FR-02 + FR-09 — ClientLE Identity & Owning Client Organisation Disambiguation', () => {
    test.setTimeout(180000);
    const runId = Date.now();
    let manifest: ReturnType<typeof loadUATManifest>;

    const duplicateLEName = `ONP168 Shared Name Corp ${runId}`;
    let clientLE1Id: string;
    let clientLE2Id: string;
    let eng1Id: string;
    let eng2Id: string;
    let q1Id: string;
    let q2Id: string;
    let question1Id: string;
    let question2Id: string;

    const question1Text = `ONP168 Secret Question for Client Org A ${runId}`;
    const question2Text = `ONP168 Secret Question for Client Org B ${runId}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        // 1. Create duplicate ClientLE 1 owned by Client Org A
        const le1 = await prisma.clientLE.create({
            data: {
                name: duplicateLEName,
                status: 'ACTIVE',
                isDeleted: false,
                owners: {
                    create: [{
                        partyId: manifest.clientOrgA.id,
                        startAt: new Date(),
                    }]
                },
                memberships: {
                    create: [{
                        userId: (await prisma.user.findUniqueOrThrow({ where: { email: manifest.actors.leUserAlpha.email } })).id,
                        role: 'LE_ADMIN',
                    }]
                }
            }
        });
        clientLE1Id = le1.id;

        // 2. Create duplicate ClientLE 2 owned by Client Org B
        const le2 = await prisma.clientLE.create({
            data: {
                name: duplicateLEName,
                status: 'ACTIVE',
                isDeleted: false,
                owners: {
                    create: [{
                        partyId: manifest.clientOrgB.id,
                        startAt: new Date(),
                    }]
                },
                memberships: {
                    create: [{
                        userId: (await prisma.user.findUniqueOrThrow({ where: { email: manifest.actors.leUserBeta.email } })).id,
                        role: 'LE_ADMIN',
                    }]
                }
            }
        });
        clientLE2Id = le2.id;

        // 3. Create Engagement 1 for Supplier Org A <-> ClientLE 1
        const eng1 = await prisma.fIEngagement.create({
            data: {
                clientLEId: clientLE1Id,
                fiOrgId: manifest.supplierOrgA.id,
                status: 'CONNECTED',
                isDeleted: false,
            }
        });
        eng1Id = eng1.id;

        const q1 = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: eng1Id,
                name: `ONP168 Q Org A ${runId}`,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{
                        text: question1Text,
                        order: 1,
                        expectedDataType: 'TEXT',
                    }]
                }
            },
            include: { questions: true }
        });
        q1Id = q1.id;
        question1Id = q1.questions[0].id;

        // 4. Create Engagement 2 for Supplier Org A <-> ClientLE 2
        const eng2 = await prisma.fIEngagement.create({
            data: {
                clientLEId: clientLE2Id,
                fiOrgId: manifest.supplierOrgA.id,
                status: 'CONNECTED',
                isDeleted: false,
            }
        });
        eng2Id = eng2.id;

        const q2 = await prisma.questionnaire.create({
            data: {
                fiOrgId: manifest.supplierOrgA.id,
                fiEngagementId: eng2Id,
                name: `ONP168 Q Org B ${runId}`,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                questions: {
                    create: [{
                        text: question2Text,
                        order: 1,
                        expectedDataType: 'TEXT',
                    }]
                }
            },
            include: { questions: true }
        });
        q2Id = q2.id;
        question2Id = q2.questions[0].id;

        // 5. Grant operational Relationship Admin memberships for the test user
        const relAdminUser = await prisma.user.findFirst({
            where: { email: manifest.actors.relationshipAdminAlpha.email }
        });
        if (relAdminUser) {
            await prisma.membership.createMany({
                data: [
                    { userId: relAdminUser.id, fiEngagementId: eng1Id, role: 'RELATIONSHIP_ADMIN' },
                    { userId: relAdminUser.id, fiEngagementId: eng2Id, role: 'RELATIONSHIP_ADMIN' },
                ]
            });
        }
    });

    test.afterAll(async () => {
        try {
            if (question1Id || question2Id) {
                await prisma.question.deleteMany({ where: { id: { in: [question1Id, question2Id].filter(Boolean) } } });
            }
            if (q1Id || q2Id) {
                await prisma.questionnaire.deleteMany({ where: { id: { in: [q1Id, q2Id].filter(Boolean) } } });
            }
            if (eng1Id || eng2Id) {
                await prisma.membership.deleteMany({ where: { fiEngagementId: { in: [eng1Id, eng2Id].filter(Boolean) } } });
                await prisma.fIEngagement.deleteMany({ where: { id: { in: [eng1Id, eng2Id].filter(Boolean) } } });
            }
            if (clientLE1Id || clientLE2Id) {
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId: { in: [clientLE1Id, clientLE2Id].filter(Boolean) } } });
                await prisma.membership.deleteMany({ where: { clientLEId: { in: [clientLE1Id, clientLE2Id].filter(Boolean) } } });
                await prisma.clientLE.deleteMany({ where: { id: { in: [clientLE1Id, clientLE2Id].filter(Boolean) } } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-168 / FR-02 — /app/admin/users explicitly identifies owning Client Organisation for ClientLE memberships', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.systemAdmin.email, password);
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });

            // Locate the user row for leUserAlpha
            const userRowA = page.locator('tr').filter({ hasText: manifest.actors.leUserAlpha.email });
            await expect(userRowA).toBeVisible({ timeout: 10000 });

            // Must display the ClientLE name with its owning Client Organisation name (Client Org A)
            await expect(userRowA.getByText(`${duplicateLEName} (${manifest.clientOrgA.name})`)).toBeVisible();

            // Locate the user row for leUserBeta
            const userRowB = page.locator('tr').filter({ hasText: manifest.actors.leUserBeta.email });
            await expect(userRowB).toBeVisible({ timeout: 10000 });

            // Must display the ClientLE name with its owning Client Organisation name (Client Org B)
            await expect(userRowB.getByText(`${duplicateLEName} (${manifest.clientOrgB.name})`)).toBeVisible();

            await attachScreenshot(page, testInfo, 'ONP-168-FR02-admin-users');
        } finally {
            await context.close();
        }
    });

    test('ONP-168 / FR-09 — Supplier Q&A relationship selector disambiguates same-name ClientLE dossiers by owning Client Org', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.relationshipAdminAlpha.email, password);
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);

            // Open Relationship selector combobox
            const relSelector = page.locator('button[role="combobox"]').nth(0);
            await relSelector.click();

            // Two distinct options must exist for the same Legal Entity name, each identifying its owning Client Org
            const optionA = page.getByRole('option', { name: new RegExp(`${duplicateLEName}.*${manifest.clientOrgA.name}|${manifest.clientOrgA.name}.*${duplicateLEName}`, 'i') });
            const optionB = page.getByRole('option', { name: new RegExp(`${duplicateLEName}.*${manifest.clientOrgB.name}|${manifest.clientOrgB.name}.*${duplicateLEName}`, 'i') });

            await expect(optionA).toBeVisible({ timeout: 10000 });
            await expect(optionB).toBeVisible({ timeout: 10000 });

            // Select Option A (Client Org A's dossier)
            await optionA.click();

            // Must display Question A from Org A, and NEVER Question B from Org B
            await expect(page.getByText(question1Text)).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(question2Text)).toHaveCount(0);

            // Now switch to Option B (Client Org B's dossier)
            await relSelector.click();
            await optionB.click();

            // Must display Question B from Org B, and NEVER Question A from Org A
            await expect(page.getByText(question2Text)).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(question1Text)).toHaveCount(0);

            await attachScreenshot(page, testInfo, 'ONP-168-FR09-supplier-questions');
        } finally {
            await context.close();
        }
    });

    test('ONP-168 — Positive/Non-regression: Standard unique ClientLE renders with owning Client Org context', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.systemAdmin.email, password);
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });

            // Locate leAdminAlpha who is member of alphaClientLE
            const userRow = page.locator('tr').filter({ hasText: manifest.actors.leAdminAlpha.email });
            await expect(userRow).toBeVisible({ timeout: 10000 });

            // Should render alphaClientLE name and clientOrgA name
            await expect(userRow.getByText(`${manifest.alphaClientLE.name} (${manifest.clientOrgA.name})`)).toBeVisible();
            await attachScreenshot(page, testInfo, 'ONP-168-unique-clientle-admin');
        } finally {
            await context.close();
        }
    });
});
