import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-190 — ISO Currency Code Smoke Test on dev.onpro.tech', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

    test('Field 116 (SSI 1 Currency) renders corrected currency options with GBP/EUR/USD pinned', async ({ page }) => {
        const manifest = loadUATManifest();
        const masterUrl = `/app/le/${manifest.alphaClientLE.id}/master`;

        console.log(`Navigating to ${masterUrl}...`);
        await page.goto(masterUrl, { waitUntil: 'networkidle' });

        // Ensure master page loaded
        await expect(page).toHaveURL(new RegExp(masterUrl));

        // Click "Expand all" or search for SSI 1 Currency
        const searchInput = page.getByPlaceholder('Search fields...');
        if (await searchInput.isVisible()) {
            await searchInput.fill('SSI 1 Currency');
        } else {
            const expandAll = page.getByRole('button', { name: 'Expand all' });
            if (await expandAll.isVisible()) {
                await expandAll.click();
            }
        }

        // Find Field 116 row (SSI 1 Currency)
        const fieldRow = page.locator('tr, div').filter({ hasText: /^SSI 1 Currency/ }).first();
        await expect(fieldRow).toBeVisible({ timeout: 15000 });
        await fieldRow.click();

        // Field detail slideover should appear
        const sheet = page.locator('[role="dialog"]').first();
        await expect(sheet).toBeVisible({ timeout: 10000 });

        // Click "Add value" or "Edit" button to enter editing mode
        const editButton = sheet.getByRole('button', { name: /Add value|Edit/i }).first();
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        // Locate the combobox trigger button in CanonicalScalarEditor
        const comboboxButton = sheet.getByRole('combobox').first();
        await expect(comboboxButton).toBeVisible({ timeout: 5000 });
        await comboboxButton.click();

        // The Command popover list should appear with options
        const commandItems = page.locator('[cmdk-item]');
        await expect(commandItems.first()).toBeVisible({ timeout: 5000 });

        const firstItemText = (await commandItems.nth(0).innerText()).trim();
        const secondItemText = (await commandItems.nth(1).innerText()).trim();
        const thirdItemText = (await commandItems.nth(2).innerText()).trim();

        console.log(`Item 0: ${firstItemText}`);
        console.log(`Item 1: ${secondItemText}`);
        console.log(`Item 2: ${thirdItemText}`);

        expect(firstItemText).toContain('GBP');
        expect(firstItemText).toContain('Pound Sterling');

        expect(secondItemText).toContain('EUR');
        expect(secondItemText).toContain('Euro');

        expect(thirdItemText).toContain('USD');
        expect(thirdItemText).toContain('US Dollar');

        // Test search functionality
        const cmdkInput = page.locator('[cmdk-input]');
        await cmdkInput.fill('JPY');
        const jpyItem = page.locator('[cmdk-item]').filter({ hasText: /JPY/i });
        await expect(jpyItem).toBeVisible();
        await expect(jpyItem).toContainText('Yen');

        // Select JPY
        await jpyItem.click();

        // Verify combobox trigger displays selected currency label
        await expect(comboboxButton).toContainText(/JPY/i);

        // Click Save button
        const saveButton = sheet.getByRole('button', { name: 'Save', exact: true });
        await expect(saveButton).toBeVisible();
        await saveButton.click();

        // Verify save completes and UI reflects the saved 3-letter code
        await expect(sheet.getByText('JPY', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    });
});
