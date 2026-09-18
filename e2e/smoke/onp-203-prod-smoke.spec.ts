import { test, expect } from '@playwright/test';

const PROD_URL = 'https://onpro.tech';
const ENTITY_ID = 'dad4bec1-f0cf-45d8-9cfd-dfe9f4282e99'; // ZZOOMM PLC

test.describe('ONP-203 Production Smoke - GLEIF Legal Jurisdictions', () => {
  test('verify F134 canonical display on /master and RHS drawer without modifying prod data', async ({ page }) => {
    // 1. Log in
    await page.goto(`${PROD_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'mark@30gram6.com');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to /app or dashboard
    await page.waitForURL(/\/app/, { timeout: 15000 });

    // 2. Navigate to master page of ZZOOMM PLC
    await page.goto(`${PROD_URL}/app/le/${ENTITY_ID}/master`);
    await page.waitForLoadState('networkidle');

    // 3. Find F134 (Country of formation) on /master
    await expect(page.locator('body')).toContainText('Country of formation');

    // Check that the canonical expanded label is displayed:
    // "GB – United Kingdom of Great Britain and Northern Ireland"
    const expectedLabel = 'GB \u2013 United Kingdom of Great Britain and Northern Ireland';
    await expect(page.locator('body')).toContainText(expectedLabel);

    // 4. Click to open RHS drawer
    const f134Cell = page.getByTestId('master-field-134');
    await f134Cell.click();

    // Drawer should open and contain the canonical label
    const drawer = page.locator('[role="dialog"]').first();
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer).toContainText(expectedLabel);

    // 5. Verify manual edit does NOT render a combobox (remains TEXT input)
    const editButton = drawer.getByRole('button', { name: /Add value|Edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editButton.click();
      
      // Verify no combobox with role="combobox"
      const combobox = drawer.getByRole('combobox');
      const isComboboxVisible = await combobox.isVisible({ timeout: 1500 }).catch(() => false);
      expect(isComboboxVisible).toBe(false);

      // Verify a regular text input is rendered with value 'GB'
      const textInput = drawer.locator('input[type="text"], input:not([type])').first();
      await expect(textInput).toBeVisible({ timeout: 5000 });
      const val = await textInput.inputValue();
      expect(val).toBe('GB');

      // Cancel edit - DO NOT SAVE / MUTATE PROD
      const cancelButton = drawer.getByRole('button', { name: /Cancel/i }).first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Close drawer
    await page.keyboard.press('Escape');
  });
});
