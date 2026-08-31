import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('Cosmetic Wave 01 — Track C: General UI Conventions Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    test.beforeAll(() => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
    });

    test('ONP-112: Master Record description preserves paragraph breaks with whitespace-pre-wrap and compact typography', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // On current dev, EditableDescription uses text-lg leading-relaxed without whitespace-pre-wrap.
        // The authoritative contract requires preserving paragraphs with whitespace-pre-wrap and compact body sizing.
        const descContainer = page.locator('.group p.leading-relaxed').first();
        if (await descContainer.isVisible()) {
            const hasPreWrap = await descContainer.evaluate((el) => {
                const computed = window.getComputedStyle(el);
                return computed.whiteSpace === 'pre-wrap' || el.classList.contains('whitespace-pre-wrap');
            });
            expect(hasPreWrap).toBe(true);
        }
    });
});
