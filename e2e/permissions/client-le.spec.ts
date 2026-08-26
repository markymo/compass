/**
 * CLIENT LEGAL ENTITY SECURITY BOUNDARY
 *
 * LE_ADMIN and LE_USER possess operational Master Data access strictly scoped
 * to their assigned ClientLE. Cross-ClientLE operational access (Alpha -> Beta) is forbidden.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Client Legal Entity Permission Boundaries', () => {
    test.describe('LE_ADMIN Alpha', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

        test('LE_ADMIN Alpha can open Alpha Master Data', async ({ page }) => {
            /**
             * WHY:
             * LE_ADMIN is the primary operational/admin role for Alpha.
             *
             * EXPECT:
             * /app/le/<alpha>/master loads successfully. Field 3 Legal Name visibly renders UAT Alpha Limited.
             *
             * IF THIS FAILS:
             * Check LE membership resolution, Master Data authorization, or synthetic Field 3 fixture.
             */
            const manifest = loadUATManifest();
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);
            await expect(page).toHaveURL(new RegExp(`/app/le/${manifest.alphaClientLE.id}/master`));
            await expect(page.getByText('UAT Alpha Limited').first()).toBeVisible();
        });

        test('LE_ADMIN Alpha cannot open Beta Master Data', async ({ page }) => {
            /**
             * WHY:
             * ClientLE is the client-side security boundary. Access to Alpha must never imply access to Beta.
             *
             * EXPECT:
             * /app/le/<beta>/master is denied and UAT Beta Limited Master Data is not exposed.
             *
             * IF THIS FAILS:
             * Check cross-ClientLE authorization leakage.
             */
            const manifest = loadUATManifest();
            const response = await page.goto(`/app/le/${manifest.betaClientLE.id}/master`);

            await expect(page.getByText('Master Record')).not.toBeVisible();
            await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
            await expect(page.getByText('UAT Beta Limited', { exact: true })).not.toBeVisible();

            if (response) {
                expect([200, 403, 404]).toContain(response.status());
            }
        });
    });

    test.describe('LE_USER Alpha', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.leUserAlpha });

        test('LE_USER Alpha can open Alpha Master Data', async ({ page }) => {
            /**
             * WHY:
             * LE_USER has operational Alpha access.
             *
             * EXPECT:
             * Alpha /master loads and Field 3 renders UAT Alpha Limited.
             *
             * IF THIS FAILS:
             * Check LE_USER operational grants or membership resolution.
             */
            const manifest = loadUATManifest();
            await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);
            await expect(page).toHaveURL(new RegExp(`/app/le/${manifest.alphaClientLE.id}/master`));
            await expect(page.getByText('UAT Alpha Limited').first()).toBeVisible();
        });

        test('LE_USER Alpha cannot open Beta Master Data', async ({ page }) => {
            /**
             * WHY:
             * LE_USER membership must remain scoped to its explicit ClientLE.
             *
             * EXPECT:
             * Beta /master is denied.
             *
             * IF THIS FAILS:
             * Check cross-ClientLE leakage.
             */
            const manifest = loadUATManifest();
            const response = await page.goto(`/app/le/${manifest.betaClientLE.id}/master`);

            await expect(page.getByText('Master Record')).not.toBeVisible();
            await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
            await expect(page.getByText('UAT Beta Limited', { exact: true })).not.toBeVisible();

            if (response) {
                expect([200, 403, 404]).toContain(response.status());
            }
        });
    });
});
