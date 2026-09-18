import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envUatLocal = path.resolve(process.cwd(), '.env.uat.local');
const uatPassword = fs.existsSync(envUatLocal) ? dotenv.parse(fs.readFileSync(envUatLocal)).UAT_PASSWORD : process.env.UAT_PASSWORD;

// Force local dev DATABASE_URL from .env
const envLocalDb = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env'))).DATABASE_URL;
process.env.DATABASE_URL = envLocalDb;
process.env.UAT_PASSWORD = uatPassword;

const prisma = new PrismaClient();
const CLIENT_LE_ID = '94e35f5f-bb16-44da-ac34-8480baf9aabb'; // UAT Alpha Limited

async function loginIfNeeded(page: any) {
    const uatPassword = process.env.UAT_PASSWORD;
    if (!uatPassword) {
        throw new Error('UAT_PASSWORD not found in environment');
    }

    await page.goto('/login');
    const emailInput = page.getByLabel('Email');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Logging in as uat+le-admin-alpha@onpro.tech...');
        await emailInput.fill('uat+le-admin-alpha@onpro.tech');
        await page.getByLabel('Password').fill(uatPassword);
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL((url: any) => !url.pathname.includes('/login'), { timeout: 20000 });
    }
}

async function ensureFieldVisible(page: any, fieldName: string) {
    const expandAll = page.getByRole('button', { name: 'Expand all' });
    if (await expandAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expandAll.click();
        await page.waitForTimeout(500);
    }
    const searchInput = page.getByPlaceholder('Search fields...');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill(fieldName);
        await page.waitForTimeout(500);
    }
}

test.describe('ONP-203 — Localhost Browser Verification (F134 & F143)', () => {
    test.setTimeout(120000);

    test.beforeAll(async () => {
        // Ensure F134 has raw code 'GB' in DB for UAT Alpha Limited
        await prisma.fieldClaim.deleteMany({
            where: { clientLEId: CLIENT_LE_ID, fieldNo: { in: [134, 143] } }
        });
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 134,
                clientLEId: CLIENT_LE_ID,
                valueText: 'GB',
                sourceType: 'GLEIF',
                sourceReference: 'entity.jurisdiction',
                status: 'ASSERTED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });
    });

    test('1. F134 — Country of formation: displays expanded label, edits as TEXT without combobox, preserves raw code and optionSetId', async ({ page }) => {
        await loginIfNeeded(page);

        const masterUrl = `/app/le/${CLIENT_LE_ID}/master`;
        console.log(`Navigating to ${masterUrl}...`);
        await page.goto(masterUrl, { waitUntil: 'networkidle' });

        await ensureFieldVisible(page, 'Country of formation');

        // A. Verify /master row displays the expanded GLEIF label
        const fieldRow = page.locator('[data-testid="master-field-134"]');
        await expect(fieldRow).toBeVisible({ timeout: 15000 });
        await expect(fieldRow).toContainText('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
        console.log('✓ /master row displays expanded GLEIF label: GB – United Kingdom of Great Britain and Northern Ireland');

        // B. Open RHS drawer
        await fieldRow.click();
        const sheet = page.locator('[role="dialog"]').first();
        await expect(sheet).toBeVisible({ timeout: 10000 });
        await expect(sheet).toContainText('GB \u2013 United Kingdom of Great Britain and Northern Ireland');
        console.log('✓ RHS drawer displays expanded label');

        // C. Open manual edit
        const editButton = sheet.getByRole('button', { name: /Add value|Edit/i }).first();
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        // D. Confirm opening manual edit does NOT render the 324-entry jurisdiction combobox
        const combobox = sheet.getByRole('combobox');
        const isComboboxVisible = await combobox.isVisible({ timeout: 1500 }).catch(() => false);
        expect(isComboboxVisible).toBe(false);
        console.log('✓ Manual edit does NOT render combobox (confirmed isComboboxVisible: false)');

        // E. Confirm F134 retains its existing TEXT editor behaviour (standard input element)
        const textInput = sheet.locator('input[type="text"], input:not([type])').first();
        await expect(textInput).toBeVisible({ timeout: 5000 });
        const inputValue = await textInput.inputValue();
        console.log(`✓ F134 renders as standard text input with value: "${inputValue}"`);

        // F. Cancel edit mode
        const cancelButton = sheet.getByRole('button', { name: /Cancel/i }).first();
        if (await cancelButton.isVisible()) {
            await cancelButton.click();
        } else {
            await page.keyboard.press('Escape');
        }

        // Close drawer
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // G. Verify in database: underlying FieldClaim remains raw code 'GB'
        const claim = await prisma.fieldClaim.findFirst({
            where: { clientLEId: CLIENT_LE_ID, fieldNo: 134 }
        });
        expect(claim?.valueText).toBe('GB');
        console.log('✓ Underlying FieldClaim raw value remains: "GB"');

        // H. Verify in database: masterFieldDefinition still has optionSetId intact
        const fieldDef = await prisma.masterFieldDefinition.findUnique({
            where: { fieldNo: 134 }
        });
        expect(fieldDef?.optionSetId).toBe('192aa8b1-a1bd-4e69-b50c-a9f06f61cf53');
        console.log('✓ F134 optionSetId remains preserved in DB: 192aa8b1-a1bd-4e69-b50c-a9f06f61cf53');

        // I. Verify subdivision code: update claim to US-DE in database and check UI
        await prisma.fieldClaim.update({
            where: { id: claim!.id },
            data: { valueText: 'US-DE' }
        });
        await page.reload({ waitUntil: 'networkidle' });
        await ensureFieldVisible(page, 'Country of formation');
        await expect(fieldRow).toContainText('US-DE \u2013 Delaware (United States of America)');
        console.log('✓ Subdivision code "US-DE" resolves correctly on /master: "US-DE – Delaware (United States of America)"');

        await fieldRow.click();
        await expect(sheet).toBeVisible({ timeout: 5000 });
        await expect(sheet).toContainText('US-DE \u2013 Delaware (United States of America)');
        console.log('✓ Subdivision code "US-DE" resolves correctly in RHS drawer');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    });

    test('2. F143 — Tax residence 1: renders SELECT/combobox, code and name search work, stores raw code, resolves display label', async ({ page }) => {
        await loginIfNeeded(page);

        const masterUrl = `/app/le/${CLIENT_LE_ID}/master`;
        await page.goto(masterUrl, { waitUntil: 'networkidle' });

        await ensureFieldVisible(page, 'Tax residence 1');

        const fieldRow = page.locator('[data-testid="master-field-143"]');
        await expect(fieldRow).toBeVisible({ timeout: 15000 });
        const inspectButton = fieldRow.getByRole('button', { name: /Inspect field 143/i });
        if (await inspectButton.isVisible()) {
            await inspectButton.click();
        } else {
            await fieldRow.click();
        }

        const sheet = page.locator('[role="dialog"]').first();
        await expect(sheet).toBeVisible({ timeout: 10000 });

        // Open edit mode
        const editButton = sheet.getByRole('button', { name: /Add value|Edit/i }).first();
        await expect(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();

        // Confirm combobox is present
        const comboboxButton = sheet.getByRole('combobox').first();
        await expect(comboboxButton).toBeVisible({ timeout: 5000 });
        console.log('✓ F143 renders as SELECT/combobox');
        await comboboxButton.click();

        // Command popover
        const cmdkInput = page.locator('[cmdk-input]');
        await expect(cmdkInput).toBeVisible({ timeout: 5000 });

        // Search by US-DE
        await cmdkInput.fill('US-DE');
        const usDeItem = page.locator('[cmdk-item]').filter({ hasText: /US-DE/i });
        await expect(usDeItem).toBeVisible({ timeout: 5000 });
        await expect(usDeItem).toContainText('Delaware');
        console.log('✓ Search by code "US-DE" matched:', await usDeItem.innerText());

        // Search by Delaware (name search)
        await cmdkInput.fill('');
        await cmdkInput.fill('Delaware');
        const delawareItem = page.locator('[cmdk-item]').filter({ hasText: /Delaware/i });
        await expect(delawareItem).toBeVisible({ timeout: 5000 });
        await expect(delawareItem).toContainText('US-DE');
        console.log('✓ Search by name "Delaware" matched:', await delawareItem.innerText());

        // Select US-DE – Delaware (United States of America)
        await delawareItem.click();

        // Save
        const saveButton = sheet.getByRole('button', { name: 'Save', exact: true });
        await expect(saveButton).toBeVisible();
        await saveButton.click();

        // Verify read-only display in RHS drawer resolves back to formatted label
        await expect(sheet).toContainText('US-DE \u2013 Delaware (United States of America)');
        console.log('✓ RHS drawer read-only display resolves to: "US-DE – Delaware (United States of America)"');

        // Close drawer
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Verify /master row resolves back to formatted label
        await page.reload({ waitUntil: 'networkidle' });
        await ensureFieldVisible(page, 'Tax residence 1');
        await expect(fieldRow).toContainText('US-DE \u2013 Delaware (United States of America)');
        console.log('✓ /master row resolves to: "US-DE – Delaware (United States of America)"');

        // Verify underlying FieldClaim in DB stores ONLY the raw code 'US-DE'
        const claim = await prisma.fieldClaim.findFirst({
            where: { clientLEId: CLIENT_LE_ID, fieldNo: 143 }
        });
        expect(claim?.valueText).toBe('US-DE');
        console.log('✓ Stored FieldClaim raw value in database is strictly code only: "US-DE"');
    });
});
