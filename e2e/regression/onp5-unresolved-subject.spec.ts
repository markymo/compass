import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test('Full E2E Visual Lifecycle: Create Hornsea Entity -> Verify Legal Name Master Data -> Delete', async ({ page }) => {
        test.setTimeout(60000);

        const manifest = loadUATManifest();
        const timestamp = Date.now();
        const uniqueName = `HORNSEA 1 LIMITED E2E ${timestamp}`;

        // 1. Direct Navigate to Client Org Dashboard
        await page.goto(`/app/clients/${manifest.clientOrgA.id}`);
        await expect(page).toHaveURL(new RegExp(`/app/clients/${manifest.clientOrgA.id}`));

        // 2. Open Add Legal Entity Modal & Search GLEIF
        const addLeBtn = page.getByRole('button', { name: 'Add Legal Entity' }).first();
        await expect(addLeBtn).toBeVisible({ timeout: 15000 });
        await addLeBtn.click();

        const searchInput = page.getByRole('textbox', { name: 'Start typing company name...' }).or(page.locator('input[placeholder*="company name"]')).first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Hornsea');

        const gleifItem = page.getByRole('button', { name: 'HORNSEA 1 LIMITED' }).or(page.locator('button').filter({ hasText: /Hornsea/i })).first();
        await expect(gleifItem).toBeVisible({ timeout: 15000 });
        await gleifItem.click();

        // Set a unique timestamped name to prevent name collision with leftover entities
        const nameInput = page.locator('input[placeholder="Acme Corp Ltd"]').or(page.getByLabel('Entity Name')).first();
        if (await nameInput.isVisible()) {
            await nameInput.fill(uniqueName);
        }

        const jurisdictionInput = page.locator('input[placeholder*="UK, Delaware"]').or(page.getByLabel('Jurisdiction')).first();
        if (await jurisdictionInput.isVisible()) {
            const currentJurisdiction = await jurisdictionInput.inputValue();
            if (!currentJurisdiction.trim()) {
                await jurisdictionInput.fill('United Kingdom');
            }
        }

        // 3. Create Entity & Set Team Access
        const createBtn = page.getByRole('button', { name: 'Create Legal Entity' }).first();
        await expect(createBtn).toBeEnabled({ timeout: 10000 });
        await createBtn.click();

        // Wait for Step 2 modal to finish loading team members
        await expect(page.getByText('Loading team members...')).not.toBeVisible({ timeout: 15000 }).catch(() => {});

        // Explicitly grant Admin access to current user in Step 2 UI modal
        const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
        await expect(setAdminBtn).toBeVisible({ timeout: 10000 });
        await setAdminBtn.click();

        // Click Finish setup to submit saveClientLEPermissions
        const finishBtn = page.getByRole('button', { name: 'Finish setup' }).first();
        await expect(finishBtn).toBeVisible({ timeout: 15000 });
        await finishBtn.click();

        // 4. Open Newly Created Entity & Navigate to "Master Record" tab
        const leItem = page.getByText(uniqueName).first();
        await expect(leItem).toBeVisible({ timeout: 15000 });
        await leItem.click();

        await page.waitForURL(/\/app\/le\/[a-zA-Z0-9-]+/);
        const masterRecordTab = page.getByRole('link', { name: 'Master Record' }).first();
        if (await masterRecordTab.isVisible({ timeout: 10000 }).catch(() => false)) {
            await masterRecordTab.click();
        }

        await expect(page).toHaveURL(/\/master/);

        // 5. Search / Filter Master Record for Field 3 (Legal Name)
        const masterSearch = page.locator('input[placeholder*="Search master fields"]').or(page.getByRole('textbox', { name: /Search/i })).first();
        if (await masterSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
            await masterSearch.fill('Legal Name');
        }

        // 6. Directly inspect the rendered Field 3 card on the Master Record table (NO drawer needed!)
        const field3Card = page.locator('div').filter({ hasText: 'Field 3' }).or(page.getByText(/Legal Name|Legal name/i)).first();
        await expect(field3Card).toBeVisible({ timeout: 15000 });

        // Print actual rendered value to console for diagnostic visibility
        const actualField3Text = await field3Card.textContent();
        console.log('\n--- MASTER RECORD FIELD 3 INSPECTION ---');
        console.log('Rendered Field 3 Text:', actualField3Text?.trim());
        console.log('----------------------------------------\n');

        // Assert Field 3 contains expected "Hornsea" text
        await expect(field3Card).toContainText(/Hornsea/i);

        // 7. Teardown: Open Actions Menu & Delete Entity
        const menuButton = page.locator('button[aria-haspopup="menu"]').or(page.getByRole('button', { name: /actions|more|settings/i })).first();
        if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await menuButton.click();
            const deleteText = page.getByText('Delete').first();
            if (await deleteText.isVisible({ timeout: 2000 }).catch(() => false)) {
                await deleteText.click();
                const confirmBtn = page.getByRole('button', { name: 'Delete' }).first();
                if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                }
            }
        }
    });
});
