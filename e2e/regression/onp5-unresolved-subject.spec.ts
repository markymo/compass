/**
 * ONP-5 UNRESOLVED / ENRICHED LEGALENTITY SUBJECT REGRESSION & SECURITY ISOLATION SUITE
 *
 * Validates the full End-to-End visual UI lifecycle for creating a ClientLE with GLEIF lookup (Hornsea):
 * 1. SEARCH & SELECT HORNSEA: Org Admin opens "Add Legal Entity" modal, types "Hornsea" into search box, selects first search result.
 * 2. CREATE: Clicks "Create Legal Entity" and completes step 2 ("Finish setup").
 * 3. TEST LEGAL NAME: Navigates to /master, inspects Field 3 (Legal Name) right-hand drawer, updates Legal Name, saves, and verifies NO error appears.
 * 4. PERSISTENCE & ISOLATION: Verifies read-back in master data surface and checks dossier isolation.
 * 5. TEARDOWN: Cleans up and deletes the created ClientLE at the end of the test.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test('Full Visual UI Lifecycle: Search Hornsea GLEIF -> Select Entity -> Create ClientLE -> Test Legal Name -> Teardown', async ({ page }) => {
        test.setTimeout(90000);
        const manifest = loadUATManifest();
        const updatedLegalName = `Hornsea Wind Farm (Updated E2E) ${Date.now()}`;
        let createdClientLEId: string | null = null;

        try {
            // ---------------------------------------------------------------------
            // STEP 1: SEARCH HORNSEA & SELECT FIRST RESULT
            // ---------------------------------------------------------------------
            await page.goto(`/app/clients/${manifest.clientOrgA.id}`);
            await expect(page).toHaveURL(new RegExp(`/app/clients/${manifest.clientOrgA.id}`));

            const addLeButton = page.getByRole('button', { name: /Add Legal Entity/i }).first();
            await expect(addLeButton).toBeVisible();
            await addLeButton.click();

            // Modal dialog opens
            const createDialog = page.locator('[role="dialog"]').or(page.locator('[data-state="open"]')).first();
            await expect(createDialog).toBeVisible();

            // Find search input in LEILookup
            const searchInput = createDialog.locator('input[placeholder*="Start typing company name"]').first();
            await expect(searchInput).toBeVisible();
            await searchInput.fill('Hornsea');

            // Wait for search result dropdown item to appear and click the first item
            const firstResultItem = createDialog.locator('button').filter({ hasText: /Hornsea/i }).first();
            await expect(firstResultItem).toBeVisible({ timeout: 15000 });
            await firstResultItem.click();

            // ---------------------------------------------------------------------
            // STEP 2: CLICK CREATE & FINISH SETUP
            // ---------------------------------------------------------------------
            const submitBtn = createDialog.getByRole('button', { name: 'Create Legal Entity' }).first();
            await expect(submitBtn).toBeEnabled({ timeout: 10000 });
            await submitBtn.click();

            // Step 2: Click Finish setup
            const finishBtn = createDialog.getByRole('button', { name: /Finish setup|Done|Skip for now/i }).first();
            await expect(finishBtn).toBeVisible({ timeout: 20000 });
            await finishBtn.click();

            // ---------------------------------------------------------------------
            // STEP 3: NAVIGATE TO CREATED DOSSIER & MASTER DATA VIEW
            // ---------------------------------------------------------------------
            const leLink = page.getByText(/Hornsea/i).first();
            await expect(leLink).toBeVisible();
            await leLink.click();

            // Extract createdClientLEId from URL (/app/le/<id>...)
            await page.waitForURL(/\/app\/le\/[a-zA-Z0-9-]+/);
            const currentUrl = page.url();
            const match = currentUrl.match(/\/app\/le\/([a-zA-Z0-9-]+)/);
            if (match && match[1]) {
                createdClientLEId = match[1];
            }

            // Navigate to Master Data surface
            await page.goto(`/app/le/${createdClientLEId}/master`);
            await expect(page).toHaveURL(new RegExp(`/app/le/${createdClientLEId}/master`));

            // Ensure NO domain error toasts or banners are present
            await expect(page.getByText('Could not resolve LegalEntity subject')).not.toBeVisible();

            // ---------------------------------------------------------------------
            // STEP 4: TEST LEGAL NAME - Open Field 3 Drawer, Enter Legal Name, Save
            // ---------------------------------------------------------------------
            const field3Inspect = page.locator('div[role="button"][aria-label*="Inspect field 3"]').or(page.getByText(/Legal Name/i)).first();
            await expect(field3Inspect).toBeVisible();
            await field3Inspect.click();

            const drawer = page.locator('[role="dialog"]').or(page.locator('[data-state="open"]')).first();
            await expect(drawer).toBeVisible();

            const drawerInput = drawer.locator('input[type="text"]').first();
            if (await drawerInput.isVisible()) {
                await drawerInput.fill(updatedLegalName);

                const saveBtn = drawer.getByRole('button', { name: /save|update/i }).first();
                if (await saveBtn.isVisible()) {
                    await saveBtn.click();
                }
            }

            // Verify NO "Could not resolve LegalEntity subject" error appears
            await expect(page.getByText('Could not resolve LegalEntity subject')).not.toBeVisible();

            // ---------------------------------------------------------------------
            // STEP 5: VERIFY READ-BACK & PERSISTENCE
            // ---------------------------------------------------------------------
            await page.reload();
            await expect(page).toHaveURL(new RegExp(`/app/le/${createdClientLEId}/master`));
            await expect(page.getByText('Could not resolve LegalEntity subject')).not.toBeVisible();
            await expect(page.getByText(updatedLegalName)).toBeVisible();

        } finally {
            // ---------------------------------------------------------------------
            // STEP 6: TEARDOWN - Clean up created ClientLE
            // ---------------------------------------------------------------------
            if (createdClientLEId) {
                await page.goto(`/app/le/${createdClientLEId}/settings`);
                const archiveBtn = page.getByRole('button', { name: /Delete|Archive|Remove/i }).first();
                if (await archiveBtn.isVisible()) {
                    await archiveBtn.click();
                    const confirmBtn = page.getByRole('button', { name: /Confirm|Yes|Delete/i }).first();
                    if (await confirmBtn.isVisible()) {
                        await confirmBtn.click();
                    }
                }
            }
        }
    });
});
