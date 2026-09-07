import { test, expect, Page, TestInfo } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();
const prisma = new PrismaClient();

async function attachScreenshot(page: Page, testInfo: TestInfo, fr: string) {
    const body = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${fr}-current-ui.png`, { body, contentType: 'image/png' });
}

async function expandAccordion(trigger: any) {
    await expect(trigger).toBeVisible({ timeout: 20000 });
    const state = await trigger.getAttribute('data-state');
    if (state !== 'open') {
        await trigger.click();
        try {
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 3000 });
        } catch {
            await trigger.click();
            await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: 10000 });
        }
    }
}

async function login(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 });
}

function tokenHash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

test.describe('ONP-145 field report — Group D: Invitation & Onboarding Reproduction Evidence', () => {
    test.setTimeout(120000);
    const runId = Date.now();
    const manifest = loadUATManifest();
    const password = `Onp145-${runId}!`;
    const fr14Email = `uat+onp145-fr14-${runId}@onpro.tech`;
    const fr15Email = `uat+onp145-fr15-${runId}@onpro.tech`;
    const fr18Email = `uat+onp145-fr18-${runId}@onpro.tech`;

    let fr15UserId: string;
    let fr18UserId: string;
    let leAdminUserId: string;
    let fr15Token: string;
    let fr18Token: string;
    let fr19Token: string;
    const createdInvitationIds: string[] = [];

    test.beforeAll(async () => {
        const admin = await prisma.user.findUnique({ where: { email: manifest.actors.leAdminAlpha.email } });
        if (!admin) throw new Error('UAT LE Admin Alpha not found');
        leAdminUserId = admin.id;
        const hash = await bcrypt.hash(password, 10);

        const pendingUser = await prisma.user.create({
            data: { email: fr15Email, name: 'ONP-145 FR-15 Existing User', password: hash, emailVerified: new Date(), isDemoActor: false },
        });
        fr15UserId = pendingUser.id;
        fr15Token = crypto.randomUUID();
        const fr15Invite = await prisma.invitation.create({
            data: {
                sentToEmail: fr15Email,
                role: 'SUPPLIER_CONTACT',
                tokenHash: tokenHash(fr15Token),
                expiresAt: new Date(Date.now() + 7 * 86400000),
                createdByUserId: leAdminUserId,
                fiEngagementId: manifest.relationshipAlpha.id,
            },
        });
        createdInvitationIds.push(fr15Invite.id);

        const existingUser = await prisma.user.create({
            data: { email: fr18Email, name: 'ONP-145 FR-18 Existing User', password: hash, emailVerified: new Date(), isDemoActor: false },
        });
        fr18UserId = existingUser.id;
        fr18Token = crypto.randomUUID();
        const fr18Invite = await prisma.invitation.create({
            data: {
                sentToEmail: fr18Email,
                role: 'SUPPLIER_CONTACT',
                tokenHash: tokenHash(fr18Token),
                expiresAt: new Date(Date.now() + 7 * 86400000),
                createdByUserId: leAdminUserId,
                fiEngagementId: manifest.relationshipAlpha.id,
            },
        });
        createdInvitationIds.push(fr18Invite.id);

        fr19Token = crypto.randomUUID();
        const fr19Invite = await prisma.invitation.create({
            data: {
                sentToEmail: fr18Email,
                role: 'SUPPLIER_CONTACT',
                tokenHash: tokenHash(fr19Token),
                expiresAt: new Date(Date.now() + 7 * 86400000),
                createdByUserId: leAdminUserId,
                fiEngagementId: manifest.relationshipAlpha.id,
                usedAt: new Date(),
                acceptedByUserId: fr18UserId,
            },
        });
        createdInvitationIds.push(fr19Invite.id);
    });

    test.afterAll(async () => {
        try {
            const extraInvites = await prisma.invitation.findMany({
                where: { sentToEmail: { in: [fr14Email, fr15Email, fr18Email] } },
                select: { id: true },
            });
            const inviteIds = [...new Set([...createdInvitationIds, ...extraInvites.map(i => i.id)])];
            await prisma.invitation.deleteMany({ where: { id: { in: inviteIds } } });
            await prisma.membership.deleteMany({ where: { userId: { in: [fr15UserId, fr18UserId].filter(Boolean) } } });
            await prisma.engagementActivity.deleteMany({
                where: {
                    fiEngagementId: manifest.relationshipAlpha.id,
                    OR: [{ userId: fr15UserId }, { userId: fr18UserId }],
                },
            });
            await prisma.user.deleteMany({ where: { id: { in: [fr15UserId, fr18UserId].filter(Boolean) } } });

            const recentActivities = await prisma.engagementActivity.findMany({
                where: { fiEngagementId: manifest.relationshipAlpha.id, type: 'INVITE_SENT' },
                select: { id: true, details: true },
            });
            const ourIds = recentActivities
                .filter(a => JSON.stringify(a.details ?? {}).includes(fr14Email))
                .map(a => a.id);
            if (ourIds.length) await prisma.engagementActivity.deleteMany({ where: { id: { in: ourIds } } });
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-145 FR-14 — Relationship invitation link is only shown in transient success dialog and not recoverable later', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);
            const engagement = page.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
            await expandAccordion(engagement);
            await expandAccordion(page.locator('button').filter({ hasText: /^Team/ }).first());
            await page.getByRole('button', { name: /Invite/i }).first().click();
            await page.locator('#email').fill(fr14Email);
            await page.getByRole('button', { name: 'Send Invitation' }).click();
            await expect(page.getByText('Invitation Created!')).toBeVisible({ timeout: 20000 });

            const linkInput = page.locator('input[readonly]').last();
            await expect(linkInput).toBeVisible();
            const link = await linkInput.inputValue();
            expect(link).toContain('/invite/');
            await attachScreenshot(page, testInfo, 'FR-14-dialog');

            await page.getByRole('button', { name: 'Done' }).click();
            await expect(page.getByText(fr14Email).first()).toBeVisible({ timeout: 20000 });
            
            // In pending list, link is absent and no Copy Link / Resend button is present
            await expect(page.locator(`input[value="${link}"]`)).toHaveCount(0);
            await expect(page.getByRole('button', { name: /Copy Link|Resend|Show Link/i })).toHaveCount(0);
            await attachScreenshot(page, testInfo, 'FR-14-list');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-15 — Existing user with pending relationship invitation sees no pending invitation indicator on Home', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await login(page, fr15Email, password);
            await page.goto('/app');
            await expect(page.getByText(/pending invitation|invited to/i)).toHaveCount(0);
            await expect(page.getByText(manifest.alphaClientLE.name, { exact: true })).toHaveCount(0);
            await attachScreenshot(page, testInfo, 'FR-15');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-16 — Relationship invite dialog offers no Relationship Admin / Relationship User role choice', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);
            await expandAccordion(page.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first());
            await expandAccordion(page.locator('button').filter({ hasText: /^Team/ }).first());
            await page.getByRole('button', { name: /Invite/i }).first().click();
            
            // Assert that there is no role selection combobox or role choice in the dialog
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole('combobox')).toHaveCount(0);
            await expect(dialog.getByText(/Relationship Admin|Relationship User/i)).toHaveCount(0);
            await attachScreenshot(page, testInfo, 'FR-16');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-17 — No visible control exists to revoke an accepted relationship user', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);
            await expandAccordion(page.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first());
            await expandAccordion(page.locator('button').filter({ hasText: /^Team/ }).first());

            // Active team members list has no Revoke/Remove button (only pending invitations have Revoke)
            const activeMemberRows = page.locator('div:has(> h4:has-text("Active Team Members")) .divide-y > div');
            if ((await activeMemberRows.count()) > 0) {
                await expect(activeMemberRows.getByRole('button')).toHaveCount(0);
            }
            await attachScreenshot(page, testInfo, 'FR-17');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-18 — Signed-out existing-account invite first presents password creation form and fails with account exists error', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await page.goto(`/invite/${fr18Token}`);
            await expect(page.getByText('Thanks for accepting your invitation!')).toBeVisible({ timeout: 20000 });
            await expect(page.getByRole('button', { name: 'Set Password & Continue' })).toBeVisible();
            await expect(page.getByText('Already have an account?')).toBeVisible();

            await page.locator('#password').fill(password);
            await page.getByRole('button', { name: 'Set Password & Continue' }).click();

            await expect(page.getByText('Could not process invitation')).toBeVisible({ timeout: 20000 });
            await expect(page.getByText(/already exists.*sign in/i)).toBeVisible();
            await attachScreenshot(page, testInfo, 'FR-18');
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-19 — Re-clicking already-consumed invite presents controlled Invalid Invitation state rather than 404', async ({ browser }, testInfo) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await page.goto(`/invite/${fr19Token}`);
            await attachScreenshot(page, testInfo, 'FR-19');

            // Product displays controlled "Invalid Invitation" card, NOT a generic 404
            await expect(page.getByText('Invalid Invitation')).toBeVisible({ timeout: 10000 });
            await expect(page.getByText('This invitation link is invalid, expired, or has already been used.')).toBeVisible();
            await expect(page.getByText(/404/i)).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-20 — Relationship-only user clicking ClientLE link from Home results in 404', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();
        try {
            // As relationshipAdminAlpha, navigate to ClientLE URL directly (/app/le/${clientLEId})
            await page.goto(`/app/le/${manifest.alphaClientLE.id}`);
            await attachScreenshot(page, testInfo, 'FR-20');

            // Client LE page is restricted to Client LE members; relationship users get 404
            await expect(page.getByText(/404|Not Found|This page could not be found/i).first()).toBeVisible({ timeout: 10000 });
        } finally {
            await context.close();
        }
    });

    test('ONP-145 FR-23 — Visible internal navigation audit for relationship-only persona', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();
        const failures: Array<{ source: string; href: string }> = [];
        try {
            const sources = ['/app', `/app/s/${manifest.supplierOrgA.id}`, `/app/s/${manifest.supplierOrgA.id}/questions`, `/app/s/${manifest.supplierOrgA.id}/team`];
            for (const source of sources) {
                await page.goto(source);
                const hrefs = await page.locator('a[href^="/app"]').evaluateAll(nodes =>
                    [...new Set(nodes.map(n => (n as HTMLAnchorElement).getAttribute('href')).filter(Boolean) as string[])]
                );
                for (const href of hrefs.slice(0, 15)) {
                    const probe = await context.newPage();
                    await probe.goto(href);
                    const is404 = await probe.getByText(/404|This page could not be found/i).first().isVisible().catch(() => false);
                    if (is404) failures.push({ source, href });
                    await probe.close();
                }
            }
            await testInfo.attach('FR-23-link-audit.json', {
                body: Buffer.from(JSON.stringify(failures, null, 2)),
                contentType: 'application/json',
            });
            await attachScreenshot(page, testInfo, 'FR-23');
        } finally {
            await context.close();
        }
    });
});
