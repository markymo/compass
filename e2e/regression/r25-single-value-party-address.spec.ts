import { test, expect } from '@playwright/test';
import * as path from 'path';

const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/d84b5c54-73ec-42f1-ab55-4d0177cdd9bc';

test.describe('R25: Empty/Default Single-Value PARTY and ADDRESS Editor Routing', () => {
    test.setTimeout(90000);

    const email = 'uat+le-admin-alpha@onpro.tech';
    const password = process.env.UAT_PASSWORD || 'Password123!';
    const leId = 'c5213b43-f4de-46ac-9ae7-8c4d9483e190';

    async function login(page: any) {
        await page.goto('/login');
        const emailInput = page.locator('input[type="email"], #email').or(page.getByLabel('Email'));
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill(email);
            const pwdInput = page.locator('input[type="password"], #password').or(page.getByLabel('Password'));
            await pwdInput.fill(password);
            await page.getByRole('button', { name: /sign in/i }).click();
            await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 25000 });
        }
    }

    test('validates Field 155 (PARTY) and Field 138 (ADDRESS) routing in Master Data panel on Staging', async ({ page }) => {
        // 1. Log in
        await login(page);

        // 2. Navigate to Master Record view with Field 155 deep-linked
        await page.goto(`/app/le/${leId}/master?fieldNo=155`, { waitUntil: 'networkidle' });

        // 3. Verify drawer opens for Field 155
        const f155Heading = page.locator('h2, [role="heading"]').filter({ hasText: /Senior Managing Official/i });
        await expect(f155Heading.first()).toBeVisible({ timeout: 20000 });

        // Wait for field data loading state to finish
        const loadingIndicator = page.locator('div:has-text("Loading...")').filter({ has: page.locator('.animate-spin') });
        if (await loadingIndicator.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(loadingIndicator.first()).toBeHidden({ timeout: 20000 });
        }
        await page.waitForTimeout(1000);

        // Verify that the bug message is ABSENT:
        await expect(page.getByText('Editing is not supported for field type "PARTY".')).toHaveCount(0);

        // Take screenshot of loaded Field 155 drawer
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r25_f155_drawer.png'), fullPage: false });

        // 4. Click Add value / Edit button on Field 155 if empty/default
        const addBtn = page.getByRole('button', { name: /add value/i })
            .or(page.getByTitle('Add value'))
            .or(page.locator('button[title="Add value"]'))
            .first();

        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addBtn.click();

            // UnifiedPartyPicker modal should open
            const dialogTitle = page.getByRole('heading', { name: /Select or Create Party/i });
            await expect(dialogTitle).toBeVisible({ timeout: 10000 });

            // Verify search input is present
            await expect(page.getByPlaceholder('Search existing curated parties...')).toBeVisible();

            // Take screenshot of open dialog
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r25_party_picker_modal.png'), fullPage: false });

            // Close dialog without mutations
            const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
            if (await cancelBtn.isVisible()) {
                await cancelBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(500);
        }

        // 5. Navigate to Field 138 (Registered address)
        await page.goto(`/app/le/${leId}/master?fieldNo=138`, { waitUntil: 'networkidle' });

        // Verify drawer opens for Field 138
        const f138Heading = page.locator('h2, [role="heading"]').filter({ hasText: /Registered address/i });
        await expect(f138Heading.first()).toBeVisible({ timeout: 20000 });

        // Wait for loading to complete
        if (await loadingIndicator.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(loadingIndicator.first()).toBeHidden({ timeout: 20000 });
        }
        await page.waitForTimeout(1000);

        // Verify that the bug message is ABSENT:
        await expect(page.getByText('Editing is not supported for field type "ADDRESS".')).toHaveCount(0);

        // Take screenshot of loaded Field 138 drawer
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r25_f138_drawer.png'), fullPage: false });

        // 6. Test address picker trigger if empty
        const addAddrBtn = page.getByRole('button', { name: /add value/i })
            .or(page.getByTitle('Add value'))
            .or(page.locator('button[title="Add value"]'))
            .first();

        if (await addAddrBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addAddrBtn.click();

            const addrDialogTitle = page.getByRole('heading', { name: /Select or Create Address/i });
            await expect(addrDialogTitle).toBeVisible({ timeout: 10000 });

            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'r25_address_picker_modal.png'), fullPage: false });

            const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
            if (await cancelBtn.isVisible()) {
                await cancelBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
        }
    });
});
