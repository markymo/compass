import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PARTY-06 — Field 274 multi-value Person and Organisation records render complete, untruncated canonical values in Master read-only card and inspection drawer
// Linear: ONP-21

const prisma = new PrismaClient();

test.describe('PARTY-06 / ONP-21 — Field 274 Party Non-Truncation Display Lifecycle', () => {
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
        const alphaLE = await prisma.clientLE.findFirst({
            where: { OR: [{ id: manifest.alphaClientLE.id }, { shortCode: 'uat_cle_alpha' }] },
            include: { owners: true }
        });
        if (!alphaLE) throw new Error('uat_cle_alpha not found in database');

        const leAdminUser = await prisma.user.findUnique({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!leAdminUser) throw new Error(`LE Admin user ${manifest.actors.leAdminAlpha.email} not found`);

        // Shared-fixture preservation: create a fully disposable synthetic ClientLE
        const disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `uat_cle_onp21_${testTimestamp}`,
                name: `Disposable CLE ONP-21 ${testTimestamp}`,
                owners: {
                    create: {
                        partyId: alphaLE.owners[0]?.partyId || alphaLE.id
                    }
                },
                memberships: {
                    create: {
                        userId: leAdminUser.id,
                        role: 'LE_ADMIN'
                    }
                }
            }
        });
        clientLEId = disposableLE.id;

        // Seed distinctive long Person party claim on Field 274 (Persons of significant control (other))
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

        // Seed distinctive long Organisation party claim on Field 274
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
                await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLE.delete({ where: { id: clientLEId } }).catch(() => {});
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
