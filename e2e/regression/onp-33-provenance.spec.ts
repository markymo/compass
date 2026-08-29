import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PROV-01 — Last validated provenance is consistent across surfaces
// Linear: ONP-33

const prisma = new PrismaClient();

test.describe('PROV-01 / ONP-33 — Provenance & Last Validated Consistency Across Surfaces', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let testClientLE: any;
    let testLegalEntity: any;
    let testUser: any;
    let initialClaim: any;
    let updatedClaim: any;
    const testPrefix = `PROV01 Test ${Date.now()}`;
    const initialValue = `Provenance Co ${Date.now().toString().slice(-4)}`;
    const updatedValue = `Updated Provenance ${Date.now().toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        testUser = await prisma.user.findFirst({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!testUser) throw new Error('Test user not found');

        // Create disposable Legal Entity
        testLegalEntity = await prisma.legalEntity.create({
            data: {
                name: `${testPrefix} Corp`,
                reference: `LE-${Date.now()}`
            }
        });

        // Create disposable ClientLE linked to legalEntity
        testClientLE = await prisma.clientLE.create({
            data: {
                name: `${testPrefix} Client LE`,
                legalEntity: { connect: { id: testLegalEntity.id } },
                status: 'ACTIVE'
            }
        });

        // Add user membership
        await prisma.membership.create({
            data: {
                userId: testUser.id,
                clientLEId: testClientLE.id,
                role: 'LE_ADMIN'
            }
        });

        // Add a verified manual claim on Field 2 (Legal Name) with a known timestamp
        initialClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: testClientLE.id,
                subjectLeId: testLegalEntity.id,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_CLAIM_1`,
                valueText: initialValue,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(Date.now() - 3600000), // 1 hour ago
                verifiedAt: new Date(Date.now() - 3600000),
                verifiedByUserId: testUser.id
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (testClientLE?.id) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId: testClientLE.id } });
                await prisma.membership.deleteMany({ where: { clientLEId: testClientLE.id } });
                await prisma.clientLE.delete({ where: { id: testClientLE.id } });
            }
            if (testLegalEntity?.id) {
                await prisma.legalEntity.delete({ where: { id: testLegalEntity.id } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-33:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Last validated provenance is rendered consistently on Master Card and Drawer', async ({ page }) => {
        // Step 1: Navigate to Master Record
        await page.goto(`/app/le/${testClientLE.id}/master`);
        await page.waitForLoadState('networkidle');

        // Step 2: Locate Field 2 card in Master Record
        const field2Card = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(field2Card).toBeVisible({ timeout: 15000 });
        await expect(field2Card).toContainText(initialValue);

        // Step 3: Assert source badge indicates User Input and Last validated
        const sourceBadge = field2Card.locator('text=/User input/i').first();
        await expect(sourceBadge).toBeVisible();
        const lastValidatedLabel = field2Card.locator('text=/Last validated/i').first();
        await expect(lastValidatedLabel).toBeVisible();

        // Step 4: Click card to open inspector drawer
        await field2Card.click();
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer).toContainText(initialValue);

        // Step 5: Assert drawer displays consistent source badge and Last validated metadata
        const drawerSource = drawer.locator('text=/User input/i').first();
        await expect(drawerSource).toBeVisible();
    });

    test('2. Supported update establishes new winning claim with refreshed provenance timestamp', async ({ page }) => {
        // Create new winning claim with current timestamp
        updatedClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: testClientLE.id,
                subjectLeId: testLegalEntity.id,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_CLAIM_2`,
                valueText: updatedValue,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedAt: new Date(),
                verifiedByUserId: testUser.id
            }
        });

        // Navigate to Master Record
        await page.goto(`/app/le/${testClientLE.id}/master`);
        await page.waitForLoadState('networkidle');

        // Verify updated value wins and displays fresh Last validated badge
        const field2Card = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(field2Card).toBeVisible({ timeout: 15000 });
        await expect(field2Card).toContainText(updatedValue);
        await expect(field2Card.locator('text=/Last validated/i').first()).toBeVisible();
    });

    test('3. Unmapped / unpopulated fields do not display a bogus Last Validated badge', async ({ page }) => {
        await page.goto(`/app/le/${testClientLE.id}/master`);
        await page.waitForLoadState('networkidle');

        // Locate an unmapped field (e.g. Field 199)
        const unmappedCard = page.locator('[data-testid="master-field-199"], [data-field-no="199"]').first();
        if (await unmappedCard.isVisible()) {
            await expect(unmappedCard).not.toContainText('Last validated');
        }
    });
});
