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

    test('ONP-112: Master Record description preserves paragraph breaks with computed whitespace-pre-wrap and compact typography', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Locate description container on Master Record
        const descElement = page.locator('.group p.leading-relaxed').first();
        await expect(descElement).toBeVisible();

        // 1. Authoritative contract: multi-line description must preserve paragraph formatting (computed white-space: pre-wrap)
        const computedStyle = await descElement.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
                whiteSpace: style.whiteSpace,
                fontSize: parseFloat(style.fontSize)
            };
        });

        // On unfixed dev, whiteSpace is 'normal' (FAILS RED)
        expect(computedStyle.whiteSpace).toBe('pre-wrap');

        // On unfixed dev, font-size is 18px (text-lg). Authoritative contract requires compact body sizing (<= 16px)
        expect(computedStyle.fontSize).toBeLessThanOrEqual(16);
    });
});
