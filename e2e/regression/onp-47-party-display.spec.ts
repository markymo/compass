import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PARTY-01 — Canonical party display exposes all saved party data
// Linear: ONP-47

const prisma = new PrismaClient();

test.describe('PARTY-01 / ONP-47 — Canonical Party Display Exposes All Saved Party Data', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    const testEmail = `alexander.hamilton.${Date.now()}@partytest.example`;
    const testForenames = 'Alexander';
    const testSurname = `Hamilton-${Date.now().toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. Creating/editing party in Master UI persists and displays in read-only canonical view without edit mode', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}`);
        await page.waitForLoadState('networkidle');

        // Locate Field 104 in Master Record table
        const fieldRow = page.locator('[data-field-no="104"], tr:has-text("SSI callback contact(s)"), tr:has-text("104")').first();
        await expect(fieldRow).toBeVisible({ timeout: 15000 });

        // Open Field Details Dialog
        await fieldRow.click();
        const dialog = page.getByRole('dialog').first();
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // Click 'Select Party / Contact' or 'Add value'
        const selectPartyButton = dialog.getByRole('button', { name: /Select Party \/ Contact|Add Director|Create Party|Add value/i }).first();
        await expect(selectPartyButton).toBeVisible({ timeout: 10000 });
        await selectPartyButton.click();

        // Click 'Create new person / organisation' in UnifiedPartyPicker
        const createNewButton = page.getByRole('button', { name: /Create new/i }).first();
        await expect(createNewButton).toBeVisible({ timeout: 10000 });
        await createNewButton.click();

        // Fill in Forenames and Surname in CanonicalPartyEditor
        const forenamesInput = page.locator('div:has(> label:has-text("Forenames")) input, input[placeholder*="Forenames"]').first();
        await expect(forenamesInput).toBeVisible({ timeout: 10000 });
        await forenamesInput.fill(testForenames);

        const surnameInput = page.locator('div:has(> label:has-text("Surname")) input, input[placeholder*="Surname"]').first();
        await expect(surnameInput).toBeVisible({ timeout: 10000 });
        await surnameInput.fill(testSurname);

        // Click 'Add Email' and fill in distinctive email
        const addEmailButton = page.getByRole('button', { name: 'Add Email' }).first();
        await expect(addEmailButton).toBeVisible({ timeout: 5000 });
        await addEmailButton.click();

        const emailInput = page.locator('input[placeholder="Email address"], input[type="email"]').first();
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(testEmail);

        // Save & Select
        const saveAndSelectButton = page.getByRole('button', { name: 'Save & Select' }).first();
        await expect(saveAndSelectButton).toBeVisible({ timeout: 10000 });
        await saveAndSelectButton.click();
        await page.waitForLoadState('networkidle');

        // Verify read-only canonical display inside dialog exposes the saved party name AND exact email without edit mode
        await expect(dialog).toContainText(`${testForenames} ${testSurname}`, { timeout: 15000 });
        await expect(dialog).toContainText(testEmail, { timeout: 15000 });

        // Reload page to verify persistence in fresh context
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify row / re-opened dialog retains the canonical party data (name and email) in read-only mode
        const fieldRowAfterReload = page.locator('[data-field-no="104"], tr:has-text("SSI callback contact(s)"), tr:has-text("104")').first();
        await expect(fieldRowAfterReload).toBeVisible({ timeout: 15000 });

        await fieldRowAfterReload.click();
        const dialog2 = page.getByRole('dialog').first();
        await expect(dialog2).toBeVisible({ timeout: 10000 });
        await expect(dialog2).toContainText(`${testForenames} ${testSurname}`, { timeout: 10000 });
        await expect(dialog2).toContainText(testEmail, { timeout: 10000 });
    });
});
