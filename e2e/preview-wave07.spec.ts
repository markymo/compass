import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from './fixtures/uat-fixture';

test.describe.configure({ mode: 'serial' });

test.describe('Wave 07 — Preview Verification Pack', () => {

    test('PW07-01 — ONP-23: Experimental Home is now Current', async ({ browser }) => {
        // 1. Client user defaults to promoted Experimental Home without query param
        const clientContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.clientOrgAdminA,
        });
        const clientPage = await clientContext.newPage();
        try {
            await clientPage.goto('/app');
            await expect(clientPage).toHaveURL(/\/app$/);
            await expect(clientPage.locator('[data-testid="experimental-dashboard"]')).toBeVisible({ timeout: 15000 });
            
            // Check organisation/client hierarchy renders
            const manifest = loadUATManifest();
            await expect(clientPage.getByText(manifest.clientOrgA.name).first()).toBeVisible();
            await expect(clientPage.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
        } finally {
            await clientContext.close();
        }

        // 2. System Admin view label & switcher behavior
        const adminContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.systemAdmin,
        });
        const adminPage = await adminContext.newPage();
        try {
            await adminPage.goto('/app');
            const switcher = adminPage.locator('[data-testid="home-variant-switcher"]');
            await expect(switcher).toBeVisible({ timeout: 15000 });

            // Default view is Current (v2)
            const currentBtn = switcher.getByRole('button', { name: 'Current' });
            const classicBtn = switcher.getByRole('button', { name: 'Classic' });
            await expect(currentBtn).toBeVisible();
            await expect(classicBtn).toBeVisible();
            await expect(adminPage.locator('[data-testid="experimental-dashboard"]')).toBeVisible();

            // Switch to Classic (v1)
            await classicBtn.click();
            await expect(adminPage).toHaveURL(/home=v1/, { timeout: 10000 });
            await expect(adminPage.locator('[data-testid="home-variant-switcher"]')).toBeVisible();

            // Switch back to Current (v2)
            await currentBtn.click();
            await expect(adminPage).toHaveURL(/\/app$/, { timeout: 10000 });
            await expect(adminPage.locator('[data-testid="experimental-dashboard"]')).toBeVisible();
        } finally {
            await adminContext.close();
        }
    });

    test('PW07-02 — ONP-23: Supplier Home safety', async ({ browser }) => {
        const supplierContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA,
        });
        const page = await supplierContext.newPage();
        try {
            await page.goto('/app');
            await expect(page.locator('[data-testid="experimental-dashboard"]')).toBeVisible({ timeout: 15000 });

            const manifest = loadUATManifest();
            await expect(page.getByText(manifest.supplierOrgA.name).first()).toBeVisible();

            // Confirm that Client Organization row exists and is NOT a link to unauthorized /app/clients/[id]
            const clientLinks = page.locator('a[href^="/app/clients/"]');
            const clientLinkCount = await clientLinks.count();
            expect(clientLinkCount).toBe(0);

            // Confirm valid supplier navigation is present
            const supplierEngagementLinks = page.locator('a[href*="/app/s/"]');
            const supplierLinkCount = await supplierEngagementLinks.count();
            expect(supplierLinkCount).toBeGreaterThanOrEqual(1);
        } finally {
            await supplierContext.close();
        }
    });

    test('PW07-03 — ONP-37: Registry entity links', async ({ browser }) => {
        // Enriched UAT entity: BENBRACK WIND FARM LIMITED (1115c64f-7614-4035-804a-81f3f59c3a6c)
        // Company number: 12971043 (Companies House)
        // LEI: 894500GL3Z31KK4RYI63 (GLEIF)
        const BENBRACK_LE_ID = '1115c64f-7614-4035-804a-81f3f59c3a6c';

        const adminContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.systemAdmin,
        });
        const page = await adminContext.newPage();
        try {
            await page.goto(`/app/le/${BENBRACK_LE_ID}/master`);
            await page.waitForLoadState('networkidle');

            // 1. Check Companies House Non-ID field (Field 3 Legal Name)
            // Locates the source badge link pointing to UK Companies House entity
            const chBadgeLink = page.locator('a[href*="find-and-update.company-information.service.gov.uk/company/12971043"]').first();
            await expect(chBadgeLink).toBeVisible({ timeout: 15000 });
            await expect(chBadgeLink).toHaveAttribute('target', '_blank');
            await expect(chBadgeLink).toHaveAttribute('rel', /noopener/);

            // 2. Check GLEIF-backed field (LEI / Country of Formation)
            // Locates the source badge link pointing to GLEIF entity
            const gleifBadgeLink = page.locator('a[href*="search.gleif.org/#/record/894500GL3Z31KK4RYI63"]').first();
            await expect(gleifBadgeLink).toBeVisible({ timeout: 15000 });
            await expect(gleifBadgeLink).toHaveAttribute('target', '_blank');
            await expect(gleifBadgeLink).toHaveAttribute('rel', /noopener/);
        } finally {
            await adminContext.close();
        }
    });

    test('PW07-04 — ONP-35: Mapping dropdown category/order', async ({ browser }) => {
        // Working copy questionnaire with editable mapping workbench
        const WORKING_COPY_Q_ID = '073161a9-befe-4f12-ae85-d19a423906ba';

        const adminContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.systemAdmin,
        });
        const page = await adminContext.newPage();
        try {
            await page.goto(`/app/admin/questionnaires/${WORKING_COPY_Q_ID}`);
            await page.waitForLoadState('networkidle');

            // Confirm Questionnaire Manager / Mapper loads
            await expect(page.getByPlaceholder('Questionnaire Name')).toBeVisible({ timeout: 15000 });

            // Click the first mapping trigger button to open dropdown
            const selectFieldBtn = page.getByRole('button', { name: /Select field/i }).first().or(
                page.locator('button:has-text("Select field")').first()
            );
            await expect(selectFieldBtn).toBeVisible({ timeout: 10000 });
            await selectFieldBtn.click();

            // Confirm Command popover opens with configured categories in order
            const popover = page.locator('[cmdk-root], [role="dialog"], [data-radix-popper-content-wrapper]');
            await expect(popover.first()).toBeVisible({ timeout: 5000 });

            // Confirm standard categories appear (e.g. Identity / Registration / etc.)
            const identityCategory = page.locator('[cmdk-group-heading]').getByText(/Identity|Basic Information|Legal Entity/i);
            await expect(identityCategory.first()).toBeVisible();

            // Confirm "Legal name" appears under its category, not under "Other"
            const otherGroup = page.locator('[cmdk-group]:has([cmdk-group-heading]:text-is("Other"))');
            if (await otherGroup.count() > 0) {
                await expect(otherGroup.getByText('Legal name', { exact: true })).toHaveCount(0);
            }
        } finally {
            await adminContext.close();
        }
    });

    test('PW07-05 — ONP-59: Available Institutions verification', async ({ browser }) => {
        const manifest = loadUATManifest();
        const clientContext = await browser.newContext({
            storageState: PERSONA_STORAGE_STATES.leAdminAlpha,
        });
        const page = await clientContext.newPage();
        try {
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);
            await page.waitForLoadState('networkidle');

            // Confirm obsolete 'Available Institutions' text is absent
            await expect(page.getByText('Available Institutions')).toHaveCount(0);

            // Confirm relationship UI is present
            await expect(page.getByText('Active Relationships').or(page.getByText('Relationships'))).toBeVisible({ timeout: 15000 });

            // Click + Add / Connect if present
            const addConnectionBtn = page.getByRole('button', { name: /\+ Add|\+ Connect|Add Relationship|Connect/i }).first();
            if (await addConnectionBtn.count() > 0) {
                await addConnectionBtn.click();
                await page.waitForTimeout(500);

                // In the Add dialog, 'Available Institutions' is absent
                await expect(page.getByText('Available Institutions')).toHaveCount(0);

                // Search input is present
                const searchInput = page.getByPlaceholder(/search|institution|financial/i).or(page.getByRole('searchbox'));
                await expect(searchInput.first()).toBeVisible();
            }
        } finally {
            await clientContext.close();
        }
    });

});
