import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: ENR-01 — Partial-source enrichment completes without blocking UX
// Linear: ONP-27

const prisma = new PrismaClient();

test.describe('ENR-01 / ONP-27 — Partial-Source Enrichment Non-Blocking UX', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let testClientLE: any;
    let testLegalEntity: any;
    let testRegistryRef: any;
    let testUser: any;
    const testPrefix = `ENR01 Test ${Date.now()}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        testUser = await prisma.user.findFirst({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!testUser) throw new Error('Test user not found');

        // Create disposable Legal Entity with valid GLEIF identifier
        testLegalEntity = await prisma.legalEntity.create({
            data: {
                name: `${testPrefix} Corp`,
                reference: `LE-${Date.now()}`
            }
        });

        // Create disposable ClientLE with valid GLEIF timestamp
        testClientLE = await prisma.clientLE.create({
            data: {
                name: `${testPrefix} Client LE`,
                legalEntity: { connect: { id: testLegalEntity.id } },
                status: 'ACTIVE',
                lei: '5493006MHB84DD0ZWV18',
                gleifFetchedAt: new Date()
            }
        });

        // Add user membership to ClientLE
        await prisma.membership.create({
            data: {
                userId: testUser.id,
                clientLEId: testClientLE.id,
                role: 'LE_ADMIN'
            }
        });

        // Add failing national registry reference (e.g. valid GLEIF entity, but national registry lookup failed)
        testRegistryRef = await prisma.registryReference.create({
            data: {
                clientLE: { connect: { id: testClientLE.id } },
                authority: { connect: { id: 'RA000585' } },
                localRegistrationNumber: '99999999',
                lastSyncStatus: 'FAILED',
                lastSyncAttemptAt: new Date()
            }
        });

        // Add valid GLEIF claim (Field 2: Legal Name)
        await prisma.fieldClaim.create({
            data: {
                clientLEId: testClientLE.id,
                subjectLeId: testLegalEntity.id,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'GLEIF',
                sourceReference: '5493006MHB84DD0ZWV18',
                valueText: `${testPrefix} Corp Legal Name`,
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (testClientLE?.id) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId: testClientLE.id } });
                await prisma.membership.deleteMany({ where: { clientLEId: testClientLE.id } });
                await prisma.registryReference.deleteMany({ where: { clientLEId: testClientLE.id } });
                await prisma.clientLE.delete({ where: { id: testClientLE.id } });
            }
            if (testLegalEntity?.id) {
                await prisma.legalEntity.delete({ where: { id: testLegalEntity.id } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-27:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Partial enrichment failure provides non-blocking UX and retains successful source data', async ({ page }) => {
        // Step 1: Navigate to Client LE Master page
        await page.goto(`/app/le/${testClientLE.id}/master`);
        await page.waitForLoadState('networkidle');

        // Step 2: Assert no blocking modal or 'Proceed manually' overlay exists
        const blockingModal = page.locator('[role="dialog"]').filter({ hasText: /proceed manually/i });
        await expect(blockingModal).not.toBeVisible();

        // Step 3: Assert External Sources banner displays both successful GLEIF and failing registry status non-blockingly
        const gleifCard = page.locator('text=Global LEI Index (GLEIF)').first();
        await expect(gleifCard).toBeVisible({ timeout: 10000 });
        const syncFailedBadge = page.locator('text=Sync Failed').first();
        await expect(syncFailedBadge).toBeVisible({ timeout: 10000 });

        // Step 4: Assert successful GLEIF data is visible and retained in Master Record
        const field2Card = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(field2Card).toBeVisible({ timeout: 15000 });
        await expect(field2Card).toContainText(`${testPrefix} Corp Legal Name`);

        // Step 5: Assert user can interact with the page and open the inspection drawer normally
        await field2Card.click();
        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });
        await expect(drawer).toContainText(`${testPrefix} Corp Legal Name`);
    });
});
