import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import { RegistryConnectorFactory } from '../../src/domain/registry/RegistryConnectorFactory';

// Contract: SRC-03 — Unsupported registration authority fails gracefully without blocking enrichment
// Linear: ONP-44

const prisma = new PrismaClient();

test.describe('SRC-03 / ONP-44 — Unsupported Registration Authority Graceful Handling', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let testClientLE: any;
    let testAuthority: any;
    let user: any;

    test.beforeAll(async () => {
        user = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });
        if (!user) throw new Error('uat+le-admin-alpha user not found');

        // Ensure RA000592 authority exists in database
        testAuthority = await prisma.registryAuthority.upsert({
            where: { id: 'RA000592' },
            update: {
                name: 'Financial Conduct Authority Mutuals Public Register',
                countryCode: 'GB',
                registryKey: 'UK_FCA',
                mappingSourceKey: 'UK_FCA'
            },
            create: {
                id: 'RA000592',
                name: 'Financial Conduct Authority Mutuals Public Register',
                countryCode: 'GB',
                registryKey: 'UK_FCA',
                mappingSourceKey: 'UK_FCA'
            }
        });

        // Create test ClientLE with RA000592 registry reference and membership
        const timestamp = Date.now();
        testClientLE = await prisma.clientLE.create({
            data: {
                name: `RA000592 Test Entity ${timestamp}`,
                shortCode: `ra592_${timestamp.toString().slice(-6)}`,
                jurisdiction: 'GB',
                status: 'ACTIVE',
                memberships: {
                    create: {
                        userId: user.id,
                        role: 'LE_ADMIN'
                    }
                },
                registryReferences: {
                    create: {
                        registryAuthorityId: 'RA000592',
                        localRegistrationNumber: `FCA-${timestamp.toString().slice(-6)}`,
                        status: 'UNSUPPORTED'
                    }
                }
            },
            include: {
                registryReferences: true
            }
        });
    });

    test.afterAll(async () => {
        if (testClientLE?.id) {
            await prisma.membership.deleteMany({ where: { clientLEId: testClientLE.id } });
            await prisma.registryReference.deleteMany({ where: { clientLEId: testClientLE.id } });
            await prisma.clientLE.deleteMany({ where: { id: testClientLE.id } });
        }
        await prisma.$disconnect();
    });

    test('1. Registry connector factory returns null for RA000592 (UK FCA) without throwing', async () => {
        const connector = await RegistryConnectorFactory.getConnectorForAuthorityId('RA000592');
        expect(connector).toBeNull();
    });

    test('2. Supported OnPro UI represents unsupported authority gracefully without crash or misleading connector error', async ({ page }) => {
        // Step 1: Navigate to Client LE overview page
        await page.goto(`/app/le/${testClientLE.id}`);
        await page.waitForLoadState('networkidle');

        // Confirm overview renders cleanly without crash or connector error
        await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Error fetching registry')).not.toBeVisible();
        await expect(page.locator('text=Unhandled Exception')).not.toBeVisible();

        // Step 2: Navigate to Registry Source inspection page
        await page.goto(`/app/le/${testClientLE.id}/sources/registry`);
        await page.waitForLoadState('networkidle');

        // Assert authority badge and informative unsupported guidance is visible
        const pageContent = page.locator('body');
        await expect(pageContent).toContainText('RA000592');
        await expect(pageContent).toContainText('Financial Conduct Authority');
        await expect(pageContent).toContainText('Integration Not Yet Implemented');

        // Assert no error banners or broken connector crash states
        await expect(page.locator('text=Failed to fetch')).not.toBeVisible();
        await expect(page.locator('text=Application error')).not.toBeVisible();
    });
});
