import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test('Full E2E Visual Lifecycle: Check/Delete Hornsea -> Create GLEIF Entity & Grant Admin -> Verify Legal Name', async ({ page }) => {
        test.setTimeout(90000);

        const manifest = loadUATManifest();
        const clientOrgId = manifest.clientOrgA.id;

        // ---------------------------------------------------------------------
        // 1. LOG IN / NAVIGATE TO CLIENT ORG DASHBOARD
        // ---------------------------------------------------------------------
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page).toHaveURL(new RegExp(`/app/clients/${clientOrgId}`));

        // ---------------------------------------------------------------------
        // 2. CHECK IF "HORNSEA 1 LIMITED" EXISTS -> DELETE IT VIA UI IF PRESENT
        // ---------------------------------------------------------------------
        const existingHornseaLink = page.getByRole('link', { name: /HORNSEA 1 LIMITED/i }).or(page.getByText(/HORNSEA 1 LIMITED/i)).first();
        if (await existingHornseaLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('\n[UI Cleanup] Found existing Hornsea 1 Limited entity on dashboard. Deleting via UI...');
            await existingHornseaLink.click();
            await page.waitForURL(/\/app\/le\/[a-zA-Z0-9-]+/);

            const menuButton = page.locator('button[aria-haspopup="menu"]').or(page.getByRole('button', { name: /actions|more|settings/i })).first();
            if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await menuButton.click();

                const deleteMenuItem = page.getByRole('menuitem', { name: /Delete/i }).or(page.getByText('Delete')).first();
                if (await deleteMenuItem.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await deleteMenuItem.click();

                    const alertDialog = page.locator('[role="alertdialog"]').or(page.locator('[role="dialog"]')).first();
                    if (await alertDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
                        const confirmDeleteBtn = alertDialog.getByRole('button', { name: 'Delete' }).first();
                        if (await confirmDeleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                            await confirmDeleteBtn.click();
                            await page.waitForURL(/\/app/, { timeout: 10000 }).catch(() => {});
                        }
                    }
                }
            }

            // Return to Client Org Dashboard
            await page.goto(`/app/clients/${clientOrgId}`);
            await expect(page).toHaveURL(new RegExp(`/app/clients/${clientOrgId}`));
        }

        // ---------------------------------------------------------------------
        // 3. CREATE ENTITY VIA UI (ADD LEGAL ENTITY -> SEARCH GLEIF)
        // ---------------------------------------------------------------------
        const addLeBtn = page.getByRole('button', { name: 'Add Legal Entity' }).first();
        await expect(addLeBtn).toBeVisible({ timeout: 15000 });
        await addLeBtn.click();

        const searchInput = page.getByRole('textbox', { name: 'Start typing company name...' }).or(page.locator('input[placeholder*="company name"]')).first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Hornsea');

        const gleifItem = page.getByRole('button', { name: 'HORNSEA 1 LIMITED' }).or(page.locator('button').filter({ hasText: /Hornsea/i })).first();
        await expect(gleifItem).toBeVisible({ timeout: 15000 });
        await gleifItem.click();

        const jurisdictionInput = page.locator('input[placeholder*="UK, Delaware"]').or(page.getByLabel('Jurisdiction')).first();
        if (await jurisdictionInput.isVisible()) {
            const currentJurisdiction = await jurisdictionInput.inputValue();
            if (!currentJurisdiction.trim()) {
                await jurisdictionInput.fill('United Kingdom');
            }
        }

        const createBtn = page.getByRole('button', { name: 'Create Legal Entity' }).first();
        await expect(createBtn).toBeEnabled({ timeout: 10000 });
        await createBtn.click();

        // ---------------------------------------------------------------------
        // 4. ASSIGN CLIENT LE ADMIN PERMISSIONS IN STEP 2 OF CREATION MODAL
        // ---------------------------------------------------------------------
        await expect(page.getByText('Loading team members...')).not.toBeVisible({ timeout: 15000 }).catch(() => {});

        const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
        if (await setAdminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await setAdminBtn.click();
        }

        const finishBtn = page.getByRole('button', { name: 'Finish setup' }).first();
        await expect(finishBtn).toBeVisible({ timeout: 15000 });
        await finishBtn.click();

        // ---------------------------------------------------------------------
        // 5. OPEN DOSSIER & VERIFY FIELD 3 (LEGAL NAME) ON MASTER RECORD TAB
        // ---------------------------------------------------------------------
        const leItem = page.getByRole('link', { name: /HORNSEA 1 LIMITED/i }).or(page.getByText(/HORNSEA 1 LIMITED/i)).last();
        await expect(leItem).toBeVisible({ timeout: 15000 });
        await leItem.click();

        await page.waitForURL(/\/app\/le\/[a-zA-Z0-9-]+/);
        const masterRecordTab = page.getByRole('link', { name: 'Master Record' }).first();
        if (await masterRecordTab.isVisible({ timeout: 10000 }).catch(() => false)) {
            await masterRecordTab.click();
        }

        await expect(page).toHaveURL(/\/master/);

        const masterSearch = page.locator('input[placeholder*="Search master fields"]').or(page.getByRole('textbox', { name: /Search/i })).first();
        if (await masterSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
            await masterSearch.fill('Legal Name');
        }

        const field3Row = page.locator('div.group').filter({ hasText: 'Field 3' }).first();
        await expect(field3Row).toBeVisible({ timeout: 15000 });

        const actualRowText = await field3Row.textContent();
        console.log('\n========================================');
        console.log('MASTER RECORD FIELD 3 (LEGAL NAME) VALUE:');
        console.log(actualRowText?.trim());
        console.log('========================================\n');

        await expect(field3Row).toContainText(/Hornsea/i);

        // ---------------------------------------------------------------------
        // 6. TEARDOWN: CLEAN UP CREATED DOSSIER AT END OF TEST
        // ---------------------------------------------------------------------
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
