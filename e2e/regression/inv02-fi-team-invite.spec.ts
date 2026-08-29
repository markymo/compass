import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: INV-02
// Linear: ONP-69 — FI Team invite works end-to-end

const prisma = new PrismaClient();

test.describe('INV-02 / ONP-69 — FI Team Invite End-to-End Regression', () => {
    test.setTimeout(120000);

    let clientLEId: string;
    let engagementId: string;
    let supplierOrgId: string;
    const testEmail = `uat-supp-invite-${Date.now()}@onpro-test.com`;
    const testPassword = 'TestPassword123!';

    test.beforeAll(async () => {
        // 1. Resolve UAT Alpha Limited ClientLE and its active Engagement with UAT Supplier Org A
        const alphaLE = await prisma.clientLE.findFirst({
            where: { name: 'UAT Alpha Limited', isDeleted: false }
        });
        if (!alphaLE) throw new Error('UAT Alpha Limited not found in database');
        clientLEId = alphaLE.id;

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: alphaLE.id, isDeleted: false },
            include: { org: true }
        });
        if (!engagement) throw new Error('Active engagement for UAT Alpha Limited not found');
        engagementId = engagement.id;
        supplierOrgId = engagement.fiOrgId;

        // 2. Clean up any previous test state for test email
        await prisma.membership.deleteMany({
            where: { user: { email: testEmail } }
        });
        await prisma.invitation.deleteMany({
            where: { sentToEmail: testEmail }
        });
        await prisma.user.deleteMany({
            where: { email: testEmail }
        });
    });

    test.afterAll(async () => {
        // Cleanup created test records
        await prisma.membership.deleteMany({
            where: { user: { email: testEmail } }
        });
        await prisma.invitation.deleteMany({
            where: { sentToEmail: testEmail }
        });
        await prisma.user.deleteMany({
            where: { email: testEmail }
        });
        await prisma.$disconnect();
    });

    test('Full FI Team invite journey: LE Admin invites supplier -> Pending state in UI & DB -> Invitee registers & accepts -> Active membership with RELATIONSHIP_USER', async ({ browser }) => {
        // -------------------------------------------------------------------------
        // 1. LE Admin invites Supplier contact through the Relationships Team UI
        // -------------------------------------------------------------------------
        const adminContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const adminPage = await adminContext.newPage();

        await adminPage.goto(`/app/le/${clientLEId}/relationships`);
        await expect(adminPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // Expand the engagement accordion row for UAT Supplier Org A / Barclays
        const engagementAccordion = adminPage.locator('[data-state="closed"], [data-state="open"]').filter({ hasText: /UAT Supplier Org A|Barclays/i }).first();
        await expect(engagementAccordion).toBeVisible();
        await engagementAccordion.click();

        // Expand the Team sub-accordion
        const teamTrigger = adminPage.getByRole('button', { name: /Team/i }).first();
        await expect(teamTrigger).toBeVisible();
        await teamTrigger.click();

        // Open Invite Supplier Dialog
        const inviteBtn = adminPage.getByRole('button', { name: /Invite/i }).first();
        await expect(inviteBtn).toBeVisible({ timeout: 20000 });
        await inviteBtn.click();

        // Fill in recipient email
        const emailInput = adminPage.locator('#email');
        await expect(emailInput).toBeVisible();
        await emailInput.fill(testEmail);

        // Submit invitation
        const sendBtn = adminPage.getByRole('button', { name: 'Send Invitation' });
        await sendBtn.click();

        // Verify Dialog confirms Invitation Created and provides invite link
        await expect(adminPage.getByText('Invitation Created!')).toBeVisible({ timeout: 15000 });
        const inviteLinkInput = adminPage.locator('input[readonly]');
        await expect(inviteLinkInput).toBeVisible();
        const inviteLink = await inviteLinkInput.inputValue();
        expect(inviteLink).toContain('/invite/');

        // Close dialog
        const doneBtn = adminPage.getByRole('button', { name: 'Done' });
        await doneBtn.click();

        // Verify Pending Invitations card displays invited email and canonical role
        await expect(adminPage.getByText(testEmail)).toBeVisible({ timeout: 20000 });

        // -------------------------------------------------------------------------
        // 2. Verify Database Pending State
        // -------------------------------------------------------------------------
        const dbInvitation = await prisma.invitation.findFirst({
            where: { sentToEmail: testEmail, fiEngagementId: engagementId }
        });
        expect(dbInvitation).not.toBeNull();
        expect(dbInvitation?.role).toBe('SUPPLIER_CONTACT');
        expect(dbInvitation?.usedAt).toBeNull();
        expect(dbInvitation?.tokenHash).toBeDefined();

        // Assert NO membership exists before acceptance
        const preMembership = await prisma.membership.findFirst({
            where: { user: { email: testEmail } }
        });
        expect(preMembership).toBeNull();

        // -------------------------------------------------------------------------
        // 3. Verify Supplier Portal Team view shows Pending Invitation
        // -------------------------------------------------------------------------
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const supplierPage = await supplierContext.newPage();

        await supplierPage.goto(`/app/s/${supplierOrgId}/team`);
        await expect(supplierPage.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 20000 });
        await expect(supplierPage.getByText(testEmail)).toBeVisible();
        const supplierPendingRow = supplierPage.locator('tr').filter({ hasText: testEmail });
        await expect(supplierPendingRow.getByText('Supplier Contact')).toBeVisible();
        await expect(supplierPendingRow.getByText('UAT Alpha Limited')).toBeVisible();

        // -------------------------------------------------------------------------
        // 4. Invitee accepts invitation and sets password in a fresh context
        // -------------------------------------------------------------------------
        const inviteeContext = await browser.newContext();
        const inviteePage = await inviteeContext.newPage();

        await inviteePage.goto(inviteLink);
        await expect(inviteePage.getByLabel('Create Password')).toBeVisible({ timeout: 20000 });
        await expect(inviteePage.getByText(testEmail)).toBeVisible();

        // Fill password and register
        await inviteePage.getByLabel('Create Password').fill(testPassword);
        const submitAcceptBtn = inviteePage.getByRole('button', { name: 'Set Password & Continue' });
        await submitAcceptBtn.click();

        // Verify successful redirect to Supplier Portal
        await expect(inviteePage).toHaveURL(new RegExp(`/app/s/${supplierOrgId}`), { timeout: 20000 });

        // -------------------------------------------------------------------------
        // 5. Verify Database Accepted State & Single Membership
        // -------------------------------------------------------------------------
        const updatedInvitation = await prisma.invitation.findFirst({
            where: { sentToEmail: testEmail }
        });
        expect(updatedInvitation?.usedAt).not.toBeNull();

        const createdUser = await prisma.user.findUnique({
            where: { email: testEmail },
            include: { memberships: true }
        });
        expect(createdUser).not.toBeNull();
        expect(createdUser?.memberships.length).toBe(1);
        expect(createdUser?.memberships[0].fiEngagementId).toBe(engagementId);
        expect(createdUser?.memberships[0].role).toBe('RELATIONSHIP_USER');

        // -------------------------------------------------------------------------
        // 6. Verify Updated UI across LE Admin and Supplier Admin surfaces
        // -------------------------------------------------------------------------
        // As Supplier Admin: User is now listed under Team Members (Active) and removed from Pending
        await supplierPage.reload();
        await expect(supplierPage.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 20000 });
        const activeMemberRow = supplierPage.locator('tr').filter({ hasText: testEmail });
        await expect(activeMemberRow).toBeVisible();
        await expect(activeMemberRow.getByText('UAT Alpha Limited')).toBeVisible();

        // As LE Admin: User is now listed under Active Team Members and removed from Pending
        await adminPage.reload();
        // Re-expand the engagement accordion and Team sub-accordion
        await adminPage.locator('[data-state="closed"], [data-state="open"]').filter({ hasText: /UAT Supplier Org A|Barclays/i }).first().click();
        await adminPage.getByRole('button', { name: /Team/i }).first().click();
        await expect(adminPage.getByText(testEmail)).toBeVisible({ timeout: 20000 });

        await adminContext.close();
        await supplierContext.close();
        await inviteeContext.close();
    });
});
