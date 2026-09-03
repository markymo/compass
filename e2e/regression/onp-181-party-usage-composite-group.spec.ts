import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import * as path from 'path';

const prisma = new PrismaClient();
const ARTIFACT_DIR = '/home/mark/.gemini/antigravity/brain/7222b68c-75cb-4512-8058-12c2b377f724';

test.describe('ONP-181 — Sources / Parties Usage for Composite Groups & Scoped Entities', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let targetPartyId: string;
    const testTimestamp = Date.now();
    const partyName = `Dr. Sterling PSC ${testTimestamp.toString().slice(-4)}`;

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

        const ownerPartyId = alphaLE.owners[0]?.partyId || alphaLE.id;

        // Create disposable owner-scoped ClientLE
        const disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `uat_cle_onp181_${testTimestamp}`,
                name: `Disposable CLE ONP-181 ${testTimestamp}`,
                owners: {
                    create: {
                        partyId: ownerPartyId
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

        // Create curated CCParty
        const ccParty = await prisma.cCParty.create({
            data: {
                clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    forenames: 'Dr. Sterling',
                    surname: `PSC ${testTimestamp.toString().slice(-4)}`,
                    emails: [],
                    phones: [],
                    roles: [{ roleTitle: 'Controller', roleType: 'PSC' }],
                    sourceIdentifiers: []
                }
            }
        });
        targetPartyId = ccParty.id;

        // Seed Field 274 claim scoped to owner, referencing ccPartyId
        await prisma.fieldClaim.create({
            data: {
                clientLEId,
                fieldNo: 274,
                collectionId: 'CONTROLLERS',
                instanceId: `inst_psc_${testTimestamp}`,
                claimRole: 'VALUE',
                status: 'ASSERTED',
                sourceType: 'USER_INPUT',
                sourceReference: 'USER_INPUT',
                ownerScopeId: ownerPartyId,
                valueJson: {
                    ccPartyId: targetPartyId,
                    forenames: 'Dr. Sterling',
                    surname: `PSC ${testTimestamp.toString().slice(-4)}`,
                    partyType: 'INDIVIDUAL'
                },
                assertedAt: new Date(),
            }
        });
    });

    test.afterAll(async () => {
        try {
            if (clientLEId) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.cCParty.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.membership.deleteMany({ where: { clientLEId } }).catch(() => {});
                await prisma.clientLE.delete({ where: { id: clientLEId } }).catch(() => {});
            }
        } catch (err) {
            console.warn('Cleanup error in ONP-181:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('validates party used in composite group Field 274 displays usage in Sources / Parties', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/user-parties`);
        await page.waitForLoadState('domcontentloaded');

        // Locate the party row
        const partyRow = page.locator('tr').filter({ hasText: partyName });
        await expect(partyRow).toBeVisible({ timeout: 20000 });

        // Verify Usage cell does not say "Not currently used"
        await expect(partyRow.getByText('Not currently used')).toHaveCount(0);

        // Verify Usage cell says "Used in 1 field"
        const usageText = partyRow.locator('text=Used in 1 field');
        await expect(usageText).toBeVisible({ timeout: 10000 });

        // Hover over the usage cell to trigger tooltip
        await usageText.hover();

        // Verify tooltip content mentions Field 274
        const tooltip = page.locator('[role="tooltip"], [data-radix-popper-content-wrapper]');
        await expect(tooltip).toBeVisible({ timeout: 5000 });
        await expect(tooltip).toContainText('Field 274');

        // Capture screenshot artifact
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'onp181_party_usage.png'), fullPage: false });
    });
});
