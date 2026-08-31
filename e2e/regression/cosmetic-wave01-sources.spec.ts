import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Cosmetic Wave 01 — Track A: Sources / LE UI Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    test.beforeAll(() => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
    });

    test('ONP-98: Companies House source page does not expose obsolete "Preview Extracted Entities" action', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/registry`);
        await page.waitForLoadState('networkidle');

        // On current dev, this assertion FAILS (RED) because ExtractedCandidatesViewer button is present
        const previewBtn = page.getByRole('button', { name: /Preview Extracted Entities/i });
        await expect(previewBtn).not.toBeVisible();
    });

    test('ONP-100: User Parties table omits meaningless Active status column and uses direct Trash2 delete button', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/user-parties`);
        await page.waitForLoadState('networkidle');

        // 1. Status column header must NOT be present
        const statusHeader = page.getByRole('columnheader', { name: /^Status$/i });
        await expect(statusHeader).not.toBeVisible();

        // 2. Meaningless Active badge must NOT be present in rows
        const activeBadge = page.locator('table').getByText(/^Active$/, { exact: true });
        await expect(activeBadge).not.toBeVisible();

        // 3. Row actions must offer direct Delete button with Trash2 icon rather than MoreHorizontal indirection
        const moreActionsTrigger = page.locator('button[aria-label="More actions"]').first();
        await expect(moreActionsTrigger).not.toBeVisible();

        const directDeleteBtn = page.locator('button[aria-label="Delete saved party"], button[title="Delete saved party"]').first();
        await expect(directDeleteBtn).toBeVisible();
    });

    test('ONP-110 (ALREADY COMPLIANT): Header displays official LE name with direct external link to GLEIF', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}`);
        await page.waitForLoadState('networkidle');

        // Verify direct GLEIF external link is present
        const gleifLink = page.locator('header a[href*="search.gleif.org"]').first();
        await expect(gleifLink).toBeVisible();
        await expect(gleifLink).toHaveAttribute('target', '_blank');

        // Verify no obsolete status blob/circle exists next to LE name
        const statusBlob = page.locator('header .status-blob, header .status-dot');
        await expect(statusBlob).not.toBeVisible();
    });

    test('ONP-111 (ALREADY COMPLIANT): GLEIF source page does not show Companies House refresh tile', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/gleif`);
        await page.waitForLoadState('networkidle');

        // Verify no Companies House refresh tile at bottom of GLEIF page
        const chTile = page.getByText(/Companies House Refresh|Refresh Companies House Data/i);
        await expect(chTile).not.toBeVisible();
    });
});
