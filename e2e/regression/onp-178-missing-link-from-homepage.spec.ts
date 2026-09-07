import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-178: Missing link from homepage to Organization view page', () => {
    test.describe('Client Organisation Header Navigation', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

        test('Client organization name on homepage must link directly to organization view page (/app/clients/[id])', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto('/app');

            // Confirm homepage loaded and organization card is present
            await expect(page.getByText(manifest.clientOrgA.name).first()).toBeVisible({ timeout: 15000 });

            // "Organisation Totals" row already links to the client view page
            const orgTotalsLink = page.getByRole('link', { name: /Organisation Totals/i });
            await expect(orgTotalsLink).toBeVisible();
            await expect(orgTotalsLink).toHaveAttribute('href', `/app/clients/${manifest.clientOrgA.id}`);

            // DEFECT UNDER TEST (ONP-178):
            // The Organization Name in the section header should be a clickable link taking the user
            // to the Organization view page (/app/clients/[clientId]), but currently renders as a static span.
            const orgNameLink = page.getByRole('link', { name: manifest.clientOrgA.name, exact: true });
            await expect(orgNameLink).toBeVisible();
            await expect(orgNameLink).toHaveAttribute('href', `/app/clients/${manifest.clientOrgA.id}`);

            // Clicking the organization name link must navigate to the organization view page
            await orgNameLink.click();
            await expect(page).toHaveURL(new RegExp(`/app/clients/${manifest.clientOrgA.id}`), { timeout: 15000 });
        });
    });

    test.describe('Supplier Organisation Header Navigation', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });

        test('Supplier organization name on homepage must link directly to supplier organization view page (/app/s/[id])', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto('/app');

            // Confirm homepage loaded and organization card is present
            await expect(page.getByText(manifest.supplierOrgA.name).first()).toBeVisible({ timeout: 15000 });

            // "Organisation Totals" row already links to the supplier view page
            const orgTotalsLink = page.getByRole('link', { name: /Organisation Totals/i });
            await expect(orgTotalsLink).toBeVisible();
            await expect(orgTotalsLink).toHaveAttribute('href', `/app/s/${manifest.supplierOrgA.id}`);

            // DEFECT UNDER TEST (ONP-178):
            // The Organization Name in the section header should be a clickable link taking the user
            // to the Supplier Organization view page (/app/s/[fiId]), but currently renders as a static span.
            const orgNameLink = page.getByRole('link', { name: manifest.supplierOrgA.name, exact: true });
            await expect(orgNameLink).toBeVisible();
            await expect(orgNameLink).toHaveAttribute('href', `/app/s/${manifest.supplierOrgA.id}`);

            // Clicking the organization name link must navigate to the supplier view page
            await orgNameLink.click();
            await expect(page).toHaveURL(new RegExp(`/app/s/${manifest.supplierOrgA.id}`), { timeout: 15000 });
        });
    });
});
