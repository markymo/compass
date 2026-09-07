import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import prisma from '../../src/lib/prisma';

test.describe('ONP-5 Unresolved Subject Full UI Lifecycle Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

    async function cleanupHornseaBaseline(clientOrgId: string) {
        try {
            const matchingLegalEntities = await prisma.legalEntity.findMany({
                where: {
                    OR: [
                        { reference: '2138002S3XGZ38WN5Q72' },
                        { name: { contains: 'HORNSEA', mode: 'insensitive' } }
                    ]
                },
                select: { id: true }
            });
            const legalEntityIds = matchingLegalEntities.map(le => le.id);

            const hornseaLEs = await prisma.clientLE.findMany({
                where: {
                    OR: [
                        { name: { contains: 'HORNSEA', mode: 'insensitive' } },
                        { lei: '2138002S3XGZ38WN5Q72' },
                        ...(legalEntityIds.length > 0 ? [{ legalEntityId: { in: legalEntityIds } }] : [])
                    ],
                    owners: { some: { partyId: clientOrgId } }
                },
                select: { id: true }
            });

            const leIds = hornseaLEs.map(h => h.id);

            // Clean up old FieldClaims to ensure fresh bootstrap enrichment
            await prisma.fieldClaim.deleteMany({
                where: {
                    OR: [
                        ...(leIds.length > 0 ? [{ clientLEId: { in: leIds } }] : []),
                        ...(legalEntityIds.length > 0 ? [{ subjectLeId: { in: legalEntityIds } }] : [])
                    ]
                }
            });

            if (leIds.length > 0) {
                // End active ownership links in ClientLEOwner
                await prisma.clientLEOwner.updateMany({
                    where: { clientLEId: { in: leIds }, partyId: clientOrgId },
                    data: { endAt: new Date() }
                });

                // Soft-delete and archive ClientLE records
                await prisma.clientLE.updateMany({
                    where: { id: { in: leIds } },
                    data: { isDeleted: true, status: 'ARCHIVED' }
                });
                console.log(`\n[Cleanup Baseline] Successfully cleared ${leIds.length} pre-existing Hornsea entities and ownership links for ${clientOrgId}.\n`);
            }
        } catch (e) {
            console.error('[Cleanup Baseline] DB cleanup error:', e);
        }
    }

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        await cleanupHornseaBaseline(manifest.clientOrgA.id);
    });

    test.afterAll(async () => {
        const manifest = loadUATManifest();
        await cleanupHornseaBaseline(manifest.clientOrgA.id);
    });

    test('Full E2E Visual Lifecycle: Create Hornsea GLEIF Entity -> Grant Admin Access -> Verify Legal Name -> Teardown', async ({ page }) => {
        test.setTimeout(180000);

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

        // Wait for GLEIF fetch to finish and populate the form
        await expect(page.getByText('Verified with GLEIF')).toBeVisible({ timeout: 15000 });

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
        // Bootstrap may take several seconds to enrich data; wait for Step 2 to mount
        const finishBtn = page.getByRole('button', { name: 'Finish setup' }).first();
        await expect(finishBtn).toBeVisible({ timeout: 45000 });

        // Wait for team members list to load and select Admin role
        const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
        await expect(setAdminBtn).toBeVisible({ timeout: 20000 });
        await setAdminBtn.click();
        await expect(setAdminBtn).toHaveAttribute('aria-pressed', 'true');

        await expect(finishBtn).toBeEnabled({ timeout: 10000 });
        await finishBtn.click();

        // Ensure permissions are saved and modal dismissed
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 20000 });

        // ---------------------------------------------------------------------
        // 5. OPEN DOSSIER & VERIFY FIELD 3 (LEGAL NAME) ON MASTER RECORD TAB
        // ---------------------------------------------------------------------
        const leLink = page.locator('a[href*="/app/le/"]').filter({ hasText: /HORNSEA 1 LIMITED/i }).first();
        await expect(leLink).toBeVisible({ timeout: 20000 });
        await leLink.click();

        await expect(page).toHaveURL(/\/app\/le\/[a-zA-Z0-9-]+/, { timeout: 15000 });

        const masterRecordTab = page.getByRole('link', { name: 'Master Record' }).or(page.locator('a[href$="/master"]')).first();
        await expect(masterRecordTab).toBeVisible({ timeout: 15000 });
        await masterRecordTab.click();

        await expect(page).toHaveURL(/\/master/, { timeout: 15000 });

        const masterSearch = page.locator('input[placeholder*="Search master fields"]').or(page.getByRole('textbox', { name: /Search/i })).first();
        if (await masterSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
            await masterSearch.fill('Legal Name');
        }

        const field3Row = page.locator('div.group').filter({ hasText: 'Field 3' }).first();
        await expect(field3Row).toBeVisible({ timeout: 15000 });

        // Wait for background enrichment to populate Field 3 (reload if server bootstrap was in flight)
        await expect(async () => {
            const currentText = (await field3Row.textContent()) || '';
            if (!currentText.includes('HORNSEA 1 LIMITED')) {
                await page.reload();
                const search = page.locator('input[placeholder*="Search master fields"]').or(page.getByRole('textbox', { name: /Search/i })).first();
                if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await search.fill('Legal Name');
                }
            }
            await expect(field3Row).toContainText('HORNSEA 1 LIMITED', { timeout: 5000 });
        }).toPass({ timeout: 60000, intervals: [3000, 5000] });

        const actualRowText = await field3Row.textContent();
        console.log('\n========================================');
        console.log('MASTER RECORD FIELD 3 (LEGAL NAME) PROPAGATED SOURCE VALUE:');
        console.log(actualRowText?.trim());
        console.log('========================================\n');

        // ---------------------------------------------------------------------
        // 6. TEARDOWN: CLEAN UP CREATED DOSSIER AT END OF TEST
        // ---------------------------------------------------------------------
        const menuButton = page.locator('button[aria-haspopup="menu"]').or(page.getByRole('button', { name: /actions|more|settings/i })).first();
        if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await menuButton.click();
            const deleteMenuItem = page.getByRole('menuitem', { name: /Delete/i }).or(page.getByText('Delete')).first();
            if (await deleteMenuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                await deleteMenuItem.click();
                const alertDialog = page.locator('[role="alertdialog"]').or(page.locator('[role="dialog"]')).first();
                if (await alertDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const confirmBtn = alertDialog.getByRole('button', { name: 'Delete' }).first();
                    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await confirmBtn.click();
                    }
                }
            }
        }
    });
});
