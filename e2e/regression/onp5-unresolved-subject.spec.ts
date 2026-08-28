import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test('Full E2E Visual Lifecycle: Create Hornsea Entity -> Inspect Legal Name -> Delete', async ({ page }) => {
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

        // Wait for Step 2 modal to finish loading team members so handleSave populates LE_ADMIN role
        await expect(page.getByText('Loading team members...')).not.toBeVisible({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);

        const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
        if (await setAdminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await setAdminBtn.click();
        }

        const finishBtn = page.getByRole('button', { name: /Finish setup|Done|Skip for now/i }).first();
        await expect(finishBtn).toBeVisible({ timeout: 15000 });
        await finishBtn.click();

        // 4. Open Newly Created Entity & Inspect Field 3 (Legal Name)
        const leItem = page.getByText(uniqueName).first();
        await expect(leItem).toBeVisible({ timeout: 15000 });
        await leItem.click();

        // Navigate to Master Data surface if on overview page
        await page.waitForURL(/\/app\/le\/[a-zA-Z0-9-]+/);
        if (!page.url().includes('/master')) {
            const masterTab = page.getByRole('link', { name: /Master Data/i }).first();
            if (await masterTab.isVisible({ timeout: 5000 }).catch(() => false)) {
                await masterTab.click();
            } else {
                await page.goto(`${page.url().replace(/\/$/, '')}/master`);
            }
        }
        await expect(page).toHaveURL(/\/master/);

        const inspectField3Btn = page.locator('div[role="button"][aria-label*="Inspect field 3"]').or(page.getByRole('button', { name: /Inspect field 3/i })).or(page.getByText(/Legal Name/i)).first();
        await expect(inspectField3Btn).toBeVisible({ timeout: 15000 });
        await inspectField3Btn.click();

        // 5. Assert Legal Name contains expected text
        await expect(page.getByLabel('Inspect field 3: Legal name')).toContainText(/Hornsea/i);

        // 6. Teardown: Open Actions Menu & Delete Entity
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
