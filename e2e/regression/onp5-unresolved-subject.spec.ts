/**
 * ONP-5 UNRESOLVED LEGALENTITY SUBJECT REGRESSION & SECURITY ISOLATION SUITE
 *
 * Validates the full End-to-End visual UI lifecycle for a ClientLE without a LegalEntity subject:
 * 1. CREATE: Org Admin creates an unmapped ClientLE (legalEntityId = null) via the UI modal ("Add Legal Entity").
 * 2. TEST LEGAL NAME: Navigates to /master, inspects Field 3 (Legal Name) right-hand drawer, enters Legal Name, saves, and verifies NO "Could not resolve LegalEntity subject" error appears.
 * 3. PERSISTENCE & ISOLATION: Verifies read-back in master data surface and verifies dossier isolation against other ClientLEs.
 * 4. TEARDOWN: Cleans up and deletes the created ClientLE at the end of the test.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test('Full Visual UI Lifecycle: Create ClientLE -> Test Legal Name Master Data -> Verify Read-back -> Teardown', async ({ page }) => {
        test.setTimeout(60000);
        const manifest = loadUATManifest();
        const testLEIdName = `Visual E2E ClientLE ${Date.now()}`;
        const legalNameInput = `Visual E2E Legal Name Asserted Ltd ${Date.now()}`;
        let createdClientLEId: string | null = null;

        try {
            // ---------------------------------------------------------------------
            // STEP 1: CREATE - Org Admin navigates to Client Org Dashboard & opens Creation Modal
            // ---------------------------------------------------------------------
            await page.goto(`/app/clients/${manifest.clientOrgA.id}`);
            await expect(page).toHaveURL(new RegExp(`/app/clients/${manifest.clientOrgA.id}`));

            const addLeButton = page.getByRole('button', { name: /Add Legal Entity/i }).first();
            await expect(addLeButton).toBeVisible();
            await addLeButton.click();

            // Modal dialog opens
            const createDialog = page.locator('[role="dialog"]').or(page.locator('[data-state="open"]')).first();
            await expect(createDialog).toBeVisible();

            // Fill in Name & Jurisdiction using exact placeholder/label locators (bypassing LEI lookup top input)
            const nameInput = createDialog.locator('input[placeholder="Acme Corp Ltd"]').or(createDialog.getByLabel('Entity Name')).first();
            await expect(nameInput).toBeVisible();
            await nameInput.fill(testLEIdName);

            const jurisdictionInput = createDialog.locator('input[placeholder*="UK, Delaware"]').or(createDialog.getByLabel('Jurisdiction')).first();
            if (await jurisdictionInput.isVisible()) {
                await jurisdictionInput.fill('United Kingdom');
            }

            // Click Create Legal Entity button
            const submitBtn = createDialog.getByRole('button', { name: 'Create Legal Entity' }).first();
            await submitBtn.click();

            // Step 2: Click Finish setup
            const finishBtn = createDialog.getByRole('button', { name: /Finish setup|Done|Skip for now/i }).first();
            await expect(finishBtn).toBeVisible({ timeout: 15000 });
            await finishBtn.click();

            // ---------------------------------------------------------------------
            // STEP 2: Find created ClientLE & Navigate to Master Data View
            // ---------------------------------------------------------------------
            const leLink = page.getByText(testLEIdName).first();
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

            // Ensure NO error toasts or banners are present
            await expect(page.getByText('Could not resolve LegalEntity subject')).not.toBeVisible();

            // ---------------------------------------------------------------------
            // STEP 3: TEST LEGAL NAME - Open Field 3 Drawer, Enter Legal Name, Save
            // ---------------------------------------------------------------------
            const field3Inspect = page.locator('div[role="button"][aria-label*="Inspect field 3"]').or(page.getByText(/Legal Name/i)).first();
            await expect(field3Inspect).toBeVisible();
            await field3Inspect.click();

            const drawer = page.locator('[role="dialog"]').or(page.locator('[data-state="open"]')).first();
            await expect(drawer).toBeVisible();

            const drawerInput = drawer.locator('input[type="text"]').first();
            if (await drawerInput.isVisible()) {
                await drawerInput.fill(legalNameInput);

                const saveBtn = drawer.getByRole('button', { name: /save|update/i }).first();
                if (await saveBtn.isVisible()) {
                    await saveBtn.click();
                }
            }

            // Verify NO "Could not resolve LegalEntity subject" error appears
            await expect(page.getByText('Could not resolve LegalEntity subject')).not.toBeVisible();

            // ---------------------------------------------------------------------
            // STEP 4: VERIFY READ-BACK & PERSISTENCE
            // ---------------------------------------------------------------------
            await page.reload();
            await expect(page).toHaveURL(new RegExp(`/app/le/${createdClientLEId}/master`));
            await expect(page.getByText('Could not resolve LegalEntity subject')).not.toBeVisible();
            await expect(page.getByText(legalNameInput)).toBeVisible();

            // ---------------------------------------------------------------------
            // STEP 5: VERIFY CROSS-DOSSIER ISOLATION
            // ---------------------------------------------------------------------
            await page.goto(`/app/le/${manifest.betaClientLE.id}/master`);
            await expect(page.getByText(legalNameInput)).not.toBeVisible();

        } finally {
            // ---------------------------------------------------------------------
            // STEP 6: TEARDOWN - Clean up created ClientLE
            // ---------------------------------------------------------------------
            if (createdClientLEId) {
                // Navigate to LE settings or trigger teardown API
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
