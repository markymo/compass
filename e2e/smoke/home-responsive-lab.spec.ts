/**
 * RESPONSIVE HOME LAB SMOKE SUITE
 *
 * Validates baseline availability and rendering of the parallel experimental
 * route /app/labs/home-responsive for authenticated users without admin restrictions.
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Responsive Home Lab Smoke Suite', () => {
    test.describe('Client LE Admin Access', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

        test('Loads /app/labs/home-responsive and renders current homepage content', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto('/app/labs/home-responsive');

            await expect(page).toHaveURL(/\/app\/labs\/home-responsive/);
            await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible();
            await expect(page.getByText('Responsive Home Lab').first()).toBeVisible();

            // Confirms the existing current dashboard renderer mounts and displays user's permitted entity
            await expect(page.locator('[data-testid="experimental-dashboard"]')).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
        });
    });

    test.describe('Supplier Org Admin Access', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });

        test('Loads /app/labs/home-responsive for non-admin supplier and renders supplier dashboard', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto('/app/labs/home-responsive');

            await expect(page).toHaveURL(/\/app\/labs\/home-responsive/);
            await expect(page.locator('[data-testid="experimental-dashboard"]')).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(manifest.supplierOrgA.name).first()).toBeVisible();
        });
    });
});
