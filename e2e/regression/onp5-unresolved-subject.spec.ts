import { test, expect } from '@playwright/test';

test.use({
  storageState: 'playwright/.auth/client-org-admin-a.json'
});

test('Full E2E Visual Lifecycle: Create Hornsea 1 Limited -> Inspect Legal Name -> Delete', async ({ page }) => {
  test.setTimeout(60000);

  // 1. Navigate & Open Org Dashboard
  await page.goto('https://dev.onpro.tech/');
  await page.getByRole('link', { name: 'Go to App' }).click();
  await page.getByRole('link', { name: 'UAT Client Org A' }).click();

  // 2. Open Add Legal Entity Modal & Search GLEIF
  await page.getByRole('button', { name: 'Add Legal Entity' }).click();
  await page.getByRole('textbox', { name: 'Start typing company name...' }).fill('Hornsea');
  await page.getByRole('button', { name: 'HORNSEA 1 LIMITED' }).click();

  // 3. Create Entity & Set Team Access
  await page.getByRole('button', { name: 'Create Legal Entity' }).click();
  await page.getByRole('button', { name: 'Set uat+le-admin-alpha@onpro.tech access to Admin' }).click();
  await page.getByRole('button', { name: 'Set uat+le-user-alpha@onpro.tech access to User' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();

  // 4. Open Created Entity & Inspect Field 3 (Legal Name)
  await page.getByRole('link', { name: /HORNSEA 1 LIMITED/i }).first().click();
  await page.getByRole('button', { name: 'Inspect field 3: Legal name' }).click();

  // 5. Assert Legal Name contains expected text
  await expect(page.getByLabel('Inspect field 3: Legal name')).toContainText('Hornsea');

  // 6. Teardown: Open Actions Menu & Delete Entity
  const menuButton = page.locator('button[aria-haspopup="menu"]').or(page.getByRole('button', { name: /actions|more|settings/i })).first();
  await menuButton.click();
  await page.getByText('Delete').first().click();
  await page.getByRole('button', { name: 'Delete' }).click();
});
