/**
 * CLIENT OPERATIONAL SMOKE SUITE
 *
 * Validates fundamental navigation, page rendering, and operational UI
 * availability for a canonical authorized Client Legal Entity administrator (LE_ADMIN Alpha).
 */

import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Client Operational Smoke Suite', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

    test('Dashboard loads for LE_ADMIN Alpha', async ({ page }) => {
        /**
         * WHY:
         * The authenticated dashboard is the primary entry point for users into OnPro.
         *
         * EXPECT:
         * /app loads normally and visibly displays the user's permitted ClientLE (UAT Alpha Limited).
         *
         * IF THIS FAILS:
         * Check authentication, dashboard loading, or ClientLE visibility calculation.
         */
        const manifest = loadUATManifest();
        await page.goto('/app');

        await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible();
        await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
    });

    test('Alpha Master Data loads', async ({ page }) => {
        /**
         * WHY:
         * Master Data is the core operational surface for managing ClientLE canonical records.
         *
         * EXPECT:
         * /app/le/<alpha>/master loads and visibly displays the seeded Legal Name (UAT Alpha Limited).
         *
         * IF THIS FAILS:
         * Check Master Data routing, FieldClaim resolution, or fixture seeding.
         */
        const manifest = loadUATManifest();
        await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);

        await expect(page).toHaveURL(new RegExp(`/app/le/${manifest.alphaClientLE.id}/master`));
        await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
    });

    test('Alpha Relationships surface loads', async ({ page }) => {
        /**
         * WHY:
         * Managing supplier relationships is a fundamental ClientLE operational workflow.
         *
         * EXPECT:
         * /app/le/<alpha>/relationships loads normally and renders the active connection surface.
         *
         * IF THIS FAILS:
         * Check relationship loading, inherited LE permissions, or fixture FIEngagement data.
         */
        const manifest = loadUATManifest();
        await page.goto(`/app/le/${manifest.alphaClientLE.id}/relationships`);

        await expect(page).toHaveURL(new RegExp(`/app/le/${manifest.alphaClientLE.id}/relationships`));
        await expect(page.getByRole('heading', { name: 'Supplier Relationships' }).first()).toBeVisible();
        await expect(page.getByText(manifest.supplierOrgA.name).first()).toBeVisible();
    });

    test('Alpha Workbench loads', async ({ page }) => {
        /**
         * WHY:
         * Workbench is the primary client questionnaire review and mapping workspace.
         *
         * EXPECT:
         * /app/le/<alpha>/workbench4 initializes successfully without application crashes.
         *
         * IF THIS FAILS:
         * Check Workbench routing, authorization, or component initialization.
         */
        const manifest = loadUATManifest();
        await page.goto(`/app/le/${manifest.alphaClientLE.id}/workbench4`);

        await expect(page).toHaveURL(new RegExp(`/app/le/${manifest.alphaClientLE.id}/workbench4`));
        await expect(page.locator('body')).toBeVisible();
    });

    test('Field 3 detail interaction works', async ({ page }) => {
        /**
         * WHY:
         * Loading the Master Record page alone does not verify that field inspection is interactive and functional.
         *
         * EXPECT:
         * Clicking Field 3 (Legal Name) opens the inspection detail drawer/panel and renders the legal name information.
         *
         * IF THIS FAILS:
         * Check Master field interaction, FieldDetailPanel drawer state, or canonical field rendering.
         */
        const manifest = loadUATManifest();
        await page.goto(`/app/le/${manifest.alphaClientLE.id}/master`);

        const field3Button = page.locator('div[role="button"][aria-label*="Inspect field 3"]').first();
        await expect(field3Button).toBeVisible();
        await field3Button.click();

        // Verify that the FieldDetailPanel sheet opens and displays field details
        await expect(page.locator('[role="dialog"]').or(page.locator('[data-state="open"]')).first()).toBeVisible();
        await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
    });

    test('Account page loads', async ({ page }) => {
        /**
         * WHY:
         * Authenticated users require stable access to their profile and account settings.
         *
         * EXPECT:
         * /app/account loads normally and renders the user's account information and permissions summary.
         *
         * IF THIS FAILS:
         * Check authenticated account routing, layout, or user profile query.
         */
        const manifest = loadUATManifest();
        await page.goto('/app/account');

        await expect(page).toHaveURL(/\/app\/account/);
        await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
        await expect(page.getByLabel('Email Address')).toHaveValue(manifest.actors.leAdminAlpha.email);
    });
});
