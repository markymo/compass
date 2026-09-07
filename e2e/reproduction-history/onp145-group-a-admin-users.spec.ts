import { test, expect, Page, TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();
const prisma = new PrismaClient();

async function attachScreenshot(page: Page, testInfo: TestInfo, fr: string) {
    const image = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${fr}-current-ui.png`, { body: image, contentType: 'image/png' });
}

test.describe('ONP-145 field report — Group A: Admin & Users Reproduction Evidence', () => {
    test.setTimeout(120000);
    const runId = Date.now();

    let manifest: ReturnType<typeof loadUATManifest>;
    let leOnlyUserId: string;
    let softDeletedLEId: string;
    let softDeletedLEOwnerId: string;
    let staleLEUserId: string;

    const leOnlyUserEmail = `uat+onp145-leonly-${runId}@onpro.tech`;
    const staleLEUserEmail = `uat+onp145-stale-${runId}@onpro.tech`;
    const softDeletedLEName = `FR05 Deleted LE ${runId}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const hash = await bcrypt.hash(`Onp145-${runId}!`, 10);

        // 1. Create LE-only user for FR-03
        const leOnlyUser = await prisma.user.create({
            data: {
                email: leOnlyUserEmail,
                name: 'ONP-145 LE Only User',
                password: hash,
                emailVerified: new Date(),
                isDemoActor: false,
            }
        });
        leOnlyUserId = leOnlyUser.id;

        await prisma.membership.create({
            data: {
                userId: leOnlyUserId,
                clientLEId: manifest.alphaClientLE.id,
                role: 'LE_USER',
            }
        });

        // 2. Create soft-deleted LE and user for FR-05
        const staleLE = await prisma.clientLE.create({
            data: {
                name: softDeletedLEName,
                shortCode: `fr05_${String(runId).slice(-10)}`,
                status: 'ACTIVE',
                isDeleted: true, // Soft-deleted
            }
        });
        softDeletedLEId = staleLE.id;

        const owner = await prisma.clientLEOwner.create({
            data: {
                clientLEId: softDeletedLEId,
                partyId: manifest.clientOrgA.id,
                startAt: new Date(),
            }
        });
        softDeletedLEOwnerId = owner.id;

        const staleUser = await prisma.user.create({
            data: {
                email: staleLEUserEmail,
                name: 'ONP-145 Stale LE User',
                password: hash,
                emailVerified: new Date(),
                isDemoActor: false,
            }
        });
        staleLEUserId = staleUser.id;

        await prisma.membership.create({
            data: {
                userId: staleLEUserId,
                clientLEId: softDeletedLEId,
                role: 'LE_ADMIN',
            }
        });
    });

    test.afterAll(async () => {
        try {
            await prisma.membership.deleteMany({
                where: { userId: { in: [leOnlyUserId, staleLEUserId].filter(Boolean) } }
            });
            await prisma.user.deleteMany({
                where: { id: { in: [leOnlyUserId, staleLEUserId].filter(Boolean) } }
            });
            if (softDeletedLEOwnerId) {
                await prisma.clientLEOwner.deleteMany({ where: { id: softDeletedLEOwnerId } });
            }
            if (softDeletedLEId) {
                await prisma.clientLE.deleteMany({ where: { id: softDeletedLEId } });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-145 FR-01 — "System" vs "OnPro System" terminology observable on admin surfaces', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();
        try {
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });
            
            // Look for SYSTEM badge and organization labels
            const systemBadges = page.locator('span:text-is("SYSTEM")');
            await expect(systemBadges.first()).toBeVisible();
            await attachScreenshot(page, testInfo, 'FR-01');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-02 — /admin/users does not identify the Client Organisation owning each ClientLE', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();
        try {
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });

            // Locate the user row for leAdminAlpha
            const userRow = page.locator('tr').filter({ hasText: manifest.actors.leAdminAlpha.email });
            await expect(userRow).toBeVisible();

            // The row displays WORKSPACE and Alpha ClientLE name, but NOT the owning Client Organization name (e.g. UAT Client Org A)
            await expect(userRow.getByText('WORKSPACE').first()).toBeVisible();
            await expect(userRow.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
            
            // Confirm absence of owning client organization name in the LE membership line
            const leMembershipLine = userRow.locator('div').filter({ hasText: 'WORKSPACE' }).first();
            await expect(leMembershipLine.getByText(manifest.clientOrgA.name)).toHaveCount(0);

            await attachScreenshot(page, testInfo, 'FR-02');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-03 — LE-only memberships cannot be managed from /admin/users (disappear from permissions tree)', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();
        try {
            await page.goto(`/app/admin/users/${leOnlyUserId}`);
            await expect(page.getByRole('heading', { name: 'User Access Management' })).toBeVisible({ timeout: 20000 });

            // Since user has no organizationId membership, UI reports "This user is not a member of any Client Organizations."
            await expect(page.getByText('This user is not a member of any Client Organizations.')).toBeVisible();

            // The valid ClientLE membership (Alpha ClientLE) is completely absent from the permission cards
            await expect(page.getByText(manifest.alphaClientLE.name)).toHaveCount(0);

            await attachScreenshot(page, testInfo, 'FR-03');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-04 — Admin Reset Password performs synchronous password change without email transport', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();
        try {
            await page.goto(`/app/admin/users/${leOnlyUserId}`);
            await expect(page.getByRole('heading', { name: 'User Access Management' })).toBeVisible({ timeout: 20000 });

            await page.getByRole('button', { name: 'Reset Password' }).click();
            await expect(page.getByRole('heading', { name: 'Reset User Password' })).toBeVisible();

            const newPass = `NewPass-${runId}!`;
            await page.locator('#new-password').fill(newPass);
            await page.getByRole('dialog').getByRole('button', { name: 'Reset Password' }).click();

            await expect(page.getByText('Password reset successfully')).toBeVisible({ timeout: 10000 });
            await attachScreenshot(page, testInfo, 'FR-04');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-05 — /admin/users still shows deleted ClientLE membership as active access', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();
        try {
            await page.goto('/app/admin/users');
            await expect(page.getByRole('heading', { name: 'System Administrator User Management' })).toBeVisible({ timeout: 20000 });

            const userRow = page.locator('tr').filter({ hasText: staleLEUserEmail });
            await expect(userRow).toBeVisible();

            // The soft-deleted ClientLE still appears as an active WORKSPACE role
            await expect(userRow.getByText('WORKSPACE')).toBeVisible();
            await expect(userRow.getByText(softDeletedLEName)).toBeVisible();
            await expect(userRow.getByText('(LE_ADMIN)')).toBeVisible();

            await attachScreenshot(page, testInfo, 'FR-05');
        } finally {
            await context.close();
        }
    });
});
