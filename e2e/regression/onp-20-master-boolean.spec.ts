import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: MASTER-01 — Boolean Master fields use boolean editing semantics
// Linear: ONP-20

const prisma = new PrismaClient();

test.describe('MASTER-01 / ONP-20 — Boolean Master Fields Semantics & Display', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    const fieldNo = 243; // 'Cleared derivative trading only?' (BOOLEAN)

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. Master UI presents boolean constrained editor (Yes/No), saves and persists canonical boolean state', async ({ page }) => {
        // Navigate to Client LE Master Record page
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 243 row in Master Record
        const fieldRow = page.locator(`[data-field-no="${fieldNo}"], tr:has-text("Cleared derivative trading only?")`).first();
        await expect(fieldRow).toBeVisible({ timeout: 15000 });

        // Open Field Details Dialog
        await fieldRow.click();
        const dialog = page.getByRole('dialog').first();
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // Click 'Add value' or 'Edit' button inside dialog
        const addOrEditButton = dialog.getByRole('button', { name: /Add value|Edit value|Edit|Override/i }).first();
        await expect(addOrEditButton).toBeVisible({ timeout: 10000 });
        await addOrEditButton.click();

        // Assert editor renders Yes/No constrained SelectTrigger, NOT arbitrary text input
        const selectTrigger = dialog.locator('[role="combobox"]').first();
        await expect(selectTrigger).toBeVisible({ timeout: 5000 });
        await selectTrigger.click();

        // Select 'Yes'
        const yesOption = page.getByRole('option', { name: 'Yes', exact: true }).first();
        await expect(yesOption).toBeVisible({ timeout: 5000 });
        await yesOption.click();

        // Save Value
        const saveButton = dialog.getByRole('button', { name: /Save|Confirm/i }).first();
        await expect(saveButton).toBeVisible({ timeout: 5000 });
        await saveButton.click();
        await page.waitForTimeout(1500);

        // Verify Authoritative Value in dialog shows 'Yes'
        await expect(dialog).toContainText('Yes', { timeout: 10000 });

        // Close dialog
        const closeButton = dialog.getByRole('button', { name: 'Close' }).first();
        await closeButton.click();
        await expect(dialog).not.toBeVisible();

        // Reload page to verify persistence on deployed staging
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Re-open Field 243 dialog and verify persistence of 'Yes'
        const fieldRowAfterReload = page.locator(`[data-field-no="${fieldNo}"], tr:has-text("Cleared derivative trading only?")`).first();
        await expect(fieldRowAfterReload).toBeVisible({ timeout: 15000 });
        await fieldRowAfterReload.click();
        const dialog2 = page.getByRole('dialog').first();
        await expect(dialog2).toBeVisible({ timeout: 10000 });
        await expect(dialog2).toContainText('Yes');

        // Now edit and flip to 'No'
        const editButton2 = dialog2.getByRole('button', { name: /Add value|Edit value|Edit|Override/i }).first();
        await expect(editButton2).toBeVisible({ timeout: 5000 });
        await editButton2.click();

        const selectTrigger2 = dialog2.locator('[role="combobox"]').first();
        await expect(selectTrigger2).toBeVisible({ timeout: 5000 });
        await selectTrigger2.click();

        const noOption = page.getByRole('option', { name: 'No', exact: true }).first();
        await expect(noOption).toBeVisible({ timeout: 5000 });
        await noOption.click();

        const saveButton2 = dialog2.getByRole('button', { name: /Save|Confirm/i }).first();
        await expect(saveButton2).toBeVisible({ timeout: 5000 });
        await saveButton2.click();
        await page.waitForLoadState('networkidle');

        // Verify Authoritative Value in dialog shows 'No'
        await expect(dialog2).toContainText('No', { timeout: 10000 });

        // Close dialog and reload to verify persistence of 'No'
        const closeButton2 = dialog2.getByRole('button', { name: 'Close' }).first();
        await closeButton2.click();

        await page.reload();
        await page.waitForLoadState('networkidle');

        const fieldRowFinal = page.locator(`[data-field-no="${fieldNo}"], tr:has-text("Cleared derivative trading only?")`).first();
        await fieldRowFinal.click();
        const dialogFinal = page.getByRole('dialog').first();
        await expect(dialogFinal).toBeVisible({ timeout: 10000 });
        await expect(dialogFinal).toContainText('No');
    });
});
