import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: MASTER-03 — Single-value Master fields can be cleared/deleted safely
// Linear: ONP-56

const prisma = new PrismaClient();

test.describe('MASTER-03 / ONP-56 — Single-Value Master Fields Clear/Delete Lifecycle', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let subjectLeId: string | undefined;
    let ownerScopeId: string | null;
    let testUser: any;
    let testClaimOnly: any;
    let sourceClaimB: any;
    let manualOverrideB: any;

    const testPrefix = `ONP56 Delete ${Date.now()}`;
    const testValueA = `MANUAL-F78-${Date.now().toString().slice(-4)}`;
    const sourceValueB = `CH-SRC-${Date.now().toString().slice(-4)}`;
    const manualValueB = `MANUAL-OVR-${Date.now().toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;

        const clientLE = await prisma.clientLE.findUnique({
            where: { id: clientLEId },
            select: { id: true, legalEntityId: true }
        });
        subjectLeId = clientLE?.legalEntityId || undefined;

        const owner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId, endAt: null },
            select: { partyId: true }
        });
        ownerScopeId = owner?.partyId || null;

        testUser = await prisma.user.findFirst({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({
                    where: {
                        clientLEId,
                        fieldNo: 78,
                        sourceReference: { in: [`${testPrefix}_A`, `${testPrefix}_B_SRC`, `${testPrefix}_B_MANUAL`, 'manual_update'] }
                    }
                });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-56:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Manual-only single-value field can be cleared via UI and resolves to blank without server error', async ({ page }) => {
        // Setup: Single manual claim on F78
        testClaimOnly = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                ownerScopeId,
                fieldNo: 78,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_A`,
                valueText: testValueA,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedAt: new Date(),
                verifiedByUserId: testUser?.id
            }
        });

        // Navigate directly to Master Record page
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Locate Field 78 card in the category view
        const fieldCard = page.locator('[data-testid="master-field-78"], [data-field-no="78"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });
        await expect(fieldCard).toContainText(testValueA);

        // Click field card to open inspector drawer / panel
        await fieldCard.click();
        const drawer = page.locator('[role="dialog"]').filter({ hasText: 'Primary business activity' }).first();
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer).toContainText(testValueA);

        // Click 'Clear value' trash icon button inside drawer
        const clearButton = drawer.locator('button[title="Clear value"]').first();
        await expect(clearButton).toBeVisible({ timeout: 10000 });
        await clearButton.click();

        // Confirm clearing value: 'Yes, clear'
        const confirmClearButton = drawer.locator('button:has-text("Yes, clear")').first();
        await expect(confirmClearButton).toBeVisible({ timeout: 5000 });
        await confirmClearButton.click();

        // Assert success toast / cleared state
        await expect(page.locator('text=Value cleared').first()).toBeVisible({ timeout: 10000 });

        // Reload page to verify persistence in fresh context
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify F78 in Master Record is now blank / no stale manual value
        const fieldCardAfter = page.locator('[data-testid="master-field-78"], [data-field-no="78"]').first();
        await expect(fieldCardAfter).toBeVisible({ timeout: 15000 });
        await expect(fieldCardAfter).not.toContainText(testValueA);
    });

    test('2. Clearing manual override restores underlying source claim value correctly', async ({ page }) => {
        // Setup: Older source claim + Newer manual override claim
        const pastDate = new Date(Date.now() - 60000);
        sourceClaimB = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                ownerScopeId,
                fieldNo: 78,
                claimRole: 'VALUE',
                sourceType: 'COMPANIES_HOUSE',
                sourceReference: `${testPrefix}_B_SRC`,
                valueText: sourceValueB,
                status: 'VERIFIED',
                confidenceScore: 0.9,
                assertedAt: pastDate,
                verifiedAt: pastDate
            }
        });

        manualOverrideB = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                ownerScopeId,
                fieldNo: 78,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_B_MANUAL`,
                valueText: manualValueB,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedAt: new Date(),
                verifiedByUserId: testUser?.id
            }
        });

        // Navigate directly to Master Record page
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Locate Field 78 card and verify manual override is active
        const fieldCard = page.locator('[data-testid="master-field-78"], [data-field-no="78"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });
        await expect(fieldCard).toContainText(manualValueB);

        // Click card to open inspector drawer
        await fieldCard.click();
        const drawer = page.locator('[role="dialog"]').filter({ hasText: 'Primary business activity' }).first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Click 'Clear value' button
        const clearButton = drawer.locator('button[title="Clear value"]').first();
        await expect(clearButton).toBeVisible({ timeout: 10000 });
        await clearButton.click();

        // Confirm clearing value: 'Yes, clear'
        const confirmClearButton = drawer.locator('button:has-text("Yes, clear")').first();
        await expect(confirmClearButton).toBeVisible({ timeout: 5000 });
        await confirmClearButton.click();

        await expect(page.locator('text=Value cleared').first()).toBeVisible({ timeout: 10000 });

        // Reload page to verify underlying source claim is now the winning canonical value
        await page.reload();
        await page.waitForLoadState('networkidle');

        const fieldCardAfter = page.locator('[data-testid="master-field-78"], [data-field-no="78"]').first();
        await expect(fieldCardAfter).toBeVisible({ timeout: 15000 });
        await expect(fieldCardAfter).toContainText(sourceValueB);
        await expect(fieldCardAfter).not.toContainText(manualValueB);
    });
});
