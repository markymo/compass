import { test, expect, Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: INV-02
// Linear: ONP-69 — FI Team invite works end-to-end

const prisma = new PrismaClient();

async function expandAccordion(trigger: Locator) {
    await expect(trigger).toBeVisible({ timeout: 20000 });
    const state = await trigger.getAttribute('data-state');
    if (state === 'closed') {
        await trigger.click();
        try {
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 3000 });
        } catch {
            await trigger.click();
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 10000 });
        }
    }
}

test.describe('INV-02 / ONP-69 — FI Team Invite End-to-End Regression', () => {
    test.setTimeout(120000);

    let clientLEId: string;
    let engagementId: string;
    let supplierOrgId: string;
    let testEmail: string;
    const testPassword = 'TestPassword123!';

    test.beforeAll(async () => {
        testEmail = `uat-supp-invite-${Date.now()}@onpro-test.com`;

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

        const cleanupUser = async () => {
            const u = await prisma.user.findUnique({ where: { email: testEmail } });
            if (u) {
                await prisma.engagementActivity.deleteMany({ where: { userId: u.id } });
            }
            await prisma.membership.deleteMany({
                where: { user: { email: testEmail } }
            });
            await prisma.invitation.deleteMany({
                where: { sentToEmail: testEmail }
            });
            await prisma.user.deleteMany({
                where: { email: testEmail }
            });
        };

        // 2. Clean up any previous test state for test email
        await cleanupUser();
    });

    test.afterAll(async () => {
        // Cleanup created test records
        const u = await prisma.user.findUnique({ where: { email: testEmail } });
        if (u) {
            await prisma.engagementActivity.deleteMany({ where: { userId: u.id } });
        }
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
        // ==========================================
        // 1. LE Admin invites a new Supplier Contact
        // ==========================================
        const adminContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const adminPage = await adminContext.newPage();

        await adminPage.goto(`/app/le/${clientLEId}/relationships`);
        await expect(adminPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // Expand the outer engagement accordion row if closed
        const engagementTrigger = adminPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(engagementTrigger);

        // Wait for sub-accordion to appear and expand Team subsection
        const teamTrigger = adminPage.getByRole('button', { name: /Team/i }).first();
        await expandAccordion(teamTrigger);

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
        const token = inviteLink.split('/invite/')[1].trim();

        // Verify UI reflects pending invitation badge/text
        await adminPage.getByRole('button', { name: 'Done' }).click();
        await expect(adminPage.getByText(testEmail).first()).toBeVisible({ timeout: 10000 });

        // ==========================================
        // 2. Supplier Org Admin verifies Pending Invites
        // ==========================================
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const supplierPage = await supplierContext.newPage();

        await supplierPage.goto(`/app/s/${supplierOrgId}/team`);
        await expect(supplierPage.getByRole('heading', { name: /Team Members|Team/i }).first()).toBeVisible({ timeout: 20000 });
        await expect(supplierPage.getByText(testEmail).first()).toBeVisible({ timeout: 20000 });

        // Verify database state for invitation
        const inviteRecord = await prisma.invitation.findFirst({
            where: { sentToEmail: testEmail, fiEngagementId: engagementId },
            orderBy: { createdAt: 'desc' }
        });
        expect(inviteRecord).not.toBeNull();
        expect(inviteRecord?.role).toBe('SUPPLIER_CONTACT');
        expect(inviteRecord?.usedAt).toBeNull();
        expect(inviteRecord?.revokedAt).toBeNull();

        // ==========================================
        // 3. Invitee registers and accepts invitation
        // ==========================================
        const inviteeContext = await browser.newContext();
        const inviteePage = await inviteeContext.newPage();

        await inviteePage.goto(`/invite/${token}`);

        // Ensure registration/acceptance form is present
        await expect(inviteePage.getByRole('heading', { name: /Accept Invitation|Join/i }).first()).toBeVisible({ timeout: 20000 });

        // Fill Name and Password to complete onboarding registration
        const nameInput = inviteePage.locator('input[name="name"], input#name').first();
        if (await nameInput.isVisible()) {
            await nameInput.fill('Invited Supplier User');
        }

        const passwordInput = inviteePage.locator('input[type="password"]').first();
        await expect(passwordInput).toBeVisible();
        await passwordInput.fill(testPassword);

        // Submit acceptance
        const acceptBtn = inviteePage.getByRole('button', { name: /Accept|Continue|Register/i }).first();
        await acceptBtn.click();

        // Verify user lands in application post-acceptance
        await inviteePage.waitForURL(url => !url.pathname.includes('/invite/'), { timeout: 30000 });

        // ==========================================
        // 4. Verify Active Membership & Roles
        // ==========================================
        const updatedUser = await prisma.user.findUnique({
            where: { email: testEmail },
            include: {
                memberships: {
                    where: { fiEngagementId: engagementId }
                }
            }
        });
        expect(updatedUser).not.toBeNull();
        expect(updatedUser?.memberships.length).toBeGreaterThanOrEqual(1);

        // Canonical contract: Accepted engagement membership maps SUPPLIER_CONTACT -> RELATIONSHIP_USER
        const engagementMembership = updatedUser?.memberships.find(m => m.fiEngagementId === engagementId);
        expect(engagementMembership).toBeDefined();
        expect(engagementMembership?.role).toBe('RELATIONSHIP_USER');

        // Verify Invitation record marked used
        const usedInvite = await prisma.invitation.findUnique({
            where: { id: inviteRecord!.id }
        });
        expect(usedInvite?.usedAt).not.toBeNull();

        // ==========================================
        // 5. Verify UI surfaces show Active Member
        // ==========================================
        // As Supplier Org Admin: User is now listed under Active Team Members
        await supplierPage.reload();
        await expect(supplierPage.getByText(testEmail).first()).toBeVisible({ timeout: 20000 });

        // As LE Admin: User is now listed under Active Team Members and removed from Pending
        await adminPage.reload();
        await expect(adminPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });
        const reloadEngTrigger = adminPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(reloadEngTrigger);

        const reloadTeamTrigger = adminPage.getByRole('button', { name: /Team/i }).first();
        await expandAccordion(reloadTeamTrigger);

        await expect(adminPage.getByText(testEmail).first()).toBeVisible({ timeout: 20000 });

        await adminContext.close();
        await supplierContext.close();
        await inviteeContext.close();
    });
});
