import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

test.describe('ONP-194: Master Record Category Expand/Collapse Persistence & Default State', () => {
    test.use({ storageState: process.env.PLAYWRIGHT_STORAGE_STATE || PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(60000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let userEmail: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = process.env.CLIENT_LE_ID || manifest.alphaClientLE.id;
        userEmail = process.env.USER_EMAIL || manifest.actors.leAdminAlpha.email;
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
        // Category contents are collapsed, so Field 3 ("Legal name") must NOT be visible.
        const field3Badge = page.getByText('Field 3', { exact: true }).first();
        await expect(field3Badge).not.toBeVisible({ timeout: 5000 });
    });

    test('2. Toggling a category expands it and persists across page reload', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const identityToggle = page.getByRole('button', { name: /Toggle Identity category/i }).first();
        await expect(identityToggle).toBeVisible({ timeout: 15000 });

        // Click category header to expand
        await identityToggle.click();

        // Field 3 within Identity category must now be visible
        const field3Badge = page.getByText('Field 3', { exact: true }).first();
        await expect(field3Badge).toBeVisible({ timeout: 10000 });

        // Allow preference persistence server action to complete
        await page.waitForTimeout(1000);

        // Reload the page: the expansion state must have persisted to user preferences
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Identity category must remain expanded after reload
        await expect(page.getByRole('button', { name: /Toggle Identity category/i }).first()).toBeVisible({ timeout: 15000 });
        await expect(field3Badge).toBeVisible({ timeout: 10000 });
    });

    test('3. Expand all and Collapse all buttons mutate and persist across reload', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const field3Badge = page.getByText('Field 3', { exact: true }).first();

        // Click "Collapse all"
        const collapseAllBtn = page.getByRole('button', { name: 'Collapse all', exact: true });
        await expect(collapseAllBtn).toBeVisible({ timeout: 15000 });
        await collapseAllBtn.click();

        // Field 3 should now be hidden
        await expect(field3Badge).not.toBeVisible({ timeout: 5000 });

        await page.waitForTimeout(1000);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Remains collapsed after reload
        await expect(field3Badge).not.toBeVisible({ timeout: 5000 });

        // Click "Expand all"
        const expandAllBtn = page.getByRole('button', { name: 'Expand all', exact: true });
        await expect(expandAllBtn).toBeVisible({ timeout: 15000 });
        await expandAllBtn.click();

        // Field 3 is visible again
        await expect(field3Badge).toBeVisible({ timeout: 10000 });

        await page.waitForTimeout(1000);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Remains expanded after reload
        await expect(field3Badge).toBeVisible({ timeout: 10000 });
    });

    test('4. Search temporarily reveals matching category without mutating underlying preference', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const field3Badge = page.getByText('Field 3', { exact: true }).first();

        // Collapse all first
        const collapseAllBtn = page.getByRole('button', { name: 'Collapse all', exact: true });
        await collapseAllBtn.click();
        await expect(field3Badge).not.toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Search for "Legal name"
        const searchInput = page.getByPlaceholder('Search fields...');
        await searchInput.fill('Legal name');

        // Matching category should be temporarily revealed
        await expect(field3Badge).toBeVisible({ timeout: 10000 });

        // Clear search
        const clearBtn = page.getByRole('button', { name: 'Clear search' });
        if (await clearBtn.isVisible()) {
            await clearBtn.click();
        } else {
            await searchInput.fill('');
        }

        // Must return to collapsed state without needing explicit collapse action
        await expect(field3Badge).not.toBeVisible({ timeout: 5000 });
    });

    test('5. Compact collapsed layout: categories form dense register list (38-44px rows, no 24px gaps, total list height <= 850px)', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Master Record heading and category accordion headers must be visible
        await expect(page.getByRole('heading', { name: 'Master Record', level: 2 })).toBeVisible({ timeout: 15000 });

        // Ensure all categories are collapsed
        const collapseAllBtn = page.getByRole('button', { name: 'Collapse all', exact: true });
        await expect(collapseAllBtn).toBeVisible({ timeout: 15000 });
        await collapseAllBtn.click();
        await page.waitForTimeout(500);

        const categoryHeaders = page.locator('[aria-label^="Toggle "]');
        const count = await categoryHeaders.count();
        expect(count).toBeGreaterThanOrEqual(15);

        // Measure row heights and gaps in the DOM
        const stats = await page.evaluate(() => {
            const headers = Array.from(document.querySelectorAll('[aria-label^="Toggle "]'));
            const boxes = headers.map(h => {
                const card = h.closest('[data-slot="card"]') || h.parentElement;
                const b = h.getBoundingClientRect();
                const cardBox = card ? card.getBoundingClientRect() : b;
                return {
                    top: cardBox.top,
                    bottom: cardBox.bottom,
                    headerHeight: b.height,
                    cardHeight: cardBox.height
                };
            });

            const gaps = [];
            for (let i = 0; i < boxes.length - 1; i++) {
                gaps.push(boxes[i + 1].top - boxes[i].bottom);
            }

            const totalHeight = boxes.length > 0 ? boxes[boxes.length - 1].bottom - boxes[0].top : 0;
            const avgRowHeight = boxes.reduce((a, b) => a + b.headerHeight, 0) / boxes.length;
            const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

            return { count: boxes.length, totalHeight, avgRowHeight, avgGap, maxGap: Math.max(...gaps) };
        });

        // ONP-194 Compact criteria:
        // On unpatched code: avgRowHeight is ~61px, card height is 111px, avgGap is 24px, totalHeight is ~2,676px.
        // Under compact design:
        // - Row height roughly 38-44px
        // - Inter-category gaps effectively removed (<= 2px border divider)
        // - Total height of collapsed category list is <= 850px (~3.3x density increase)
        expect(stats.avgRowHeight).toBeLessThanOrEqual(44);
        expect(stats.maxGap).toBeLessThanOrEqual(2);
        expect(stats.totalHeight).toBeLessThanOrEqual(850);
    });
});

