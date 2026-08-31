import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Cosmetic Wave 01 — Track C: General UI Conventions Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    test.beforeAll(() => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
    });

    test('ONP-112 (whitespace): Master Record description preserves paragraph breaks with computed whitespace-pre-wrap', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Locate description container on Master Record
        const descElement = page.locator('.group p.leading-relaxed').first();
        await expect(descElement).toBeVisible();

        // 1. Authoritative contract: multi-line description must preserve paragraph formatting (computed white-space: pre-wrap)
        const computedWhiteSpace = await descElement.evaluate((el) => {
            return window.getComputedStyle(el).whiteSpace;
        });

        // On unfixed dev, whiteSpace is 'normal' (FAILS RED)
        expect(computedWhiteSpace).toBe('pre-wrap');
    });

    test('ONP-112 (typography): Master Record description uses compact body typography instead of oversized text-lg', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Locate description container on Master Record
        const descElement = page.locator('.group p.leading-relaxed').first();
        await expect(descElement).toBeVisible();

        // 2. Authoritative contract: typography size must be within approved compact body presentation (<= 16px)
        const computedFontSize = await descElement.evaluate((el) => {
            return parseFloat(window.getComputedStyle(el).fontSize);
        });

        // On unfixed dev, font-size is 18px (text-lg). Authoritative contract requires compact body sizing (<= 16px) (FAILS RED)
        expect(computedFontSize).toBeLessThanOrEqual(16);
    });
});
