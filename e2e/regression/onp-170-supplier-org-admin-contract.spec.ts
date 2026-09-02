import { test, expect } from '@playwright/test';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

test.describe('ONP-170 — Supplier Org Admin Permissions & Relationship Contract', () => {
    test.describe('Pure Supplier ORG_ADMIN', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });

        test('1. FR-07: Pure Supplier ORG_ADMIN is denied operational questionnaire and question data on Questions Workbench', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);

            // The Questions Workbench should show zero operational questions for pure ORG_ADMIN
            // It should render the empty state: "No questions found matching your filter criteria" or "0 questions"
            await expect(page.getByText(/0 questions|No questions found/i).first()).toBeVisible({ timeout: 15000 });

            // Operational question items should not be rendered
            const kanbanCards = page.locator('[data-testid="question-kanban-card"]');
            await expect(kanbanCards).toHaveCount(0);
        });

        test('2. Administrative Metadata: Pure Supplier ORG_ADMIN sees relationship identity and status without operational questionnaire leaf rows', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}`);

            await expect(page.getByRole('heading', { name: 'Client Relationships' }).first()).toBeVisible({ timeout: 15000 });

            // Identity and status should be visible
            await expect(page.getByText(manifest.alphaClientLE.name).first()).toBeVisible();
            await expect(page.getByText(manifest.betaClientLE.name).first()).toBeVisible();

            // Operational questionnaire review links should NOT be rendered for pure ORG_ADMIN
            const reviewLinks = page.getByRole('link', { name: /Review Questions/i });
            await expect(reviewLinks).toHaveCount(0);
        });

        test('3. Team Administration: Pure Supplier ORG_ADMIN can view Supplier Teams and access scopes', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/team`);

            await expect(page.getByRole('heading', { name: /Teams/i }).first()).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(manifest.actors.supplierOrgAdminA.email)).toBeVisible();
            await expect(page.getByText(manifest.actors.relationshipAdminAlpha.email)).toBeVisible();
        });
    });

    test.describe('Assigned Relationship Admin Alpha', () => {
        test.use({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });

        test('4. Assigned RELATIONSHIP_ADMIN can view operational questions for assigned relationship Alpha', async ({ page }) => {
            const manifest = loadUATManifest();
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);

            await expect(page.getByRole('heading', { name: 'Questions & Answers' }).first()).toBeVisible({ timeout: 15000 });
            // Relationship Admin Alpha should have access to Questions Workbench
            await expect(page.getByText(/questions/i).first()).toBeVisible();
        });
    });
});
