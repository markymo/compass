import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: MASTER-05 — Multi-value Master collections support add/edit/delete without corrupting canonical collection state
// Linear: ONP-55

const prisma = new PrismaClient();

test.describe('MASTER-05 / ONP-55 — Multi-Value Master Collection Add/Edit/Delete Operations', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    const testTimestamp = Date.now();
    const entryA = `Trading Name Alpha ${testTimestamp.toString().slice(-4)}`;
    const entryB = `Trading Name Beta ${testTimestamp.toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const clientLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');
        clientLEId = clientLE.id;

        // Clean up any test claims on Field 4 (Trading name)
        await prisma.fieldClaim.deleteMany({
            where: {
                clientLEId,
                fieldNo: 4,
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({
                    where: {
                        clientLEId,
                        fieldNo: 4,
                    }
                });
            }
        } catch (err) {
            console.warn('Cleanup error in ONP-55:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Multi-value collection: add entries A & B, assert both present', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 4 card (Trading name)
        const fieldCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });

        // Open inspection drawer
        await fieldCard.locator('[role="button"]').first().click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Add entry A
        const input = drawer.locator('input[type="text"]').last();
        await expect(input).toBeVisible();
        await input.fill(entryA);

        const addBtn = drawer.getByRole('button', { name: /^Add$/i }).first();
        await addBtn.click();
        await page.waitForTimeout(2000);

        // Add entry B
        await input.fill(entryB);
        await addBtn.click();
        await page.waitForTimeout(2000);

        // Reload page to verify persistence across fresh session
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        const reloadedCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(reloadedCard).toContainText(entryA);
        await expect(reloadedCard).toContainText(entryB);
    });

    test('2. Delete entry A, assert entry B remains in collection and entry A is removed', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const fieldCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });
        await fieldCard.locator('[role="button"]').first().click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Locate delete button
        const deleteBtn = drawer.locator('button[title="Remove value"]').first();
        await expect(deleteBtn).toBeVisible({ timeout: 10000 });
        await deleteBtn.click();

        // Confirm removal overlay: "Yes, remove"
        const confirmBtn = drawer.locator('button:has-text("Yes, remove")').first();
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        await confirmBtn.click();

        await page.waitForTimeout(2000);

        // Reload page and assert canonical state
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        const finalCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(finalCard).toContainText(entryB);
        await expect(finalCard).not.toContainText(entryA);
    });
});
