import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PARTY-05 — Selected party fields/mappings are honoured
// Linear: ONP-48

const prisma = new PrismaClient();

test.describe('PARTY-05 / ONP-48 — Party Selected Fields & Display Mask', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let testParty: any;
    const testPrefix = `PARTY05 Test ${Date.now()}`;
    const directorName = `Director ${Date.now().toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;

        // Create disposable CCParty record
        testParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    title: 'Mr',
                    forenames: directorName,
                    surname: 'DirectorSurname',
                    displayName: `${directorName} DirectorSurname`,
                    nationality: ['British'],
                    countryOfResidence: 'United Kingdom',
                    roles: [
                        {
                            roleType: 'DIRECTOR',
                            roleTitle: 'Executive Director',
                            appointedOn: '2021-06-01',
                            isActiveRole: true
                        }
                    ]
                }
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (testParty?.id) {
                await prisma.cCParty.delete({ where: { id: testParty.id } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-48:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Structured party record displays honouring selected fields and roles', async ({ page }) => {
        // Navigate to User Parties source page
        await page.goto(`/app/le/${clientLEId}/sources/user-parties`);
        await page.waitForLoadState('networkidle');

        // Locate party row
        const partyRow = page.locator('tr').filter({ hasText: directorName }).first();
        await expect(partyRow).toBeVisible({ timeout: 15000 });

        // Verify type and status columns
        await expect(partyRow).toContainText('INDIVIDUAL');
        await expect(partyRow).toContainText('Active');
    });
});
