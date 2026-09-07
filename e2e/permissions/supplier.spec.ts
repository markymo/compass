/**
 * SUPPLIER ORGANISATION & RELATIONSHIP SECURITY BOUNDARY
 *
 * Supplier ORG_ADMIN administers the Supplier organisation but receives no customer
 * relationships automatically. RELATIONSHIP_ADMIN and RELATIONSHIP_USER have
 * explicit engagement-scoped access strictly to their assigned engagement.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Supplier Organisation & Relationship Permission Boundaries', () => {
    test.describe('Supplier ORG_ADMIN', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });

        test('Supplier ORG_ADMIN does not see either customer relationship', async ({ page }) => {
            /**
             * WHY:
             * Supplier ORG_ADMIN administers the Supplier organisation but receives no relationship/customer operational data automatically.
             *
             * EXPECT:
             * /app does NOT expose Relationship Alpha, Relationship Beta, UAT Alpha Limited customer relationship data, or UAT Beta Limited customer relationship data.
             *
             * IF THIS FAILS:
             * Check Supplier organisation membership expansion into FIEngagement visibility.
             */
            const manifest = loadUATManifest();
            await page.goto('/app');
            await expect(page.getByText('Relationship Alpha')).not.toBeVisible();
            await expect(page.getByText('Relationship Beta')).not.toBeVisible();
            await expect(page.getByText(manifest.alphaClientLE.name)).not.toBeVisible();
            await expect(page.getByText(manifest.betaClientLE.name)).not.toBeVisible();
        });
    });

    test.describe('Relationship Admin Alpha', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });

        test('Relationship Admin Alpha cannot access Relationship Beta', async ({ page }) => {
            /**
             * WHY:
             * Supplier relationship roles are explicit FIEngagement-scoped permissions.
             *
             * EXPECT:
             * Relationship Alpha is accessible through the Supplier relationship UI.
             * Relationship Beta must not be accessible.
             *
             * IF THIS FAILS:
             * Check FIEngagement authorization or Supplier organisation-level leakage.
             */
            const manifest = loadUATManifest();

            // 1. Verify Relationship Alpha is visible on dashboard
            await page.goto('/app');
            await expect(page.getByText(manifest.alphaClientLE.name)).toBeVisible();

            // 2. Verify Relationship Beta is NOT visible
            await expect(page.getByText(manifest.betaClientLE.name)).not.toBeVisible();
            await expect(page.getByText('Relationship Beta')).not.toBeVisible();
        });
    });

    test.describe('Relationship User Alpha', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.relationshipUserAlpha });

        test('Relationship User Alpha can access Alpha but not Beta', async ({ page }) => {
            /**
             * WHY:
             * RELATIONSHIP_USER has engagement-scoped worker access strictly for Relationship Alpha.
             *
             * EXPECT:
             * Relationship Alpha is visible on the dashboard, while Relationship Beta is not accessible.
             *
             * IF THIS FAILS:
             * Check RELATIONSHIP_USER role scoping or engagement isolation.
             */
            const manifest = loadUATManifest();

            // 1. Verify Relationship Alpha is visible
            await page.goto('/app');
            await expect(page.getByText(manifest.alphaClientLE.name)).toBeVisible();

            // 2. Verify Relationship Beta is NOT visible
            await expect(page.getByText(manifest.betaClientLE.name)).not.toBeVisible();
            await expect(page.getByText('Relationship Beta')).not.toBeVisible();
        });
    });
});
