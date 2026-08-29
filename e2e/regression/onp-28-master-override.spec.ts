import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: MASTER-04 — A user override of a source-backed Master value becomes the canonical winner and carries the winning claim's provenance
// Linear: ONP-28

const prisma = new PrismaClient();

test.describe('MASTER-04 / ONP-28 — Master Field Override & Provenance Update Lifecycle', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    const testTimestamp = Date.now();
    const initialSourceValue = `213800TESTSOURCELEI${testTimestamp.toString().slice(-4)}`;
    const manualOverrideValue = `213800MANUALOVERRIDE${testTimestamp.toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const clientLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');
        clientLEId = clientLE.id;

        // Clean up any test claims on Field 2 (LEI)
        await prisma.fieldClaim.deleteMany({
            where: {
                clientLEId,
                fieldNo: 2,
            }
        });

        // Seed initial lower-priority source claim (GLEIF) with historical validation date
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                fieldNo: 2,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'GLEIF',
                sourceReference: 'GLEIF-LEI-DATA',
                valueJson: initialSourceValue,
                assertedAt: new Date('2025-01-15T09:00:00.000Z'),
                verifiedAt: new Date('2025-01-15T09:00:00.000Z'),
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({
                    where: {
                        clientLEId,
                        fieldNo: 2,
                    }
                });
            }
        } catch (err) {
            console.warn('Cleanup error in ONP-28:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Baseline: displays source claim with GLEIF badge and historical Last validated date', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 2 card (LEI)
        const fieldCard = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });

        // Assert initial source value is visible
        await expect(fieldCard).toContainText(initialSourceValue);

        // Assert source badge shows GLEIF
        await expect(fieldCard.locator('text=/GLEIF/i').first()).toBeVisible();

        // Assert historical validation date (15 Jan 2025)
        await expect(fieldCard.locator('text=/Last validated/i').first()).toBeVisible();
        await expect(fieldCard.locator('text=/15 Jan 2025/i').first()).toBeVisible();
    });

    test('2. User overrides value via UI drawer; winner becomes User Input with refreshed provenance', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const fieldCard = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });

        // Click to open inspection/edit drawer
        await fieldCard.locator('[role="button"]').first().click();

        // Locate drawer
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Click Edit button in drawer
        const editButton = drawer.locator('button[title="Edit value"], button[title="Add value"]').first();
        await expect(editButton).toBeVisible({ timeout: 10000 });
        await editButton.click();

        // Fill in manual override value
        const input = drawer.locator('input[type="text"], textarea').first();
        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill(manualOverrideValue);

        // Click Save
        const saveButton = drawer.getByRole('button', { name: /Save/i }).first();
        await expect(saveButton).toBeVisible({ timeout: 10000 });
        await saveButton.click();

        // Wait for save to complete
        await page.waitForTimeout(2000);

        // Assert field card now displays manual override value as canonical winner
        await expect(fieldCard).toContainText(manualOverrideValue);

        // Assert source badge is now User Input
        await expect(fieldCard.locator('text=/User input/i').first()).toBeVisible();

        // Assert historical 2025 date is NO LONGER shown for the active winning value
        await expect(fieldCard.locator('text=/15 Jan 2025/i')).toHaveCount(0);

        // Reload page to verify persistence across fresh session
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        const reloadedCard = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(reloadedCard).toContainText(manualOverrideValue);
        await expect(reloadedCard.locator('text=/User input/i').first()).toBeVisible();

        // Open inspection drawer on reloaded page to verify full provenance history
        await reloadedCard.locator('[role="button"]').first().click();
        const reloadedDrawer = page.locator('[role="dialog"]').first();
        await expect(reloadedDrawer).toBeVisible({ timeout: 10000 });

        // Verify active winner in drawer has User Input provenance
        const winningClaimRow = reloadedDrawer.locator(`div:has-text("${manualOverrideValue}")`).first();
        await expect(winningClaimRow).toBeVisible();
        await expect(winningClaimRow.locator('text=/User input/i').first()).toBeVisible();
    });
});
