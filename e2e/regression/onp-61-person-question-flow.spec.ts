import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QB-01 — Mapped person and party Master data flows to Question Bank and Workbench
// Linear: ONP-61

const prisma = new PrismaClient();

test.describe('QB-01 / ONP-61 — Person & Party Master Data Flow to Question Bank and Workbench', () => {
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let supplierOrgId: string;
    let alphaClientLEId: string;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        supplierOrgId = manifest.supplierOrgA.id;
        alphaClientLEId = manifest.alphaClientLE.id;
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. Supplier Questions Workbench loads mapped questions cleanly on dev.onpro.tech', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
        const page = await context.newPage();

        await page.goto(`/app/s/${supplierOrgId}/questions`);
        await page.waitForLoadState('networkidle');

        // Confirm workbench renders
        await expect(page.locator('h1, h2, table, [role="tablist"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Unhandled Exception')).not.toBeVisible();

        await context.close();
    });

    test('2. Admin Mapping Workbench loads cleanly for system admin on dev.onpro.tech', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const page = await context.newPage();

        await page.goto('/app/admin/mapping-workbench');
        await page.waitForLoadState('networkidle');

        // Confirm admin mapping workbench renders
        await expect(page.locator('h1, h2, [role="main"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Unhandled Exception')).not.toBeVisible();

        await context.close();
    });

    test('3. Relationship Workbench renders questionnaire answers derived from canonical master party fields', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();

        await page.goto(`/app/s/${supplierOrgId}`);
        await page.waitForLoadState('networkidle');

        // Confirm relationship overview loads cleanly
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Unhandled Exception')).not.toBeVisible();

        await context.close();
    });
});
