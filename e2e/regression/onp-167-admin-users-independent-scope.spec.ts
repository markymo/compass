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

test.describe('ONP-167 / ONP-145 FR-03 + FR-05 — Admin Users: Independent Org & ClientLE Scopes', () => {
    test.setTimeout(180000);
    const runId = Date.now();
    let manifest: ReturnType<typeof loadUATManifest>;

    let leOnlyUserId: string;
    const leOnlyEmail = `uat+onp167-le-only-${runId}@onpro.tech`;

    let deletedLeUserId: string;
    const deletedLeUserEmail = `uat+onp167-del-le-${runId}@onpro.tech`;

    let activeLEId: string;
    const activeLEName = `ONP167 Active LE ${runId}`;

    let deletedLEId: string;
    const deletedLEName = `ONP167 Deleted LE ${runId}`;

    let standaloneLEId: string;
    const standaloneLEName = `ONP167 Standalone LE ${runId}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();

        // 1. Create Standalone ClientLE owned by Client Org A
        const standaloneLE = await prisma.clientLE.create({
            data: {
                name: standaloneLEName,
                status: 'ACTIVE',
                isDeleted: false,
                owners: {
                    create: [{
                        partyId: manifest.clientOrgA.id,
                        startAt: new Date(),
                    }]
                }
            }
        });
        standaloneLEId = standaloneLE.id;

        // 2. Create LE-only User (no organizationId membership, only clientLEId membership)
        const leOnlyUser = await prisma.user.create({
            data: {
                email: leOnlyEmail,
                name: `ONP167 LE Only User ${runId}`,
                memberships: {
                    create: [{
                        clientLEId: standaloneLEId,
                        role: 'LE_ADMIN',
                    }]
                }
            }
        });
        leOnlyUserId = leOnlyUser.id;

        // 3. Create Active LE and Soft-Deleted LE owned by Client Org B
        const activeLE = await prisma.clientLE.create({
            data: {
                name: activeLEName,
                status: 'ACTIVE',
                isDeleted: false,
                owners: {
                    create: [{
                        partyId: manifest.clientOrgB.id,
                        startAt: new Date(),
                    }]
                }
            }
        });
        activeLEId = activeLE.id;

        const deletedLE = await prisma.clientLE.create({
            data: {
                name: deletedLEName,
                status: 'ARCHIVED',
                isDeleted: true,
                owners: {
                    create: [{
                        partyId: manifest.clientOrgB.id,
                        startAt: new Date(),
                    }]
                }
            }
        });
        deletedLEId = deletedLE.id;

        // 4. Create User with memberships in both Active LE and Deleted LE
        const delLeUser = await prisma.user.create({
            data: {
                email: deletedLeUserEmail,
                name: `ONP167 Deleted LE User ${runId}`,
                memberships: {
                    create: [
                        {
                            clientLEId: activeLEId,
                            role: 'LE_ADMIN',
                        },
                        {
                            clientLEId: deletedLEId,
                            role: 'LE_USER',
                        }
                    ]
                }
            }
        });
        deletedLeUserId = delLeUser.id;
    });

    test.afterAll(async () => {
        try {
            if (leOnlyUserId) {
                await prisma.membership.deleteMany({ where: { userId: leOnlyUserId } });
                await prisma.user.deleteMany({ where: { id: leOnlyUserId } });
            }
            if (deletedLeUserId) {
                await prisma.membership.deleteMany({ where: { userId: deletedLeUserId } });
                await prisma.user.deleteMany({ where: { id: deletedLeUserId } });
            }
            if (standaloneLEId) {
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId: standaloneLEId } });
                await prisma.membership.deleteMany({ where: { clientLEId: standaloneLEId } });
                await prisma.clientLE.deleteMany({ where: { id: standaloneLEId } });
            }
            if (activeLEId) {
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId: activeLEId } });
                await prisma.membership.deleteMany({ where: { clientLEId: activeLEId } });
                await prisma.clientLE.deleteMany({ where: { id: activeLEId } });
            }
            if (deletedLEId) {
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId: deletedLEId } });
                await prisma.membership.deleteMany({ where: { clientLEId: deletedLEId } });
                await prisma.clientLE.deleteMany({ where: { id: deletedLEId } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-167 / FR-03 — Standalone LE-only membership is visible in /app/admin/users and manageable in /app/admin/users/[id]', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.systemAdmin.email, password);

            // 1. Check /app/admin/users list view
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });

            const userRow = page.locator('tr').filter({ hasText: leOnlyEmail });
            await expect(userRow).toBeVisible({ timeout: 10000 });

            // Must display WORKSPACE membership with LE name and owning Client Org
            await expect(userRow.getByText('WORKSPACE')).toBeVisible();
            await expect(userRow.getByText(`${standaloneLEName} (${manifest.clientOrgA.name})`)).toBeVisible();
            await expect(userRow.getByText('(LE_ADMIN)')).toBeVisible();

            // Must NOT claim the user has a CLIENT org membership
            await expect(userRow.getByText('CLIENT', { exact: true })).toHaveCount(0);

            // 2. Navigate to user detail: /app/admin/users/[id]
            await page.goto(`/app/admin/users/${leOnlyUserId}`);
            await expect(page.getByRole('heading', { name: 'User Access Management' })).toBeVisible({ timeout: 20000 });

            // Must render the Client Org A card
            const orgCard = page.locator('.space-y-4').filter({ hasText: manifest.clientOrgA.name });
            await expect(orgCard).toBeVisible({ timeout: 10000 });

            // Org Role must clearly indicate "None"
            await expect(orgCard.getByText('None', { exact: true })).toBeVisible();

            // ClientLE workspace must be visible with LE Admin access level
            await expect(orgCard.getByText(standaloneLEName)).toBeVisible();
            await expect(orgCard.getByText('LE Admin')).toBeVisible();

            await attachScreenshot(page, testInfo, 'ONP-167-FR03-standalone-le');
        } finally {
            await context.close();
        }
    });

    test('ONP-167 — Scope Independence: Modifying Org membership preserves independent ClientLE membership', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.systemAdmin.email, password);
            await page.goto(`/app/admin/users/${leOnlyUserId}`);
            await expect(page.getByRole('heading', { name: 'User Access Management' })).toBeVisible({ timeout: 20000 });

            const orgCard = page.locator('.space-y-4').filter({ hasText: manifest.clientOrgA.name });
            await expect(orgCard).toBeVisible({ timeout: 10000 });

            // 1. Promote Org Role to Member (Standard)
            const orgRoleTrigger = orgCard.locator('button[role="combobox"]').first();
            await orgRoleTrigger.click();
            await page.getByRole('option', { name: 'Member (Standard)' }).click();
            await expect(page.getByText('Organization Role Updated')).toBeVisible({ timeout: 10000 });

            // Verify ClientLE membership remains LE_ADMIN in DB
            const leMembershipAfterPromote = await prisma.membership.findFirst({
                where: { userId: leOnlyUserId, clientLEId: standaloneLEId }
            });
            expect(leMembershipAfterPromote?.role).toBe('LE_ADMIN');

            // 2. Demote Org Role back to None
            await page.goto(`/app/admin/users/${leOnlyUserId}`);
            const orgRoleTrigger2 = page.locator('.space-y-4').filter({ hasText: manifest.clientOrgA.name }).locator('button[role="combobox"]').first();
            await orgRoleTrigger2.click();
            await page.getByRole('option', { name: 'None' }).click();
            await expect(page.getByText('Organization Role Updated')).toBeVisible({ timeout: 10000 });

            // Verify ClientLE membership STILL remains LE_ADMIN in DB and is not silently deleted
            const leMembershipAfterDemote = await prisma.membership.findFirst({
                where: { userId: leOnlyUserId, clientLEId: standaloneLEId }
            });
            expect(leMembershipAfterDemote?.role).toBe('LE_ADMIN');

            await attachScreenshot(page, testInfo, 'ONP-167-scope-independence');
        } finally {
            await context.close();
        }
    });

    test('ONP-167 / FR-05 — Soft-deleted ClientLE membership does not masquerade as active access while DB record is preserved', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, manifest.actors.systemAdmin.email, password);

            // 1. Check /app/admin/users list view
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });

            const userRow = page.locator('tr').filter({ hasText: deletedLeUserEmail });
            await expect(userRow).toBeVisible({ timeout: 10000 });

            // Active LE membership MUST be displayed
            await expect(userRow.getByText(activeLEName)).toBeVisible();

            // Soft-deleted LE MUST NOT be displayed as active access
            await expect(userRow.getByText(deletedLEName)).toHaveCount(0);

            // 2. Verify underlying historical membership in database is strictly preserved (not deleted)
            const dbDeletedMembership = await prisma.membership.findFirst({
                where: { userId: deletedLeUserId, clientLEId: deletedLEId }
            });
            expect(dbDeletedMembership).not.toBeNull();
            expect(dbDeletedMembership?.role).toBe('LE_USER');

            await attachScreenshot(page, testInfo, 'ONP-167-FR05-deleted-le-handling');
        } finally {
            await context.close();
        }
    });
});
