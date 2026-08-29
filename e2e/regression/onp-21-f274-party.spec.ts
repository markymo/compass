import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PARTY-06 — F274 party values are not truncated in canonical read-only display and mapped reuse
// Linear: ONP-21

const prisma = new PrismaClient();

test.describe('PARTY-06 / ONP-21 — F274 Party Non-Truncation Display Lifecycle', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;

    const testTimestamp = Date.now();
    const longForenames = 'Alexander Maximilian Archibald';
    const longSurname = `Montgomery-Featherstonehaugh-${testTimestamp.toString().slice(-4)}`;
    const fullPersonName = `${longForenames} ${longSurname}`;

    const fullOrgName = `Global Intercontinental Trans-Oceanic Shipping & Logistics Corporation Limited ${testTimestamp.toString().slice(-4)}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        const clientLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');
        clientLEId = clientLE.id;

        // Clean up any test claims on Field 274 (Persons of significant control (other))
        await prisma.fieldClaim.deleteMany({
            where: {
                clientLEId,
                fieldNo: 274,
            }
        });

        // Seed distinctive long Person party claim
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                fieldNo: 274,
                collectionId: 'CONTROLLERS',
                instanceId: `psc_person_${testTimestamp}`,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                sourceReference: 'USER_INPUT',
                valueJson: {
                    forenames: longForenames,
                    surname: longSurname,
                    partyType: 'PERSON',
                    roles: [{ roleTitle: 'Senior Person with Significant Control', roleType: 'PSC' }],
                    nationalities: ['British'],
                },
                assertedAt: new Date('2026-08-25T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-25T10:00:00.000Z'),
            }
        });

        // Seed distinctive long Organisation party claim
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                fieldNo: 274,
                collectionId: 'CONTROLLERS',
                instanceId: `psc_org_${testTimestamp}`,
                claimRole: 'VALUE',
                status: 'VERIFIED',
                sourceType: 'USER_INPUT',
                sourceReference: 'USER_INPUT',
                valueJson: {
                    organisationName: fullOrgName,
                    partyType: 'ORGANISATION',
                    jurisdiction: 'United Kingdom',
                    roles: [{ roleTitle: 'Corporate Shareholder (>25%)', roleType: 'CORPORATE_PSC' }],
                },
                assertedAt: new Date('2026-08-25T10:00:00.000Z'),
                verifiedAt: new Date('2026-08-25T10:00:00.000Z'),
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({
                    where: {
                        clientLEId,
                        fieldNo: 274,
                    }
                });
            }
        } catch (err) {
            console.warn('Cleanup error in ONP-21:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Master Record card renders full party names without truncation', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        // Locate Field 274 card (Persons of significant control (other))
        const fieldCard = page.locator('[data-testid="master-field-274"], [data-field-no="274"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });

        // Assert full untruncated person surname and forenames
        await expect(fieldCard).toContainText(longForenames);
        await expect(fieldCard).toContainText(longSurname);

        // Assert full untruncated organisation name
        await expect(fieldCard).toContainText(fullOrgName);
    });

    test('2. Inspection drawer displays full party details and roles without truncation', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/master`);
        await page.waitForLoadState('domcontentloaded');

        const fieldCard = page.locator('[data-testid="master-field-274"], [data-field-no="274"]').first();
        await expect(fieldCard).toBeVisible({ timeout: 15000 });
        await fieldCard.locator('[role="button"]').first().click();

        const drawer = page.locator('[role="dialog"]').first();
        await expect(drawer).toBeVisible({ timeout: 10000 });

        // Assert both party entries present in drawer with complete labels
        await expect(drawer).toContainText(longSurname);
        await expect(drawer).toContainText(fullOrgName);

        // Assert role badges / role titles are visible
        await expect(drawer.locator('text=/Significant Control|Shareholder/i').first()).toBeVisible();
    });
});
