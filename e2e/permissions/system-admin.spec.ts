/**
 * SYSTEM ADMIN SECURITY BOUNDARY
 *
 * SYSTEM_ADMIN is restricted to platform administration and must not
 * inherit customer operational data access (such as ClientLE Master Data).
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('System Admin Permission Boundaries', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.systemAdmin });

    test('System Admin can access platform administration', async ({ page }) => {
        /**
         * WHY:
         * System Admin should still be able to perform platform administration despite losing god-mode customer data access.
         *
         * EXPECT:
         * Can load an appropriate stable System Admin page such as /app/admin/permissions
         * and see the Permissions Model/admin content.
         *
         * IF THIS FAILS:
         * Check SYSTEM_ADMIN platform authorization or admin routing.
         */
        await page.goto('/app/admin/permissions');
        await expect(page.getByRole('heading', { name: 'Permissions Model', level: 1 })).toBeVisible();
        await expect(page.getByText('Internal • System Admin only')).toBeVisible();
    });

    test('System Admin cannot access Alpha Master Data', async ({ page }) => {
        /**
         * WHY:
         * SYSTEM_ADMIN is platform administration, not customer operational access.
         *
         * EXPECT:
         * Direct navigation to /app/le/<alpha>/master does not reveal Alpha Master Data.
         *
         * IF THIS FAILS:
         * Check SYSTEM_ADMIN bypasses and ClientLE authorization.
         */
        const manifest = loadUATManifest();
        const response = await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);

        // Operational Master Data tab/claims must NOT be exposed
        await expect(page.getByText('Master Record')).not.toBeVisible();
        await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
        await expect(page.getByText('UAT Alpha Limited', { exact: true })).not.toBeVisible();

        if (response) {
            expect([200, 403, 404]).toContain(response.status());
        }
    });
});
