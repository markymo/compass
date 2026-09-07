import { test, expect } from '@playwright/test';
import * as path from 'path';

const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/9db5d22a-ef2f-4bb6-9eef-e07d0685d7fa';

test.describe('ONP-60: RDD1 Fourth View Mode on Preview', () => {
    test('validates RDD1 view mode, responsive reflow, and sidebar on Preview', async ({ page }) => {
        test.setTimeout(90000);

        const email = 'uat+le-admin-alpha@onpro.tech';
        const password = process.env.UAT_PASSWORD || 'Password123!';
        const leId = 'c5213b43-f4de-46ac-9ae7-8c4d9483e190';

        // 1. Log in on Preview domain
        await page.goto('/login');
        await page.locator('input[type="email"], #email').fill(email);
        await page.locator('input[type="password"], #password').fill(password);
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page).not.toHaveURL(/login/, { timeout: 25000 });

        // 2. Wide View (1400 x 900)
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.goto(`/app/le/${leId}/workbench4?view=rdd1`, { waitUntil: 'networkidle' });

        // Verify Question Bank page loaded and RDD1 button is present
        const rdd1Button = page.getByRole('button', { name: /rdd1/i });
        await expect(rdd1Button).toBeVisible({ timeout: 20000 });

        // Ensure questions are rendered
        await expect(page.locator('text=Showing').first()).toBeVisible({ timeout: 15000 });

        // Assert that "Edit Master value" button is removed from RDD1 cards
        await expect(page.getByRole('button', { name: /edit master value/i })).toHaveCount(0);

        // Capture Wide screenshot
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rdd1_wide.png'), fullPage: false });

        // 3. Medium View (800 x 900)
        await page.setViewportSize({ width: 800, height: 900 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rdd1_medium.png'), fullPage: false });

        // 4. Small View (390 x 844)
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rdd1_small.png'), fullPage: false });

        // 5. Test Sidebar Interaction in Wide view
        await page.setViewportSize({ width: 1400, height: 900 });
        await page.waitForTimeout(800);

        const mappingTile = page.locator('[data-testid^="rdd1-mapping-tile-"]').first();
        if (await mappingTile.isVisible()) {
            await mappingTile.click();
            const altMapping = page.locator('[data-testid="rdd1-alternative-mapping-selector"]');
            await expect(altMapping).toBeVisible({ timeout: 15000 });

            // Verify "Alternative Mapping" badge is absent
            await expect(altMapping.getByText('Alternative Mapping')).toHaveCount(0);

            // Open SuperFieldSelector dropdown
            const selectorBtn = altMapping.locator('button[role="combobox"]');
            await selectorBtn.click();
            await page.waitForTimeout(600);

            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rdd1_sidebar.png'), fullPage: false });
        }
    });
});
