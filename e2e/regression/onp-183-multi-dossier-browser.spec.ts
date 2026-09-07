import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES, loadUATManifest } from '../fixtures/uat-fixture';
import { LegalEntityEnrichmentService } from '../../src/domain/registry/LegalEntityEnrichmentService';

const prisma = new PrismaClient();

const HORNSEA_LEI = '2138002S3XGZ38WN5Q72';
const HORNSEA_NAME = 'HORNSEA 1 LIMITED';
const KEEP_WALES_TIDY_LEI = '213800DU5OTHSN65WH50';

test.describe('ONP-183: Multi-Dossier Isolation & Unsupported Registry Browser Regressions', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(180000);

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY 1: Second dossier for the same canonical LegalEntity
    // ─────────────────────────────────────────────────────────────────────────
    test('Journey 1: Second dossier B displays independent enriched data, correct Companies House provenance, and leaves dossier A intact', async ({ page }) => {
        test.setTimeout(180000);

        const user = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });
        expect(user).toBeDefined();

        // 1. Identify canonical LegalEntity for Hornsea 1 Limited
        const hornseaLE = await prisma.clientLE.findFirst({
            where: { lei: HORNSEA_LEI, isDeleted: false },
            include: { legalEntity: true }
        });
        expect(hornseaLE).toBeDefined();
        expect(hornseaLE?.legalEntityId).toBeDefined();
        const dossierAId = hornseaLE!.id;

        // Ensure user has LE_ADMIN membership on Dossier A
        const existingA = await prisma.membership.findFirst({
            where: { userId: user!.id, clientLEId: dossierAId }
        });
        if (!existingA) {
            await prisma.membership.create({
                data: {
                    userId: user!.id,
                    clientLEId: dossierAId,
                    role: 'LE_ADMIN'
                }
            });
        }

        // Ensure Dossier A is enriched
        await LegalEntityEnrichmentService.bootstrapEntity(dossierAId);

        // Create independent Org B and Dossier B for the same canonical LegalEntity
        const timestamp = Date.now();
        const orgB = await prisma.organization.create({
            data: {
                name: `ONP-183 Test Org B ${timestamp}`,
                types: ['CLIENT']
            }
        });

        const dossierB = await prisma.clientLE.create({
            data: {
                name: HORNSEA_NAME,
                lei: HORNSEA_LEI,
                legalEntityId: hornseaLE!.legalEntityId,
                status: 'ACTIVE',
                owners: {
                    create: {
                        partyId: orgB.id
                    }
                },
                memberships: {
                    create: {
                        userId: user!.id,
                        role: 'LE_ADMIN'
                    }
                }
            }
        });
        const createdDossierBId = dossierB.id;

        try {
            // Enrich Dossier B through normal backend enrichment path
            console.log(`[ONP-183 E2E] Bootstrapping Dossier B (${createdDossierBId})...`);
            const enrichBResult = await LegalEntityEnrichmentService.bootstrapEntity(createdDossierBId);
            expect(enrichBResult.success).toBe(true);

            // Step 1: Navigate to Dossier B Master Record
            await page.goto(`/app/le/${createdDossierBId}/master`);
            await page.waitForLoadState('networkidle');

            // Confirm page loaded and URL matches
            await expect(page).toHaveURL(new RegExp(`/app/le/${createdDossierBId}/master`));

            // Assert no generic enrichment failure banner
            await expect(page.locator('text=Failed to retrieve registry data')).not.toBeVisible();
            await expect(page.locator('text=Application error')).not.toBeVisible();

            // Stable locator for master fields
            const getFieldRow = (fieldNo: number) =>
                page.locator(`[data-testid="master-field-${fieldNo}"]`)
                    .or(page.locator(`[data-field-no="${fieldNo}"]`))
                    .or(page.locator(`[aria-label^="Inspect field ${fieldNo}:"]`))
                    .or(page.locator('div.group').filter({ hasText: new RegExp(`\\bField ${fieldNo}\\b`) }))
                    .first();

            // 1. Assert Legal Name is populated with HORNSEA 1 LIMITED
            const legalNameRow = getFieldRow(3);
            await expect(legalNameRow).toBeVisible({ timeout: 15000 });
            await expect(legalNameRow).toContainText('HORNSEA 1 LIMITED');

            // 2. Assert provenance identifies Companies House (or REGISTRATION_AUTHORITY), not falsely attributed to empty state or GLEIF
            const chBadge = legalNameRow.locator('text=Companies House')
                .or(legalNameRow.locator('text=COMPANIES_HOUSE'))
                .or(legalNameRow.locator('text=Registration Authority'))
                .or(legalNameRow.locator('text=REGISTRATION_AUTHORITY'))
                .first();
            await expect(chBadge).toBeVisible({ timeout: 10000 });

            // 3. Assert populated field does NOT display "Checked: No Data" or "None"
            await expect(legalNameRow.locator('text=None')).not.toBeVisible();
            await expect(legalNameRow.locator('text=Checked: No Data')).not.toBeVisible();

            // 4. Reload page and confirm values remain populated
            await page.reload();
            await page.waitForLoadState('networkidle');
            const legalNameAfterReload = getFieldRow(3);
            await expect(legalNameAfterReload).toBeVisible({ timeout: 15000 });
            await expect(legalNameAfterReload).toContainText('HORNSEA 1 LIMITED');

            // 5. Open Dossier A /master and confirm representative values/provenance remain intact
            await page.goto(`/app/le/${dossierAId}/master`);
            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(new RegExp(`/app/le/${dossierAId}/master`));

            const legalNameRowA = getFieldRow(3);
            await expect(legalNameRowA).toBeVisible({ timeout: 15000 });
            await expect(legalNameRowA).toContainText('HORNSEA 1 LIMITED');
            await expect(legalNameRowA.locator('text=None')).not.toBeVisible();
        } finally {
            // Teardown Dossier B and Org B
            await prisma.membership.deleteMany({ where: { clientLEId: createdDossierBId } });
            await prisma.fieldClaim.deleteMany({ where: { clientLEId: createdDossierBId } });
            await prisma.registryReference.deleteMany({ where: { clientLEId: createdDossierBId } });
            await prisma.clientLEOwner.deleteMany({ where: { clientLEId: createdDossierBId } });
            await prisma.clientLE.delete({ where: { id: createdDossierBId } });
            await prisma.organization.delete({ where: { id: orgB.id } });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY 2: RA000589 Unsupported Registry
    // ─────────────────────────────────────────────────────────────────────────
    test('Journey 2: RA000589 charity renders enriched GLEIF data without registry failure toast or false failure state', async ({ page }) => {
        test.setTimeout(180000);

        // Find existing Keep Wales Tidy entity
        const charityLE = await prisma.clientLE.findFirst({
            where: { lei: KEEP_WALES_TIDY_LEI, isDeleted: false }
        });
        expect(charityLE).toBeDefined();
        const charityLEId = charityLE!.id;

        const user = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });
        expect(user).toBeDefined();

        const existingCharityMembership = await prisma.membership.findFirst({
            where: { userId: user!.id, clientLEId: charityLEId }
        });
        if (!existingCharityMembership) {
            await prisma.membership.create({
                data: {
                    userId: user!.id,
                    clientLEId: charityLEId,
                    role: 'LE_ADMIN'
                }
            });
        }

        // Ensure charity is bootstrapped (transitions RA000589 to UNSUPPORTED, retains GLEIF)
        console.log(`[ONP-183 E2E] Bootstrapping Charity LE (${charityLEId})...`);
        const charityResult = await LegalEntityEnrichmentService.bootstrapEntity(charityLEId);
        expect(charityResult.success).toBe(true);

        // Listen for toast messages during page load
        let failureToastAppeared = false;
        page.on('console', msg => {
            if (msg.text().includes("Some registry data couldn't be retrieved")) {
                failureToastAppeared = true;
            }
        });

        // Step 1: Navigate to Keep Wales Tidy Master Record
        await page.goto(`/app/le/${charityLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Step 2: Assert Master Record renders cleanly
        await expect(page).toHaveURL(new RegExp(`/app/le/${charityLEId}/master`));
        await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });

        // Step 3: Assert available GLEIF-derived data is visible
        const pageContent = page.locator('body');
        await expect(pageContent).toContainText('KEEP WALES TIDY');

        // Step 4: Assert page is NOT presented as enrichment failed
        await expect(page.locator('text=Enrichment Failed')).not.toBeVisible();
        await expect(page.locator('text=Failed to retrieve registry data')).not.toBeVisible();

        // Step 5: BROWSER ASSERTION: Historical toast message MUST NOT appear
        const failureToast = page.getByText("Some registry data couldn't be retrieved. You can continue as normal.");
        await expect(failureToast).not.toBeVisible({ timeout: 3000 });
        expect(failureToastAppeared, 'Registry failure toast must not be logged or displayed').toBe(false);

        // Step 6: Populated source fields do not display "Checked: No Data"
        const legalNameRow = page.locator(`[data-testid="master-field-3"]`)
            .or(page.locator(`[data-field-no="3"]`))
            .or(page.locator('div.group').filter({ hasText: /\bField 3\b/ }))
            .first();

        if (await legalNameRow.isVisible()) {
            await expect(legalNameRow).toContainText('KEEP WALES TIDY');
            await expect(legalNameRow.locator('text=None')).not.toBeVisible();
        }
    });
});
