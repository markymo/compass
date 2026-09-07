import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: MASTER-05 — Multi-value Master collections support add/edit/delete without corrupting canonical collection state
// Linear: ONP-55
// Field under test: Field 4 (Trading name — multi-value scalar text collection)

const prisma = new PrismaClient();

test.describe('MASTER-05 / ONP-55 — Multi-Value Master Collection Add/Edit/Delete Lifecycle', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    const testTimestamp = Date.now();
    const entryA = `Trading Name Alpha ${testTimestamp.toString().slice(-4)}`;
    const entryA2 = `Trading Name Alpha-Edited ${testTimestamp.toString().slice(-4)}`;
    const entryB = `Trading Name Beta ${testTimestamp.toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const alphaLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] },
            include: { owners: true }
        });
        if (!alphaLE) throw new Error('uat_cle_alpha not found in database');

        const leAdminUser = await prisma.user.findUnique({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!leAdminUser) throw new Error(`LE Admin user ${manifest.actors.leAdminAlpha.email} not found`);

        // Shared-fixture preservation: create a fully disposable synthetic ClientLE
        const disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `uat_cle_onp55_${testTimestamp}`,
                name: `Disposable CLE ONP-55 ${testTimestamp}`,
                owners: {
                    create: {
                        partyId: alphaLE.owners[0]?.partyId || alphaLE.id
                    }
                },
                memberships: {
                    create: {
                        userId: leAdminUser.id,
                        role: 'LE_ADMIN'
                    }
                }
            }
        });
        clientLEId = disposableLE.id;
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLE.delete({ where: { id: clientLEId } }).catch(() => {});
            }
        } catch (err) {
            console.warn('Cleanup error in ONP-55:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Multi-value collection: add entries A & B, assert both present after reload', async ({ page }) => {
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

    test('2. Edit entry A to A2 via UI drawer; assert A2 + B present and old A absent after reload', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const fieldCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });
        await fieldCard.locator('[role="button"]').first().click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Locate entry A row and click its Edit button
        const entryARow = drawer.locator('div', { hasText: entryA }).filter({ has: page.locator('button[title="Edit value"]') }).first();
        await expect(entryARow).toBeVisible({ timeout: 10000 });

        const editBtn = entryARow.locator('button[title="Edit value"]').first();
        await editBtn.click();

        // Fill in edited value A2
        const inlineInput = entryARow.locator('input[type="text"]').first();
        await expect(inlineInput).toBeVisible({ timeout: 5000 });
        await inlineInput.fill(entryA2);

        // Save inline edit
        const saveEditBtn = entryARow.locator('button[title="Save value"]').first();
        await expect(saveEditBtn).toBeVisible({ timeout: 5000 });
        await saveEditBtn.click();

        await page.waitForTimeout(2000);

        // Reload page to verify canonical collection state
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        const reloadedCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(reloadedCard).toContainText(entryA2);
        await expect(reloadedCard).toContainText(entryB);
        await expect(reloadedCard).not.toContainText(entryA);
    });

    test('3. Delete entry A2; assert entry B remains in collection and A2 is removed after reload', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const fieldCard = page.locator('[data-testid="master-field-4"], [data-field-no="4"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });
        await fieldCard.locator('[role="button"]').first().click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Locate delete button for entry A2
        const entryA2Row = drawer.locator('div', { hasText: entryA2 }).filter({ has: page.locator('button[title="Remove value"]') }).first();
        await expect(entryA2Row).toBeVisible({ timeout: 10000 });

        const deleteBtn = entryA2Row.locator('button[title="Remove value"]').first();
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
        await expect(finalCard).not.toContainText(entryA2);
        await expect(finalCard).not.toContainText(entryA);
    });
});
