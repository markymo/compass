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

    test('System Admin organisation management does not expose ClientLE operational dossier access', async ({ page }) => {
        /**
         * WHY (AUTH-02 / ONP-73):
         * Platform admin organisation management views must never provide direct routes, controls,
         * or active bridges into customer operational Master Data records.
         *
         * EXPECT:
         * 1. Navigating to /app/admin/organizations/<orgId> loads the admin organisation view.
         * 2. The admin surface does not contain direct links to /app/le/<id>/master or operational data surfaces.
         * 3. Any attempt to follow an entity link or direct URL to /app/le/<id>/master denies Master Data access.
         *
         * IF THIS FAILS:
         * Check admin organization ClientLE table and Manage LE links for Master Data leakage.
         */
        const manifest = loadUATManifest();
        await page.goto('/app/admin/organizations');
        await expect(page.getByRole('heading', { name: 'Organization Management' })).toBeVisible();

        // Verify clientOrgA is present in the admin organizations list and navigate to its detail
        const orgRow = page.getByRole('row', { name: new RegExp(manifest.clientOrgA.name, 'i') });
        await expect(orgRow).toBeVisible();
        await orgRow.getByRole('link', { name: 'Manage' }).click();

        // Verify admin organization surface loads
        await expect(page.getByRole('heading', { level: 1 })).toContainText(manifest.clientOrgA.name);

        // Verify Archive / Unarchive controls are NOT present (ONP-81)
        await expect(page.getByRole('button', { name: /Archive Organization/i })).not.toBeVisible();
        await expect(page.getByRole('button', { name: /Unarchive Organization/i })).not.toBeVisible();

        // Check if Legal Entities tab exists and switch to it
        const entitiesTabBtn = page.getByRole('button', { name: /Legal Entities/i }).or(page.getByText('Legal Entities')).first();
        if (await entitiesTabBtn.isVisible()) {
            await entitiesTabBtn.click();
        }

        // Verify ClientLE names remain visible as administrative metadata
        await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();

        // Structural check: Assert no link in the admin UI directly links to /app/le/ operational dossiers
        const leOperationalLinks = page.locator('a[href*="/app/le/"]');
        await expect(leOperationalLinks).toHaveCount(0);
        const leMasterLinks = page.locator('a[href*="/app/le/"][href*="/master"]');
        await expect(leMasterLinks).toHaveCount(0);

        // Security boundary check: Confirm direct operational navigation remains strictly denied
        const masterResponse = await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);
        await expect(page.getByText('Master Record')).not.toBeVisible();
        await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
        await expect(page.getByText(manifest.alphaClientLE.name, { exact: true })).not.toBeVisible();
        if (masterResponse) {
            expect([200, 403, 404]).toContain(masterResponse.status());
        }
    });

    test('System Admin can open reference-library questionnaire administration', async ({ page }) => {
        /**
         * WHY (AUTH-03 / ONP-74):
         * System Admin is responsible for maintaining OnPro reference-library questionnaire templates
         * and must be able to open and administer them via /app/admin/questionnaires-v2 without encountering "Not found".
         *
         * EXPECT:
         * 1. /app/admin/questionnaires-v2 loads with HTTP 200 and renders the Questionnaires heading.
         * 2. Navigating to the reference questionnaire administration opens the QuestionnaireManager.
         * 3. The page does not render "Questionnaire not found" or "Not found".
         *
         * IF THIS FAILS:
         * Check questionnaire authorization for SYSTEM_ADMIN or questionnaires-v2 routing.
         */
        const manifest = loadUATManifest();
        const refQ = manifest.referenceQuestionnaire;
        if (!refQ) {
            throw new Error('referenceQuestionnaire not found in UAT manifest. Please run npm run uat:seed.');
        }

        // 1. Navigate to questionnaires-v2 explorer
        await page.goto('/app/admin/questionnaires-v2?tab=reference');
        await expect(page.getByRole('heading', { name: 'Questionnaires' })).toBeVisible();

        // 2. Open the reference questionnaire via direct URL or UI action
        await page.goto(`/app/admin/questionnaires/${refQ.id}`);

        // 3. Assert the administration surface loads and is NOT "Not found"
        await expect(page.getByText(/questionnaire not found/i)).not.toBeVisible();
        await expect(page.getByText(/404 - page not found/i)).not.toBeVisible();
        await expect(page.getByText('Reference Snapshot').first()).toBeVisible();
    });
});
