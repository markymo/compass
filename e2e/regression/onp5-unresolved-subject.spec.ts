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

  // Ensure Entity Name & Jurisdiction fields are populated (handleCreate requires both name & jurisdiction)
  const nameInput = page.locator('input[placeholder="Acme Corp Ltd"]').or(page.getByLabel('Entity Name')).first();
  if (await nameInput.isVisible()) {
    const currentName = await nameInput.inputValue();
    if (!currentName.trim()) {
      await nameInput.fill('HORNSEA 1 LIMITED');
    }
  }

  const jurisdictionInput = page.locator('input[placeholder*="UK, Delaware"]').or(page.getByLabel('Jurisdiction')).first();
  if (await jurisdictionInput.isVisible()) {
    const currentJurisdiction = await jurisdictionInput.inputValue();
    if (!currentJurisdiction.trim()) {
      await jurisdictionInput.fill('United Kingdom');
    }
  }

  // 3. Create Entity & Set Team Access
  await page.getByRole('button', { name: 'Create Legal Entity' }).click();

  // Wait for Step 2 modal to finish loading team members so handleSave populates LE_ADMIN role
  await expect(page.getByText('Loading team members...')).not.toBeVisible({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
  if (await setAdminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await setAdminBtn.click();
  }

  const finishBtn = page.getByRole('button', { name: /Finish setup|Done|Skip for now/i }).first();
  await expect(finishBtn).toBeVisible({ timeout: 15000 });
  await finishBtn.click();

  // 4. Open Created Entity & Inspect Field 3 (Legal Name)
  const leLink = page.getByRole('link', { name: /HORNSEA 1 LIMITED/i }).last();
  await expect(leLink).toBeVisible({ timeout: 10000 });
  const inspectField3Btn = page.locator('div[role="button"][aria-label*="Inspect field 3"]').or(page.getByRole('button', { name: /Inspect field 3/i })).or(page.getByText(/Legal Name/i)).first();
  await expect(inspectField3Btn).toBeVisible({ timeout: 15000 });
  await inspectField3Btn.click();

  // 5. Assert Legal Name contains expected text
  await expect(page.getByLabel('Inspect field 3: Legal name')).toContainText('Hornsea');

  // 6. Teardown: Open Actions Menu & Delete Entity
  const menuButton = page.locator('button[aria-haspopup="menu"]').or(page.getByRole('button', { name: /actions|more|settings/i })).first();
  if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuButton.click();
    const deleteText = page.getByText('Delete').first();
    if (await deleteText.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteText.click();
      const confirmBtn = page.getByRole('button', { name: 'Delete' }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  }
});
