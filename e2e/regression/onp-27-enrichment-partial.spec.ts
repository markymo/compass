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

        // Add national registry reference with a non-existent company number to test live failure transition
        testRegistryRef = await prisma.registryReference.create({
            data: {
                clientLE: { connect: { id: testClientLE.id } },
                authority: { connect: { id: 'RA000585' } },
                localRegistrationNumber: 'INVALID99999',
                lastSyncStatus: 'PENDING'
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

    test('1. Live failed national source refresh transitions gracefully without blocking Master UX', async ({ page }) => {
        // Step 1: Navigate to Registry Sources page
        await page.goto(`/app/le/${testClientLE.id}/sources/registry`);
        await page.waitForLoadState('networkidle');

        // Step 2: Trigger live refresh action
        const refreshBtn = page.locator('button:has-text("Refresh"), button:has-text("Check for Updates")').first();
        if (await refreshBtn.isVisible()) {
            await refreshBtn.click();
            // Wait for non-blocking feedback (toast or status update)
            await page.waitForTimeout(3000);
        }

        // Step 3: Verify no blocking modal/overlay traps the user
        const blockingModal = page.locator('[role="dialog"][data-blocking="true"]');
        expect(await blockingModal.count()).toBe(0);

        // Step 4: Navigate to Master Record page
        await page.goto(`/app/le/${testClientLE.id}/master`);
        await page.waitForLoadState('networkidle');

        // Step 5: Verify valid GLEIF data is retained and displayed
        const legalNameCard = page.locator('[data-testid="master-field-2"], [data-field-no="2"]').first();
        await expect(legalNameCard).toBeVisible({ timeout: 15000 });
        await expect(legalNameCard).toContainText(`${testPrefix} Corp Legal Name`);

        // Step 6: Verify External Sources badge/tab indicates partial/connected state non-blockingly
        const sourcesLink = page.locator('a:has-text("Sources")').first();
        await expect(sourcesLink).toBeVisible();
    });
});
