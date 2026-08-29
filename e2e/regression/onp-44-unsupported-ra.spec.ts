import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import { RegistryConnectorFactory } from '../../src/domain/registry/RegistryConnectorFactory';

// Contract: SRC-03 — Unsupported registration authority fails gracefully without blocking enrichment
// Linear: ONP-44

const prisma = new PrismaClient();

test.describe('SRC-03 / ONP-44 — Unsupported Registration Authority Graceful Handling', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. Registry connector factory returns null for RA000592 (UK FCA) without throwing', async () => {
        const connector = await RegistryConnectorFactory.getConnectorForAuthorityId('RA000592');
        expect(connector).toBeNull();
    });

    test('2. Client LE overview and master surfaces load cleanly on dev.onpro.tech without registry connector failures', async ({ page }) => {
        // Navigate to Client LE page
        await page.goto(`/app/le/${clientLEId}`);
        await page.waitForLoadState('networkidle');

        // Confirm page renders main sections without crash
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Error fetching registry')).not.toBeVisible();
        await expect(page.locator('text=Unhandled Exception')).not.toBeVisible();

        // Navigate to Master tab
        await page.goto(`/app/le/${clientLEId}?tab=master`);
        await page.waitForLoadState('networkidle');

        // Confirm Master table renders successfully
        await expect(page.locator('[data-field-no], tr').first()).toBeVisible({ timeout: 15000 });
    });
});
