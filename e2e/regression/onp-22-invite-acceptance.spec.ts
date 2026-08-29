import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { loadUATManifest } from '../fixtures/uat-fixture';

// Contract: INV-01 — Invitation acceptance is a clean one-time journey
// Linear: ONP-22

const prisma = new PrismaClient();

test.describe('INV-01 / ONP-22 — Invitation Acceptance is a Clean One-Time Journey', () => {
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientOrgId: string;
    const testEmail = `inv-onp22-${Date.now()}@invitetest.example`;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    let invitationId: string;
    let createdUserId: string | null = null;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientOrgId = manifest.clientOrgA.id;

        const creator = await prisma.user.findFirst({
            where: { email: manifest.actors.clientOrgAdminA.email }
        });

        // Create a fresh, valid invitation record in the database for clientOrgA
        const invite = await prisma.invitation.create({
            data: {
                sentToEmail: testEmail,
                tokenHash,
                role: 'ORG_MEMBER',
                organizationId: clientOrgId,
                createdByUserId: creator?.id || (await prisma.user.findFirst())?.id!,
                expiresAt: new Date(Date.now() + 86400000),
            }
        });
        invitationId = invite.id;
    });

    test.afterAll(async () => {
        // Clean up created user, memberships, and invitation
        if (createdUserId) {
            await prisma.membership.deleteMany({ where: { userId: createdUserId } });
            await prisma.user.deleteMany({ where: { id: createdUserId } });
        }
        await prisma.invitation.deleteMany({ where: { id: invitationId } });
        await prisma.$disconnect();
    });

    test('1. First-time acceptance registers account and redirects cleanly; revisit correctly shows already-used state', async ({ browser }) => {
        // Use an incognito / clean browser context (logged out)
        const context = await browser.newContext();
        const page = await context.newPage();

        // 1. Navigate to invitation page
        await page.goto(`/invite/${rawToken}`);
        await page.waitForLoadState('networkidle');

        // Verify Invitation Card is shown for the invited email
        await expect(page.locator('text=' + testEmail)).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('heading', { name: /Join the Team|Welcome to/i })).toBeVisible();

        // 2. Set password and complete registration
        const passwordInput = page.locator('input[type="password"]#password');
        await expect(passwordInput).toBeVisible({ timeout: 10000 });
        await passwordInput.fill('StrongTestPass123!');

        const submitButton = page.getByRole('button', { name: /Set Password & Continue/i });
        await expect(submitButton).toBeVisible();
        await submitButton.click();

        // 3. Assert successful redirection to the platform dashboard without any erroneous "already accepted" message
        await page.waitForURL(url => url.pathname.startsWith('/app'), { timeout: 20000 });
        expect(page.url()).toContain('/app');

        // Confirm no error toast / alert is displayed
        await expect(page.locator('text=Could not process invitation')).not.toBeVisible();
        await expect(page.locator('text=This invitation has already been accepted.')).not.toBeVisible();

        // 4. Verify DB state: invitation is now marked usedAt and user is created
        const usedInvite = await prisma.invitation.findUnique({ where: { id: invitationId } });
        expect(usedInvite?.usedAt).not.toBeNull();
        expect(usedInvite?.acceptedByUserId).not.toBeNull();
        createdUserId = usedInvite?.acceptedByUserId || null;

        // 5. Revisit the consumed invitation URL in the browser
        await page.goto(`/invite/${rawToken}`);
        await page.waitForLoadState('networkidle');

        // 6. Assert that ONLY upon revisit is the already-used / invalid state presented
        await expect(page.locator('text=Invalid Invitation')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=This invitation link is invalid, expired, or has already been used.')).toBeVisible();

        await context.close();
    });
});
