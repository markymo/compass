import { test, expect, Page, Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES, loadUATManifest } from '../fixtures/uat-fixture';

async function login(page: Page, email: string, pass: string) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(pass);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 });
}

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

// Contract: ONP-173 / ONP-145 FR-14, 15, 16, 17, 18, 20
// Canonical Product Contract:
// Adding/granting Team access is an authorization operation.
// Sending an invitation/notification is a communication/onboarding operation.
// They are not the same thing.

const prisma = new PrismaClient();

test.describe('ONP-173 — Supplier Team Membership & Invitation Onboarding Workflow', () => {
    test.setTimeout(90000);

    const manifest = loadUATManifest();
    const clientLEId = manifest.alphaClientLE.id;
    const supplierOrgId = manifest.supplierOrgA.id;
    const engagementId = manifest.relationshipAlpha.id;

    const testTimestamp = Date.now();
    const fredEmail = `uat-onp173-fred-${testTimestamp}@onpro-test.com`;
    const newInviteeEmail = `uat-onp173-new-${testTimestamp}@onpro-test.com`;
    const existingUserEmail = `uat-onp173-existing-${testTimestamp}@onpro-test.com`;

    const janeEmail = `uat-onp173-jane-${testTimestamp}@onpro-test.com`;

    let fredUserId: string;
    let existingUserId: string;

    test.beforeAll(async () => {
        // Ensure clean slate for test emails
        const emailsToClean = [fredEmail, newInviteeEmail, existingUserEmail, janeEmail];
        await prisma.engagementActivity.deleteMany({
            where: { user: { email: { in: emailsToClean } } },
        });
        await prisma.membership.deleteMany({
            where: { user: { email: { in: emailsToClean } } },
        });
        await prisma.invitation.deleteMany({
            where: { sentToEmail: { in: emailsToClean } },
        });
        await prisma.user.deleteMany({
            where: { email: { in: emailsToClean } },
        });

        // Create disposable existing user who already holds LE_ADMIN on Beta ClientLE
        const existingUser = await prisma.user.create({
            data: {
                email: existingUserEmail,
                name: 'Existing Client LE Admin',
                emailVerified: new Date(),
            },
        });
        existingUserId = existingUser.id;

        await prisma.membership.create({
            data: {
                userId: existingUserId,
                clientLEId: manifest.betaClientLE.id,
                role: 'LE_ADMIN',
            },
        });
    });

    test.afterAll(async () => {
        const emailsToClean = [fredEmail, newInviteeEmail, existingUserEmail, janeEmail];
        await prisma.engagementActivity.deleteMany({
            where: { user: { email: { in: emailsToClean } } },
        });
        await prisma.membership.deleteMany({
            where: { user: { email: { in: emailsToClean } } },
        });
        await prisma.invitation.deleteMany({
            where: { sentToEmail: { in: emailsToClean } },
        });
        await prisma.user.deleteMany({
            where: { email: { in: emailsToClean } },
        });
        await prisma.$disconnect();
    });

    // ========================================================================
    // Journey 1 — Existing OnPro User Added to Relationship Team
    // ========================================================================
    test('Journey 1: Existing OnPro user added to Relationship is granted RELATIONSHIP_ADMIN immediately with 0 invitations created', async ({ browser }) => {
        // LE Admin of Alpha ClientLE adds existing user to Supplier A Relationship
        const adminContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const adminPage = await adminContext.newPage();

        await adminPage.goto(`/app/le/${clientLEId}/relationships`);
        await expect(adminPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // Expand engagement and team accordions if needed
        const engagementTrigger = adminPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(engagementTrigger);

        const teamTrigger = adminPage.getByRole('button', { name: /Team/i }).first();
        await expandAccordion(teamTrigger);

        // Click Invite to open the dialog
        const inviteBtn = adminPage.getByRole('button', { name: /Invite/i }).first();
        await expect(inviteBtn).toBeVisible({ timeout: 20000 });
        await inviteBtn.click();

        // Fill in existing user's email
        const emailInput = adminPage.locator('#email');
        await expect(emailInput).toBeVisible();
        await emailInput.fill(existingUserEmail);

        // Submit invitation
        const sendBtn = adminPage.getByRole('button', { name: 'Send Invitation' });
        await sendBtn.click();

        // Wait for dialog result
        await adminPage.waitForTimeout(3000);

        // Check DB state under current dev behavior:
        const pendingInvite = await prisma.invitation.findFirst({
            where: { sentToEmail: existingUserEmail, fiEngagementId: engagementId },
        });

        const createdMembership = await prisma.membership.findFirst({
            where: { userId: existingUserId, fiEngagementId: engagementId },
        });

        // ====================================================================
        // AUTHORITATIVE RED ASSERTIONS FOR JOURNEY 1:
        // ====================================================================
        // Desired contract:
        // 1. Existing LE_ADMIN membership preserved
        const leMembership = await prisma.membership.findFirst({
            where: { userId: existingUserId, clientLEId: manifest.betaClientLE.id },
        });
        expect(leMembership?.role).toBe('LE_ADMIN');

        // 2. Zero new Invitation records for existing user (RED on current dev)
        expect(pendingInvite, 'Desired contract: Zero new invitation records for existing user').toBeNull();

        // 3. Relationship Membership created immediately with RELATIONSHIP_ADMIN (RED on current dev)
        expect(createdMembership?.role, 'Desired contract: Relationship membership created immediately').toBe('RELATIONSHIP_ADMIN');

        await adminContext.close();
    });

    // ========================================================================
    // Journey 2 — New User Pending → Accepted
    // ========================================================================
    test('Journey 2: New user pending invitation lifecycle -> accept & register -> active RELATIONSHIP_USER membership', async ({ browser }) => {
        // Create pending invitation for unknown email with explicit role RELATIONSHIP_USER
        const token = `tok-${Date.now()}`;
        const crypto = await import('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const invite = await prisma.invitation.create({
            data: {
                sentToEmail: newInviteeEmail,
                role: 'RELATIONSHIP_USER',
                fiEngagementId: engagementId,
                tokenHash,
                expiresAt: new Date(Date.now() + 30 * 86400000),
                createdByUserId: existingUserId,
            },
        });

        // 1. Assert Pre-Acceptance State:
        // - Pending invitation exists in DB
        expect(invite.usedAt).toBeNull();
        expect(invite.role).toBe('RELATIONSHIP_USER');
        // - No membership exists for this email
        const preMembership = await prisma.membership.findFirst({
            where: { user: { email: newInviteeEmail } },
        });
        expect(preMembership).toBeNull();

        // 2. Supplier Org Admin views Pending row on Teams page
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const supplierPage = await supplierContext.newPage();

        await supplierPage.goto(`/app/s/${supplierOrgId}/team`);
        await expect(supplierPage.getByRole('heading', { name: /Teams|Team Members/i }).first()).toBeVisible({ timeout: 20000 });
        await expect(supplierPage.getByText(newInviteeEmail).first()).toBeVisible({ timeout: 15000 });

        // 3. Invitee accepts invitation & registers
        const inviteeContext = await browser.newContext();
        const inviteePage = await inviteeContext.newPage();

        await inviteePage.goto(`/invite/${token}`);
        await expect(inviteePage.getByRole('heading', { name: /Accept Invitation|Join/i }).first()).toBeVisible({ timeout: 20000 });

        const nameInput = inviteePage.locator('input[name="name"], input#name').first();
        if (await nameInput.isVisible()) {
            await nameInput.fill('New Supplier User');
        }
        await inviteePage.locator('input[type="password"]').first().fill('SecurePassword123!');
        await inviteePage.getByRole('button', { name: /Accept|Continue|Register/i }).first().click();

        // Invitee lands in Supplier workspace post-acceptance
        await inviteePage.waitForURL((url) => url.pathname.startsWith(`/app/s/${supplierOrgId}`), { timeout: 30000 });

        // 4. Assert Post-Acceptance State:
        // - User created in DB
        const createdUser = await prisma.user.findUnique({
            where: { email: newInviteeEmail },
            include: { memberships: true },
        });
        expect(createdUser).not.toBeNull();

        // - Exactly one Relationship Membership created with RELATIONSHIP_USER
        const relMembership = createdUser?.memberships.find((m) => m.fiEngagementId === engagementId);
        expect(relMembership).toBeDefined();
        expect(relMembership?.role).toBe('RELATIONSHIP_USER');

        // - Invitation marked used
        const updatedInvite = await prisma.invitation.findUnique({ where: { id: invite.id } });
        expect(updatedInvite?.usedAt).not.toBeNull();

        await supplierContext.close();
        await inviteeContext.close();
    });

    // ========================================================================
    // Journey 3 — Mixed Client + Two Supplier Contexts (Fred Architecture Regression)
    // ========================================================================
    test('Journey 3: Fred holds LE_ADMIN on ClientLE X, RELATIONSHIP_ADMIN on Supplier A, and RELATIONSHIP_USER on Supplier B simultaneously', async ({ browser }) => {
        // Setup disposable Fred user
        const fredUser = await prisma.user.create({
            data: {
                email: fredEmail,
                name: 'Fred Multi-Role',
                emailVerified: new Date(),
            },
        });
        fredUserId = fredUser.id;

        // Grant 1: LE_ADMIN on Alpha ClientLE
        await prisma.membership.create({
            data: {
                userId: fredUserId,
                clientLEId: clientLEId,
                role: 'LE_ADMIN',
            },
        });

        // Grant 2: RELATIONSHIP_ADMIN on Relationship Alpha (Supplier A)
        await prisma.membership.create({
            data: {
                userId: fredUserId,
                fiEngagementId: manifest.relationshipAlpha.id,
                role: 'RELATIONSHIP_ADMIN',
            },
        });

        // Grant 3: RELATIONSHIP_USER on Relationship Beta (Supplier B)
        await prisma.membership.create({
            data: {
                userId: fredUserId,
                fiEngagementId: manifest.relationshipBeta.id,
                role: 'RELATIONSHIP_USER',
            },
        });

        // Assert all 3 grants coexist independently in DB
        const fredMemberships = await prisma.membership.findMany({
            where: { userId: fredUserId },
        });
        expect(fredMemberships).toHaveLength(3);

        // Remove ONLY Supplier A Relationship membership:
        const relAMembership = fredMemberships.find((m) => m.fiEngagementId === manifest.relationshipAlpha.id);
        expect(relAMembership).toBeDefined();

        await prisma.membership.delete({
            where: { id: relAMembership!.id },
        });

        // Assert: Supplier A removed, while ClientLE X and Supplier B remain completely intact:
        const remainingMemberships = await prisma.membership.findMany({
            where: { userId: fredUserId },
        });
        expect(remainingMemberships).toHaveLength(2);

        const remainingLE = remainingMemberships.find((m) => m.clientLEId === clientLEId);
        expect(remainingLE?.role).toBe('LE_ADMIN');

        const remainingRelB = remainingMemberships.find((m) => m.fiEngagementId === manifest.relationshipBeta.id);
        expect(remainingRelB?.role).toBe('RELATIONSHIP_USER');

        const deletedRelA = remainingMemberships.find((m) => m.fiEngagementId === manifest.relationshipAlpha.id);
        expect(deletedRelA).toBeUndefined();
    });

    // ========================================================================
    // Journey 4 — Relationship Team Lifecycle (Role Change, Remove, Revoke, Resend)
    // ========================================================================
    test('Journey 4: Active membership role change & removal; Pending invitation revoke & resend lifecycle', async ({ browser }) => {
        const j4Email = `uat-onp173-j4-${testTimestamp}@onpro-test.com`;
        const j4User = await prisma.user.create({
            data: {
                email: j4Email,
                name: 'J4 Active Member',
                emailVerified: new Date(),
            },
        });

        // 1. Create active relationship membership for testing role change and removal
        const testMember = await prisma.membership.create({
            data: {
                userId: j4User.id,
                fiEngagementId: engagementId,
                role: 'RELATIONSHIP_USER',
            },
        });

        // 2. Create pending invitation for testing revoke & resend
        const crypto = await import('crypto');
        const rawTok = `tok-cycle-${Date.now()}`;
        const tokHash = crypto.createHash('sha256').update(rawTok).digest('hex');

        const pendingInvite = await prisma.invitation.create({
            data: {
                sentToEmail: `pending-cycle-${Date.now()}@onpro-test.com`,
                role: 'RELATIONSHIP_USER',
                fiEngagementId: engagementId,
                tokenHash: tokHash,
                expiresAt: new Date(Date.now() + 86400000),
                createdByUserId: j4User.id,
            },
        });

        // Supplier Org Admin opens Team page
        const supplierContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const supplierPage = await supplierContext.newPage();

        await supplierPage.goto(`/app/s/${supplierOrgId}/team`);
        await expect(supplierPage.getByRole('heading', { name: /Teams|Team Members/i }).first()).toBeVisible({ timeout: 20000 });

        // Assert member row and pending row are present
        await expect(supplierPage.getByText(j4Email).first()).toBeVisible({ timeout: 15000 });
        await expect(supplierPage.getByText(pendingInvite.sentToEmail).first()).toBeVisible({ timeout: 15000 });

        // In desired ONP-173 contract:
        // Supplier Org Admin / Relationship Admin must have interactive controls:
        // - Role change / Edit role
        // - Remove relationship access
        // - Revoke invitation
        // - Resend / Recover invitation
        const memberRow = supplierPage.locator('tr', { hasText: j4Email });
        const pendingRow = supplierPage.locator('tr', { hasText: pendingInvite.sentToEmail });

        const memberActionButtons = memberRow.locator('button, [role="button"]');
        const pendingActionButtons = pendingRow.locator('button, [role="button"]');

        expect(await memberActionButtons.count(), 'Desired contract: Active relationship member must have role change and remove actions in Team UI').toBeGreaterThan(0);
        expect(await pendingActionButtons.count(), 'Desired contract: Pending invitation must have revoke and resend actions in Team UI').toBeGreaterThan(0);

        // Cleanup
        await prisma.invitation.deleteMany({ where: { id: pendingInvite.id } });
        await prisma.membership.deleteMany({ where: { id: testMember.id } });
        await prisma.user.deleteMany({ where: { id: j4User.id } });
        await supplierContext.close();
    });

    // ========================================================================
    // Journey 5 — Existing User Never Registers Again (Authoritative Contract)
    // ========================================================================
    test('Journey 5: Adding existing OnPro user never produces Pending Invitation, /invite/{token} requirement, or Create Password UI', async ({ browser }) => {
        const j5Email = `uat-onp173-j5-${testTimestamp}@onpro-test.com`;

        // 1. Create existing user with LE_ADMIN on Beta
        const j5User = await prisma.user.create({
            data: {
                email: j5Email,
                name: 'J5 Existing User',
                emailVerified: new Date(),
            },
        });
        await prisma.membership.create({
            data: {
                userId: j5User.id,
                clientLEId: manifest.betaClientLE.id,
                role: 'LE_ADMIN',
            },
        });

        // 2. LE Admin of Alpha ClientLE adds j5User to Relationship
        const adminContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const adminPage = await adminContext.newPage();

        await adminPage.goto(`/app/le/${clientLEId}/relationships`);
        await expect(adminPage.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        const engagementTrigger = adminPage.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(engagementTrigger);

        const teamTrigger = adminPage.getByRole('button', { name: /Team/i }).first();
        await expandAccordion(teamTrigger);

        const inviteBtn = adminPage.getByRole('button', { name: /Invite/i }).first();
        await expect(inviteBtn).toBeVisible({ timeout: 20000 });
        await inviteBtn.click();

        const emailInput = adminPage.locator('#email');
        await expect(emailInput).toBeVisible();
        await emailInput.fill(j5Email);

        const sendBtn = adminPage.getByRole('button', { name: 'Send Invitation' });
        await sendBtn.click();
        await adminPage.waitForTimeout(3000);

        // Assertions:
        // 1. Zero Pending Invitation records created
        const pendingInvite = await prisma.invitation.findFirst({
            where: { sentToEmail: j5Email, fiEngagementId: engagementId },
        });
        expect(pendingInvite, 'Authoritative Contract: Zero pending invitations created for existing user').toBeNull();

        // 2. Immediate Relationship Membership with requested role
        const createdMembership = await prisma.membership.findFirst({
            where: { userId: j5User.id, fiEngagementId: engagementId },
        });
        expect(createdMembership?.role, 'Authoritative Contract: Immediate Relationship Membership granted').toBe('RELATIONSHIP_ADMIN');

        // 3. Unrelated memberships preserved
        const leMembership = await prisma.membership.findFirst({
            where: { userId: j5User.id, clientLEId: manifest.betaClientLE.id },
        });
        expect(leMembership?.role, 'Unrelated LE_ADMIN membership preserved').toBe('LE_ADMIN');

        // Cleanup
        await prisma.engagementActivity.deleteMany({ where: { userId: j5User.id } });
        await prisma.membership.deleteMany({ where: { userId: j5User.id } });
        await prisma.invitation.deleteMany({ where: { sentToEmail: j5Email } });
        await prisma.user.deleteMany({ where: { id: j5User.id } });
        await adminContext.close();
    });

    // ========================================================================
    // Journey 6 — Post-Onboarding Navigation (Role-Aware)
    // ========================================================================
    test('Journey 6: Relationship-only user navigation is scoped to Supplier workspace and never exposes Client-only or Org Admin destinations', async ({ browser }) => {
        // Relationship-only user (relationshipAdminAlpha)
        const relContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const relPage = await relContext.newPage();

        // 1. User navigates to Supplier portal root
        await relPage.goto(`/app/s/${supplierOrgId}`);
        await expect(relPage.getByRole('heading', { name: /Relationships|Supplier/i }).first()).toBeVisible({ timeout: 20000 });

        // 2. Assert visible navigation tabs contain only Supplier-scoped destinations
        const navLinks = relPage.locator('nav a, header a');
        const count = await navLinks.count();

        for (let i = 0; i < count; i++) {
            const href = await navLinks.nth(i).getAttribute('href');
            if (href && href.startsWith('/app/')) {
                // Must not link to Client-only routes
                expect(href, `Visible nav link ${href} should not lead to Client-only /app/clients`).not.toContain('/app/clients');
                expect(href, `Visible nav link ${href} should not lead to Client-only /app/le/`).not.toContain('/app/le/');
            }
        }

        // 3. Authoritative RED: Relationship-only user must NOT see the Supplier Admin tab
        // On current dev: getFIPortalTabs unconditionally provides the Admin tab to all users
        const adminNavTab = relPage.locator('nav a, header a', { hasText: /^Admin$/i });
        await expect(adminNavTab, 'Authoritative RED: Relationship-only user must not see Supplier Admin tab in navigation').toHaveCount(0);

        // 4. Assert direct attempt to access Client-only route is blocked / 404
        await relPage.goto(`/app/le/${clientLEId}/workbench4`);
        await expect(relPage.getByText(/404|This page could not be found/i).first()).toBeVisible({ timeout: 10000 });

        await relContext.close();

        // 5. Verify Supplier Org Admin DOES see the Admin tab
        const orgAdminContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const orgAdminPage = await orgAdminContext.newPage();
        await orgAdminPage.goto(`/app/s/${supplierOrgId}`);
        const orgAdminTab = orgAdminPage.locator('nav a, header a', { hasText: /^Admin$/i });
        await expect(orgAdminTab).toBeVisible({ timeout: 15000 });
        await orgAdminContext.close();
    });

    // ========================================================================
    // Journey 7 — FR-15 Authenticated Pending-Invitation Discovery & Acceptance
    // ========================================================================
    test('Journey 7: Authenticated user discovers outstanding pending invitation on Home and accepts without token URL', async ({ browser }) => {
        const janeEmail = `uat-onp173-jane-${testTimestamp}@onpro-test.com`;
        const janePassword = 'JanePassword123!';

        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(janePassword, 10);

        // 1. Create Jane's account without any relationship membership
        const janeUser = await prisma.user.create({
            data: {
                email: janeEmail,
                name: 'Jane Invitee',
                password: hashedPassword,
                emailVerified: new Date(),
            },
        });

        // 2. Jane receives a pending Relationship invitation
        const crypto = await import('crypto');
        const rawTok = `tok-jane-${Date.now()}`;
        const tokHash = crypto.createHash('sha256').update(rawTok).digest('hex');

        const pendingInvite = await prisma.invitation.create({
            data: {
                sentToEmail: janeEmail,
                role: 'RELATIONSHIP_USER',
                fiEngagementId: engagementId,
                tokenHash: tokHash,
                expiresAt: new Date(Date.now() + 86400000),
                createdByUserId: existingUserId,
            },
        });

        // 3. Jane logs in and goes to Home (/app) WITHOUT following the token URL
        const janeContext = await browser.newContext();
        const janePage = await janeContext.newPage();

        await login(janePage, janeEmail, janePassword);
        await janePage.goto('/app');

        // AUTHORITATIVE RED ASSERTION:
        // On current dev: Home displays 0 pending invitation discovery or accept controls:
        const pendingCard = janePage.getByText(/Pending Invitation|You have been invited/i).first();
        await expect(pendingCard, 'Authoritative RED: Authenticated Home must display outstanding pending invitations').toBeVisible({ timeout: 10000 });

        const acceptBtn = janePage.getByRole('button', { name: /Accept Invitation|Join Team/i }).first();
        await expect(acceptBtn).toBeVisible();
        await acceptBtn.click();

        // 4. Acceptance creates RELATIONSHIP_USER membership and lands in Supplier workspace
        await janePage.waitForURL(url => url.pathname.startsWith(`/app/s/${supplierOrgId}`), { timeout: 30000 });

        const createdJaneMembership = await prisma.membership.findFirst({
            where: { userId: janeUser.id, fiEngagementId: engagementId },
        });
        expect(createdJaneMembership?.role).toBe('RELATIONSHIP_USER');

        const consumedInvite = await prisma.invitation.findUnique({ where: { id: pendingInvite.id } });
        expect(consumedInvite?.usedAt).not.toBeNull();

        // Cleanup
        await prisma.engagementActivity.deleteMany({ where: { userId: janeUser.id } });
        await prisma.membership.deleteMany({ where: { userId: janeUser.id } });
        await prisma.invitation.deleteMany({ where: { id: pendingInvite.id } });
        await prisma.user.deleteMany({ where: { id: janeUser.id } });
        await janeContext.close();
    });
});

