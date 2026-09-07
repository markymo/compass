/**
 * CLIENT ORGANISATION SECURITY BOUNDARY
 *
 * ORG_ADMIN can administer the Client organisation and see its ClientLE structure,
 * but does not receive operational Master Data or Relationship access.
 * ORG_MEMBER has account association only and zero operational grants.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Client Organisation Permission Boundaries', () => {
    test.describe('Client ORG_ADMIN', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });

        test('Client ORG_ADMIN sees Alpha structurally on homepage', async ({ page }) => {
            /**
             * WHY:
             * ORG_ADMIN should administer its Client organisation and see ClientLE structure.
             *
             * EXPECT:
             * /app shows UAT Client Org A and UAT Alpha Limited.
             *
             * IF THIS FAILS:
             * Check dashboard structural visibility logic.
             */
            const manifest = loadUATManifest();
            await page.goto('/app');
            await expect(page.getByText(manifest.clientOrgA.name).first()).toBeVisible();
            await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
        });

        test('Client ORG_ADMIN does not see Alpha operational relationship data', async ({ page }) => {
            /**
             * WHY:
             * Structural visibility must not become operational access.
             *
             * EXPECT:
             * Homepage may show Alpha structurally. It must NOT expose Relationship Alpha,
             * Supplier relationship operational data, or operational question metrics that require LE access.
             *
             * IF THIS FAILS:
             * Check structural-vs-operational dashboard authorization.
             */
            const manifest = loadUATManifest();
            await page.goto('/app');
            await expect(page.getByText(manifest.alphaClientLE.name)).toBeVisible();

            // Must NOT expose Supplier Org A relationship operational data or Relationship Alpha
            await expect(page.getByText('Relationship Alpha')).not.toBeVisible();
            await expect(page.getByText(manifest.supplierOrgA.name)).not.toBeVisible();
        });

        test('Client ORG_ADMIN cannot directly open Alpha Master Data', async ({ page }) => {
            /**
             * WHY:
             * ORG_ADMIN does not automatically receive LE_ADMIN / LE_USER rights.
             *
             * EXPECT:
             * /app/le/<alpha>/master is denied and Master Data is not exposed.
             *
             * IF THIS FAILS:
             * Check LE_VIEW_MASTER_DATA authorization and ORG_ADMIN bypasses.
             */
            const manifest = loadUATManifest();
            const response = await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);

            // Assert Master Data values/tabs are not exposed
            await expect(page.getByText('Master Record')).not.toBeVisible();
            await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();

            if (response) {
                expect([200, 403, 404]).toContain(response.status());
            }
        });

        test('Client ORG_ADMIN cannot access a ClientLE belonging to another organisation', async ({ page }) => {
            /**
             * WHY (AUTH-01 / ONP-77):
             * Multi-tenant boundary: Client ORG_ADMIN in Org A must never access
             * ClientLE operational data belonging to Org B via direct URL.
             *
             * EXPECT:
             * /app/le/<beta>/master is denied and UAT Beta Limited Master Data is not exposed.
             *
             * IF THIS FAILS:
             * Check multi-tenant ClientLE authorization and ORG_ADMIN boundaries.
             */
            const manifest = loadUATManifest();
            const response = await page.goto(`/app/le/${manifest.betaClientLE.id}/master`);

            // Assert Master Data values/tabs are not exposed
            await expect(page.getByText('Master Record')).not.toBeVisible();
            await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
            await expect(page.getByText(manifest.betaClientLE.name, { exact: true })).not.toBeVisible();

            if (response) {
                expect([200, 403, 404]).toContain(response.status());
            }
        });
    });

    test.describe('Client ORG_MEMBER', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgMemberA });

        test('Client ORG_MEMBER does not see Alpha operationally', async ({ page }) => {
            /**
             * WHY:
             * ORG_MEMBER is account association only and has zero operational grants.
             *
             * EXPECT:
             * /app does not expose Alpha operational data or Relationship Alpha.
             *
             * IF THIS FAILS:
             * Check ORG_MEMBER grants or dashboard membership expansion.
             */
            const manifest = loadUATManifest();
            await page.goto('/app');

            // Must not see supplier relationship or operational relationship data
            await expect(page.getByText('Relationship Alpha')).not.toBeVisible();
            await expect(page.getByText(manifest.supplierOrgA.name)).not.toBeVisible();
        });
    });
});
