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
    const testTimestamp = Date.now();
    const forenameA = `Arthur${testTimestamp.toString().slice(-4)}`;
    const surnameB = `Pendelton${testTimestamp.toString().slice(-4)}`;
    const unselectedAttrC = `SECRET_UNSELECTED_${testTimestamp}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;

        // Create controlled CCParty with:
        // - Attribute A (forenames): distinctive value
        // - Attribute B (surname): distinctive value
        // - Attribute C (unselected/sensitive notes or title): distinctive value
        testParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    title: unselectedAttrC,
                    forenames: forenameA,
                    surname: surnameB,
                    displayName: `${forenameA} ${surnameB}`,
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

    test('1. Structured party record displays selected attributes A and B while omitting unselected attribute C', async ({ page }) => {
        // Step 1: Navigate to User Parties source page
        await page.goto(`/app/le/${clientLEId}/sources/user-parties`);
        await page.waitForLoadState('networkidle');

        // Step 2: Locate party row
        const partyRow = page.locator('tr').filter({ hasText: forenameA }).first();
        await expect(partyRow).toBeVisible({ timeout: 15000 });

        // Step 3: Verify Attribute A (forenames) and Attribute B (surname) are displayed
        await expect(partyRow).toContainText(forenameA);
        await expect(partyRow).toContainText(surnameB);

        // Step 4: Verify unselected/masked Attribute C is absent from the display row
        await expect(partyRow).not.toContainText(unselectedAttrC);

        // Step 5: Verify party type and status badges
        await expect(partyRow).toContainText('INDIVIDUAL');
        await expect(partyRow).toContainText('Active');
    });

    test('2. Unmapped / unconfigured fields do not fabricate party projections', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('networkidle');

        const unmappedCard = page.locator('[data-testid="master-field-199"], [data-field-no="199"]').first();
        if (await unmappedCard.isVisible()) {
            await expect(unmappedCard).not.toContainText(forenameA);
            await expect(unmappedCard).not.toContainText('INDIVIDUAL');
        }
    });
});
