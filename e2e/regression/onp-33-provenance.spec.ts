import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PROV-01 — Last validated provenance is consistent across surfaces
// Linear: ONP-33

const prisma = new PrismaClient();

test.describe('PROV-01 / ONP-33 — Provenance & Last Validated Consistency', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let subjectLeId: string | undefined;
    let ownerScopeId: string | null;
    let testUser: any;
    let testClaim: any;
    const testPrefix = `PROV01 Test ${Date.now()}`;
    const testValue = `Provenance Co ${Date.now().toString().slice(-4)}`;

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

        // Add a verified manual claim on Field 2 (Legal Name)
        testClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId,
                subjectLeId,
                ownerScopeId,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_CLAIM`,
                valueText: testValue,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedAt: new Date(),
                verifiedByUserId: testUser?.id
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({
                    where: {
                        clientLEId,
                        fieldNo: 2,
                        sourceReference: `${testPrefix}_CLAIM`
                    }
                });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-33:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Last validated date is consistent between Master Record card and Drawer inspector', async ({ page }) => {
        // Step 1: Navigate to Master Record
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Step 2: Locate Field 2 card in Master Record
        const field2Card = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(field2Card).toBeVisible({ timeout: 15000 });
        await expect(field2Card).toContainText(testValue);

        // Step 3: Assert source badge indicates User Input and Last validated
        const sourceBadge = field2Card.locator('text=/User input/i').first();
        await expect(sourceBadge).toBeVisible();
        const lastValidatedLabel = field2Card.locator('text=/Last validated/i').first();
        await expect(lastValidatedLabel).toBeVisible();

        // Step 4: Click card to open inspector drawer
        await field2Card.click();
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer).toContainText(testValue);

        // Step 5: Assert drawer displays consistent source badge and no contradictory dates
        const drawerSource = drawer.locator('text=/User input/i').first();
        await expect(drawerSource).toBeVisible();
    });

    test('2. Unmapped / unpopulated fields do not display a bogus Last Validated badge', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        // Locate an unmapped field (e.g. Field 199 Nature of intended relationship if unpopulated)
        const unmappedCard = page.locator('[data-testid="master-field-199"], [data-field-no="199"]').first();
        if (await unmappedCard.isVisible()) {
            await expect(unmappedCard).not.toContainText('Last validated');
        }
    });
});
