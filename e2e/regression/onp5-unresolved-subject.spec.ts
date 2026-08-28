import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import prisma from '../../src/lib/prisma';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        try {
            await prisma.clientLE.updateMany({
                where: {
                    name: { contains: 'HORNSEA', mode: 'insensitive' },
                    owners: { some: { partyId: manifest.clientOrgA.id } }
                },
                data: { isDeleted: true, status: 'ARCHIVED' }
            });
            console.log('\n[beforeAll Cleanup] Successfully soft-deleted pre-existing Hornsea entities in DB for clean test state.\n');
        } catch (e) {
            console.error('[beforeAll Cleanup] DB cleanup note:', e);
        }
    });

    test('Full E2E Visual Lifecycle: Delete Existing -> Create Hornsea GLEIF Entity -> Verify Source Data Propagation -> Teardown', async ({ page }) => {
        test.setTimeout(60000);

        const manifest = loadUATManifest();

        // 1. Direct Navigate to Client Org Dashboard
        await page.goto(`/app/clients/${manifest.clientOrgA.id}`);
        await expect(page).toHaveURL(new RegExp(`/app/clients/${manifest.clientOrgA.id}`));

        // 2. Open Add Legal Entity Modal & Search GLEIF for Hornsea
        const addLeBtn = page.getByRole('button', { name: 'Add Legal Entity' }).first();
        await expect(addLeBtn).toBeVisible({ timeout: 15000 });
        await addLeBtn.click();

        const searchInput = page.getByRole('textbox', { name: 'Start typing company name...' }).or(page.locator('input[placeholder*="company name"]')).first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Hornsea');

        // Select HORNSEA 1 LIMITED result from GLEIF lookup (populates LEI & GLEIF payload)
        const gleifItem = page.getByRole('button', { name: 'HORNSEA 1 LIMITED' }).or(page.locator('button').filter({ hasText: /Hornsea/i })).first();
        await expect(gleifItem).toBeVisible({ timeout: 15000 });
        await gleifItem.click();

        // Ensure Jurisdiction field is populated if empty
        const jurisdictionInput = page.locator('input[placeholder*="UK, Delaware"]').or(page.getByLabel('Jurisdiction')).first();
        if (await jurisdictionInput.isVisible()) {
            const currentJurisdiction = await jurisdictionInput.inputValue();
            if (!currentJurisdiction.trim()) {
                await jurisdictionInput.fill('United Kingdom');
            }
        }

        // 3. Create Entity & Trigger Source Data Bootstrap
        const createBtn = page.getByRole('button', { name: 'Create Legal Entity' }).first();
        await expect(createBtn).toBeEnabled({ timeout: 10000 });
        await createBtn.click();

        // Wait for Step 2 modal to finish loading team members
        await expect(page.getByText('Loading team members...')).not.toBeVisible({ timeout: 15000 }).catch(() => {});

        // Grant Admin access to current user in Step 2 UI modal
        const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
        if (await setAdminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await setAdminBtn.click();
        }

        // Click Finish setup to save permissions
        const finishBtn = page.getByRole('button', { name: 'Finish setup' }).first();
        await expect(finishBtn).toBeVisible({ timeout: 15000 });
        await finishBtn.click();

        // 4. Open Newly Created Entity & Navigate to "Master Record" tab
        const leItem = page.getByText(/HORNSEA 1 LIMITED/i).last();
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

        // 6. Inspect Field 3 Row Element
        const field3Row = page.locator('div.group').filter({ hasText: 'Field 3' }).first();
        await expect(field3Row).toBeVisible({ timeout: 15000 });

        const actualRowText = await field3Row.textContent();
        console.log('\n========================================');
        console.log('MASTER RECORD FIELD 3 (LEGAL NAME) PROPAGATED SOURCE VALUE:');
        console.log(actualRowText?.trim());
        console.log('========================================\n');

        // Assert Field 3 row contains propagated source data "Hornsea"
        await expect(field3Row).toContainText(/Hornsea/i);

        // 7. Teardown: Open Actions Menu & Delete Entity
        const menuButton = page.locator('button[aria-haspopup="menu"]').or(page.getByRole('button', { name: /actions|more|settings/i })).first();
        if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await menuButton.click();
            const deleteMenuItem = page.getByRole('menuitem', { name: /Delete/i }).or(page.getByText('Delete')).first();
            if (await deleteMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                await deleteMenuItem.click();
                const alertDialog = page.locator('[role="alertdialog"]').or(page.locator('[role="dialog"]')).first();
                if (await alertDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
                    const confirmBtn = alertDialog.getByRole('button', { name: 'Delete' }).first();
                    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await confirmBtn.click();
                    }
                }
            }
        }
    });
});
