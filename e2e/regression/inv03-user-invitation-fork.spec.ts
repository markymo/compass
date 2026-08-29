import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

test.describe('INV-03 / ONP-79 — User Invitation & Auto-Add Fork Baseline', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
    test.setTimeout(120000);

    let clientOrgId: string;
    let existingUserEmail: string;
    let existingUserId: string;
    const unregisteredEmail = `uat-unreg-${Date.now()}@example.com`;

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        clientOrgId = manifest.clientOrgA.id;
        existingUserEmail = manifest.actors.supplierOrgAdminA.email; // Valid registered user not in Client Org A

        const user = await prisma.user.findUnique({ where: { email: existingUserEmail } });
        if (!user) throw new Error(`Existing user ${existingUserEmail} not found`);
        existingUserId = user.id;

        // Clean up any pre-existing test state in Client Org A
        await prisma.membership.deleteMany({
            where: {
                userId: existingUserId,
                organizationId: clientOrgId,
            }
        });
        await prisma.invitation.deleteMany({
            where: {
                sentToEmail: { in: [existingUserEmail, unregisteredEmail] },
                organizationId: clientOrgId,
            }
        });
    });

    test.afterAll(async () => {
        // Cleanup after all tests
        await prisma.membership.deleteMany({
            where: {
                userId: existingUserId,
                organizationId: clientOrgId,
            }
        });
        await prisma.invitation.deleteMany({
            where: {
                sentToEmail: { in: [existingUserEmail, unregisteredEmail] },
                organizationId: clientOrgId,
            }
        });
        await prisma.$disconnect();
    });

    test('1. Scenario A: Existing registered user is immediately granted Active Membership without Invitation token', async ({ page }) => {
        await page.goto(`/app/admin/organizations/${clientOrgId}`);
        await expect(page.getByRole('heading', { name: 'UAT Client Org A' })).toBeVisible({ timeout: 15000 });

        // Switch to Members tab
        const membersTab = page.getByRole('button', { name: 'Members' });
        await expect(membersTab).toBeVisible();
        await membersTab.click();

        // Add the existing user
        const emailInput = page.getByPlaceholder('user@example.com');
        await emailInput.fill(existingUserEmail);

        const addBtn = page.getByRole('button', { name: 'Add Member' });
        await addBtn.click();

        // Assert success toast
        await expect(page.getByText(`Invited ${existingUserEmail} as ORG_MEMBER`)).toBeVisible({ timeout: 10000 });

        // Assert user appears in Active Members list
        await expect(page.getByText(existingUserEmail, { exact: true })).toBeVisible();
        const activeRow = page.locator('tr').filter({ hasText: existingUserEmail });
        await expect(activeRow.getByText('Active')).toBeVisible();

        // Assert database state: Membership created, no Invitation created
        const dbMembership = await prisma.membership.findFirst({
            where: {
                userId: existingUserId,
                organizationId: clientOrgId,
            }
        });
        expect(dbMembership).not.toBeNull();
        expect(dbMembership?.role).toBe('ORG_MEMBER');

        const dbInvitation = await prisma.invitation.findFirst({
            where: {
                sentToEmail: existingUserEmail,
                organizationId: clientOrgId,
            }
        });
        expect(dbInvitation).toBeNull();
    });

    test('2. Scenario B: Unknown / unregistered email creates Pending Invitation with token and NO Membership', async ({ page }) => {
        await page.goto(`/app/admin/organizations/${clientOrgId}`);
        const membersTab = page.getByRole('button', { name: 'Members' });
        await membersTab.click();

        // Add unknown email
        const emailInput = page.getByPlaceholder('user@example.com');
        await emailInput.fill(unregisteredEmail);

        const addBtn = page.getByRole('button', { name: 'Add Member' });
        await addBtn.click();

        // Assert success toast
        await expect(page.getByText(`Invited ${unregisteredEmail} as ORG_MEMBER`)).toBeVisible({ timeout: 10000 });

        // Assert user appears in Pending Invites list with Pending badge
        await expect(page.getByText(unregisteredEmail, { exact: true })).toBeVisible();
        const pendingRow = page.locator('tr').filter({ hasText: unregisteredEmail });
        await expect(pendingRow.getByText('Pending', { exact: true })).toBeVisible();

        // Assert database state: Invitation created with token, NO Membership created
        const dbInvitation = await prisma.invitation.findFirst({
            where: {
                sentToEmail: unregisteredEmail,
                organizationId: clientOrgId,
            }
        });
        expect(dbInvitation).not.toBeNull();
        expect(dbInvitation?.usedAt).toBeNull();
        expect(dbInvitation?.tokenHash).toBeDefined();

        const dbMembership = await prisma.membership.findFirst({
            where: {
                user: { email: unregisteredEmail },
                organizationId: clientOrgId,
            }
        });
        expect(dbMembership).toBeNull();
    });

    test('3. Step 3 (Duplicate Protection): Adding an already-active member rejects with error and creates no duplicate Membership', async ({ page }) => {
        await page.goto(`/app/admin/organizations/${clientOrgId}`);
        const membersTab = page.getByRole('button', { name: 'Members' });
        await membersTab.click();

        // Try adding the existing user again
        const emailInput = page.getByPlaceholder('user@example.com');
        await expect(emailInput).toBeVisible({ timeout: 10000 });
        await emailInput.fill(existingUserEmail);

        const addBtn = page.getByRole('button', { name: 'Add Member' });
        await addBtn.click();

        // Assert error toast
        await expect(page.getByText(/User is already a member of this scope/)).toBeVisible({ timeout: 15000 });

        // Assert database state: exactly 1 Membership exists
        const count = await prisma.membership.count({
            where: {
                userId: existingUserId,
                organizationId: clientOrgId,
            }
        });
        expect(count).toBe(1);
    });
});
