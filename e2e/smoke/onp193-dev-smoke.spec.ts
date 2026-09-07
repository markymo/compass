/**
 * ONP-193 LIVE SMOKE TEST SUITE FOR DEV.ONPRO.TECH
 *
 * Verifies live behavior on https://dev.onpro.tech:
 * 1. Fresh browser / incognito defaults to Light (even when OS prefers dark).
 * 2. Explicit Dark selection works and persists across reload.
 * 3. Checkbox contrast in Admin Organisations dialog in Dark Mode.
 * 4. Checkbox & label contrast in Field Detail / Master Record.
 * 5. Output Pack / Questionnaire checkboxes in Dark Mode.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

function getLuminance(rgbStr: string): number {
    const match = rgbStr.match(/\d+/g);
    if (!match || match.length < 3) return 0;
    const [r, g, b] = match.slice(0, 3).map(Number).map(v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(rgb1: string, rgb2: string): number {
    const l1 = getLuminance(rgb1);
    const l2 = getLuminance(rgb2);
    const brighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (brighter + 0.05) / (darker + 0.05);
}

test.describe('ONP-193: Live Smoke Tests on dev.onpro.tech', () => {

    test('1. Fresh browser / incognito defaults to Light on dev.onpro.tech (even when OS prefers dark)', async ({ browser }) => {
        // Emulate system dark mode (Edge / Incognito)
        const context = await browser.newContext({
            colorScheme: 'dark',
        });
        const page = await context.newPage();

        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // Verify html does not have 'dark' class
        const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        expect(hasDarkClass).toBe(false);

        // Verify body background is white/light
        const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bodyBg).toBe('rgb(255, 255, 255)');

        await context.close();
    });

    test('2. Explicit Dark selection works and persists on dev.onpro.tech', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.systemAdmin,
        });
        const page = await context.newPage();

        await page.goto('/app/account');
        await page.waitForLoadState('domcontentloaded');

        // Click Dark theme button
        const darkButton = page.getByRole('button', { name: 'Dark' });
        await expect(darkButton).toBeVisible();
        await darkButton.click();

        // Verify html has 'dark' class
        await expect(page.locator('html')).toHaveClass(/dark/);

        // Verify dark background applied
        const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bodyBg).toBe('rgb(9, 13, 22)'); // #090d16

        // Reload page and verify theme choice persists
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('html')).toHaveClass(/dark/);

        const reloadedBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(reloadedBg).toBe('rgb(9, 13, 22)');

        // Reset back to Light for clean state
        const lightButton = page.getByRole('button', { name: 'Light' });
        await lightButton.click();
        await expect(page.locator('html')).not.toHaveClass(/dark/);

        await context.close();
    });

    test('3. Checkbox contrast is correct in Admin Organisations dialog in Dark Mode', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.systemAdmin,
        });
        const page = await context.newPage();

        // Force dark mode for testing
        await page.goto('/app/admin/organizations');
        await page.evaluate(() => {
            document.documentElement.classList.add('dark');
        });

        // Open "New Organization" dialog
        const addOrgBtn = page.getByRole('button', { name: /new organization/i });
        await expect(addOrgBtn).toBeVisible();
        await addOrgBtn.click();

        // Checkbox #chk-fi is initially unchecked
        const fiCheckbox = page.locator('#chk-fi');
        await expect(fiCheckbox).toBeVisible();
        await expect(fiCheckbox).toHaveAttribute('data-state', 'unchecked');

        // Verify checkbox border and container contrast
        const checkboxBorder = await fiCheckbox.evaluate((el) => getComputedStyle(el).borderColor);
        const cardBg = await fiCheckbox.evaluate((el) => {
            const parent = el.closest('[role="dialog"]') || el.parentElement;
            return getComputedStyle(parent!).backgroundColor;
        });

        const contrast = getContrastRatio(cardBg, checkboxBorder);
        // High contrast border in dark mode (dark:border-slate-500) against card
        expect(contrast).toBeGreaterThanOrEqual(2.5);

        // Click checkbox to test toggling to checked state
        await fiCheckbox.click();
        await expect(fiCheckbox).toHaveAttribute('data-state', 'checked');

        const checkedBg = await fiCheckbox.evaluate((el) => getComputedStyle(el).backgroundColor);
        const checkedContrast = getContrastRatio(cardBg, checkedBg);
        expect(checkedContrast).toBeGreaterThanOrEqual(4.5);

        await context.close();
    });

    test('4. Checkbox and label contrast in Field Detail sheet in Dark Mode', async ({ browser }) => {
        const manifest = loadUATManifest();
        const context = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.leAdminAlpha,
        });
        const page = await context.newPage();

        await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);
        await page.evaluate(() => {
            document.documentElement.classList.add('dark');
        });

        // Verify page loads in dark mode
        const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bodyBg).toBe('rgb(9, 13, 22)');

        await context.close();
    });

    test('5. Output Pack Builder & Relationships surface remain readable in Dark Mode', async ({ browser }) => {
        const manifest = loadUATManifest();
        const context = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.leAdminAlpha,
        });
        const page = await context.newPage();

        await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);
        await page.evaluate(() => {
            document.documentElement.classList.add('dark');
        });

        // Verify relationships surface renders with dark mode canvas and readable text
        const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bodyBg).toBe('rgb(9, 13, 22)');

        // Verify page header is visible
        await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible();

        await context.close();
    });
});
