import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import prisma from '../../src/lib/prisma';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        try {
            const hornseaLEs = await prisma.clientLE.findMany({
                where: {
                    OR: [
                        { name: { contains: 'HORNSEA', mode: 'insensitive' } },
                        { lei: '2138002S3XGZ38WN5Q72' }
                    ],
                    owners: { some: { partyId: manifest.clientOrgA.id } }
                },
                select: { id: true }
            });

            const leIds = hornseaLEs.map(h => h.id);

            if (leIds.length > 0) {
                // End active ownership links in ClientLEOwner
                await prisma.clientLEOwner.updateMany({
                    where: { clientLEId: { in: leIds } },
                    data: { endAt: new Date() }
                });

                // Soft-delete and archive ClientLE records
                await prisma.clientLE.updateMany({
                    where: { id: { in: leIds } },
                    data: { isDeleted: true, status: 'ARCHIVED' }
                });
                console.log(`\n[beforeAll Cleanup] Successfully cleared ${leIds.length} pre-existing Hornsea entities and ownership links.\n`);
            }
        } catch (e) {
            console.error('[beforeAll Cleanup] DB cleanup error:', e);
        }
    });

    test('Full E2E Visual Lifecycle: Create Hornsea GLEIF Entity -> Grant Admin Access -> Verify Legal Name -> Teardown', async ({ page }) => {
        test.setTimeout(60000);

        const manifest = loadUATManifest();
        const clientOrgId = manifest.clientOrgA.id;

        // ---------------------------------------------------------------------
        // 1. NAVIGATE TO CLIENT ORG DASHBOARD
        // ---------------------------------------------------------------------
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page).toHaveURL(new RegExp(`/app/clients/${clientOrgId}`));

        // ---------------------------------------------------------------------
        // 2. OPEN ADD LEGAL ENTITY MODAL & SEARCH GLEIF FOR HORNSEA
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

        // ---------------------------------------------------------------------
        // 3. CREATE LEGAL ENTITY & TRIGGER SOURCE DATA BOOTSTRAP
        // ---------------------------------------------------------------------
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
        console.log('MASTER RECORD FIELD 3 (LEGAL NAME) PROPAGATED SOURCE VALUE:');
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
