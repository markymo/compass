import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

test.describe('ONP-194: Master Record Category Expand/Collapse Persistence & Default State', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(60000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let userEmail: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
        userEmail = manifest.actors.leAdminAlpha.email;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. First-ever visit / uninitialised preference defaults to Collapse All', async ({ page }) => {
        // Reset user preferences in database to simulate a fresh user with no saved preferences
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { preferences: true }
        });
        const currentPrefs = (user?.preferences as Record<string, any>) || {};
        const { masterRecord, ...clearedPrefs } = currentPrefs;
        await prisma.user.update({
            where: { email: userEmail },
            data: { preferences: clearedPrefs }
        });

        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Master Record heading and category accordion headers must be visible
        await expect(page.getByRole('heading', { name: 'Master Record', level: 2 })).toBeVisible({ timeout: 15000 });
        const identityToggle = page.getByRole('button', { name: /Toggle Identity category/i }).first();
        await expect(identityToggle).toBeVisible({ timeout: 10000 });

        // ONP-194 CONTRACT UNDER TEST:
        // On initial visit (uninitialised preference), all categories must default to COLLAPSED.
        // On current unpatched baseline (dev.onpro.tech), categories default to EXPANDED,
        // so Field 1 ("Legal name") is immediately visible in the DOM.
        // Under ONP-194, category contents are collapsed, so Field 1 must NOT be visible.
        const field1Badge = page.getByText('Field 1', { exact: true }).first();
        await expect(field1Badge).not.toBeVisible({ timeout: 5000 });
    });

    test('2. Toggling a category expands it and persists across page reload', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const identityToggle = page.getByRole('button', { name: /Toggle Identity category/i }).first();
        await expect(identityToggle).toBeVisible({ timeout: 15000 });

        // Click category header to expand
        await identityToggle.click();

        // Field 1 within Identity category must now be visible
        const field1Badge = page.getByText('Field 1', { exact: true }).first();
        await expect(field1Badge).toBeVisible({ timeout: 10000 });

        // Allow preference persistence server action to complete
        await page.waitForTimeout(1000);

        // Reload the page: the expansion state must have persisted to user preferences
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Identity category must remain expanded after reload
        await expect(page.getByRole('button', { name: /Toggle Identity category/i }).first()).toBeVisible({ timeout: 15000 });
        await expect(field1Badge).toBeVisible({ timeout: 10000 });
    });

    test('3. Expand all and Collapse all buttons mutate and persist across reload', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const field1Badge = page.getByText('Field 1', { exact: true }).first();

        // Click "Collapse all"
        const collapseAllBtn = page.getByRole('button', { name: 'Collapse all', exact: true });
        await expect(collapseAllBtn).toBeVisible({ timeout: 15000 });
        await collapseAllBtn.click();

        // Field 1 should now be hidden
        await expect(field1Badge).not.toBeVisible({ timeout: 5000 });

        await page.waitForTimeout(1000);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Remains collapsed after reload
        await expect(field1Badge).not.toBeVisible({ timeout: 5000 });

        // Click "Expand all"
        const expandAllBtn = page.getByRole('button', { name: 'Expand all', exact: true });
        await expect(expandAllBtn).toBeVisible({ timeout: 15000 });
        await expandAllBtn.click();

        // Field 1 is visible again
        await expect(field1Badge).toBeVisible({ timeout: 10000 });

        await page.waitForTimeout(1000);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Remains expanded after reload
        await expect(field1Badge).toBeVisible({ timeout: 10000 });
    });

    test('4. Search temporarily reveals matching category without mutating underlying preference', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const field1Badge = page.getByText('Field 1', { exact: true }).first();

        // Collapse all first
        const collapseAllBtn = page.getByRole('button', { name: 'Collapse all', exact: true });
        await collapseAllBtn.click();
        await expect(field1Badge).not.toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Search for "Legal name"
        const searchInput = page.getByPlaceholder('Search fields...');
        await searchInput.fill('Legal name');

        // Matching category should be temporarily revealed
        await expect(field1Badge).toBeVisible({ timeout: 10000 });

        // Clear search
        const clearBtn = page.getByRole('button', { name: 'Clear search' });
        if (await clearBtn.isVisible()) {
            await clearBtn.click();
        } else {
            await searchInput.fill('');
        }

        // Must return to collapsed state without needing explicit collapse action
        await expect(field1Badge).not.toBeVisible({ timeout: 5000 });
    });
});
