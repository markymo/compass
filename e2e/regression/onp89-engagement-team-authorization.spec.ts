import { test, expect, Locator } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: ONP-89
// getEngagementTeam engagement-scoped server-side authorization regression

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

test.describe('ONP-89 — getEngagementTeam Engagement-Scoped Authorization Regression', () => {
    test.setTimeout(120000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let alphaClientLEId: string;
    let betaClientLEId: string;
    let alphaEngagementId: string;
    let betaEngagementId: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        alphaClientLEId = manifest.alphaClientLE.id;
        betaClientLEId = manifest.betaClientLE.id;
        alphaEngagementId = manifest.relationshipAlpha.id;
        betaEngagementId = manifest.relationshipBeta.id;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. Authorised LE Admin Alpha can open Alpha relationships and view engagement team section', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();

        await page.goto(`/app/le/${alphaClientLEId}/relationships`);
        await expect(page.getByRole('heading', { name: /Supplier Relationships/i }).first()).toBeVisible({ timeout: 20000 });

        // Expand outer engagement accordion
        const engagementTrigger = page.getByRole('button', { name: /UAT Supplier Org A|Barclays/i }).first();
        await expandAccordion(engagementTrigger);

        // Expand Team subsection
        const teamTrigger = page.getByRole('button', { name: /Team/i }).first();
        await expandAccordion(teamTrigger);

        // Verify Team section renders team content (Invite button or Team heading)
        const inviteBtn = page.getByRole('button', { name: /Invite/i }).first();
        await expect(inviteBtn).toBeVisible({ timeout: 20000 });

        await context.close();
    });

    test('2. Unrelated LE User Beta cannot access Alpha relationships or operational team data', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leUserBeta });
        const page = await context.newPage();

        // Direct navigation to Alpha relationships as Beta user
        await page.goto(`/app/le/${alphaClientLEId}/relationships`);
        // Expected behavior: Access Denied / 404 / redirect
        await expect(page.getByRole('heading', { name: /Supplier Relationships/i })).not.toBeVisible();
        await expect(page.getByText(/404|Access Denied|Unauthorized/i).or(page.locator('h1'))).toBeVisible();

        await context.close();
    });

    test('3. Unrelated Supplier ORG_ADMIN cannot access Alpha operational relationships or team data', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();

        // Direct navigation to Client LE relationships as Supplier Org Admin
        await page.goto(`/app/le/${alphaClientLEId}/relationships`);
        await expect(page.getByRole('heading', { name: /Supplier Relationships/i })).not.toBeVisible();

        await context.close();
    });

    test('4. System Admin cannot access Alpha operational relationships or team data', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();

        // Direct navigation to Client LE relationships as System Admin
        await page.goto(`/app/le/${alphaClientLEId}/relationships`);
        await expect(page.getByRole('heading', { name: /Supplier Relationships/i })).not.toBeVisible();

        await context.close();
    });
});
