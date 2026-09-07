import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

const FIXTURE_NAME_A = 'LIFE-01 Dossier Alpha Limited';
const FIXTURE_NAME_B = 'LIFE-01 Dossier Beta Replacement Limited';
const FIXTURE_LEI = '984500LIFE01FIXTURE1';
const FIXTURE_SHORT_CODE_A = 'life01_dossier_a';
const FIXTURE_SHORT_CODE_B = 'life01_dossier_b';

test.describe('LIFE-01 — ClientLE Lifecycle Visibility Regression (ONP-82, ONP-80, ONP-24)', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });
    test.setTimeout(120000);

    let clientOrgId: string;
    let fixtureLEIdA: string;
    let fixtureLEIdB: string;
    let fixtureLegalEntityId: string;
    let adminUserId: string | undefined;

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        clientOrgId = manifest.clientOrgA.id;

        const adminUser = await prisma.user.findFirst({
            where: { email: manifest.actors.clientOrgAdminA.email }
        });
        adminUserId = adminUser?.id;

        // Ensure underlying LegalEntity
        let leRecord = await prisma.legalEntity.findFirst({
            where: { reference: FIXTURE_LEI }
        });
        if (!leRecord) {
            leRecord = await prisma.legalEntity.create({
                data: {
                    reference: FIXTURE_LEI,
                    name: FIXTURE_NAME_A,
                    jurisdiction: 'GB',
                    localRegistrationNumber: 'LIFE01001'
                }
            });
        }
        fixtureLegalEntityId = leRecord.id;

        // Clean up any stale replacement records from previous interrupted runs
        await prisma.clientLEOwner.deleteMany({
            where: {
                clientLE: {
                    name: FIXTURE_NAME_B,
                    legalEntityId: fixtureLegalEntityId
                }
            }
        });
        await prisma.membership.deleteMany({
            where: {
                clientLE: {
                    name: FIXTURE_NAME_B,
                    legalEntityId: fixtureLegalEntityId
                }
            }
        });
        await prisma.clientLE.deleteMany({
            where: {
                name: FIXTURE_NAME_B,
                legalEntityId: fixtureLegalEntityId
            }
        });

        // Ensure primary active fixture A
        let clientLEA = await prisma.clientLE.findFirst({
            where: {
                legalEntityId: fixtureLegalEntityId,
                name: FIXTURE_NAME_A,
                owners: { some: { partyId: clientOrgId, endAt: null } }
            }
        });

        if (!clientLEA) {
            clientLEA = await prisma.clientLE.create({
                data: {
                    name: FIXTURE_NAME_A,
                    shortCode: FIXTURE_SHORT_CODE_A,
                    lei: FIXTURE_LEI,
                    jurisdiction: 'GB',
                    status: 'ACTIVE',
                    isDeleted: false,
                    legalEntityId: fixtureLegalEntityId,
                    owners: {
                        create: {
                            partyId: clientOrgId
                        }
                    }
                }
            });
        } else {
            await prisma.clientLE.update({
                where: { id: clientLEA.id },
                data: {
                    isDeleted: false,
                    status: 'ACTIVE'
                }
            });
        }
        fixtureLEIdA = clientLEA.id;

        // Ensure Client Org Admin has operational LE_ADMIN assignment on fixture A
        if (adminUserId) {
            const existingMem = await prisma.membership.findFirst({
                where: {
                    userId: adminUserId,
                    clientLEId: fixtureLEIdA
                }
            });
            if (!existingMem) {
                await prisma.membership.create({
                    data: {
                        userId: adminUserId,
                        clientLEId: fixtureLEIdA,
                        role: 'LE_ADMIN'
                    }
                });
            }
        }
    });

    test.afterAll(async () => {
        // Cleanup replacement B if exists
        if (fixtureLEIdB) {
            await prisma.membership.deleteMany({ where: { clientLEId: fixtureLEIdB } });
            await prisma.clientLEOwner.deleteMany({ where: { clientLEId: fixtureLEIdB } });
            await prisma.clientLE.deleteMany({ where: { id: fixtureLEIdB } });
        }

        // Restore fixture A to active state for deterministic repeatability
        if (fixtureLEIdA) {
            await prisma.clientLE.update({
                where: { id: fixtureLEIdA },
                data: {
                    isDeleted: false,
                    status: 'ACTIVE'
                }
            });
        }
        await prisma.$disconnect();
    });

    test('1. ONP-82 / ONP-80: Client Org Admin deletes ClientLE and it remains absent across reload and fresh session', async ({ page, browser }) => {
        // 1. Confirm ClientLE is initially active and visible on Client Org overview
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page.getByText(FIXTURE_NAME_A).first()).toBeVisible({ timeout: 15000 });

        // 2. Navigate to /app/le/[id]/master
        await page.goto(`/app/le/${fixtureLEIdA}/master`);
        await expect(page).toHaveURL(new RegExp(`/app/le/${fixtureLEIdA}/master`));

        // 3. Open header actions menu
        const actionsTrigger = page.getByRole('button', { name: /Entity actions/i }).or(
            page.locator('button:has(svg.lucide-ellipsis-vertical), button:has(svg.lucide-more-vertical)')
        ).first();
        await expect(actionsTrigger).toBeVisible({ timeout: 10000 });
        await actionsTrigger.click();

        // 4. Confirm Delete is visible and Archive is NOT visible
        const deleteOption = page.getByRole('menuitem', { name: /Delete/i });
        await expect(deleteOption).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /Archive/i })).not.toBeVisible();

        // 5. Execute Delete
        await deleteOption.click();
        const deleteDialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
        await expect(deleteDialog).toBeVisible();
        await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();

        // 6. Assert success redirect and toast
        await expect(page).toHaveURL(/\/app(\?.*)?$/, { timeout: 15000 });
        await expect(page.getByText(/Entity deleted/i)).toBeVisible({ timeout: 10000 });

        // 7. Verify absent from Home and Client Org overview
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // ── ONP-80: Verify permanence across page reload ──
        await page.reload();
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        await page.goto('/app');
        await page.reload();
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // ── ONP-80: Verify permanence across fresh browser session / context ──
        const freshContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });
        const freshPage = await freshContext.newPage();

        await freshPage.goto('/app');
        await expect(freshPage.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        await freshPage.goto(`/app/clients/${clientOrgId}`);
        await expect(freshPage.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // Direct URL navigation on fresh context must fail safely
        const response = await freshPage.goto(`/app/le/${fixtureLEIdA}/master`);
        await expect(freshPage.getByText('Master Record')).not.toBeVisible();
        await expect(freshPage.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
        await expect(freshPage.getByText(FIXTURE_NAME_A, { exact: true })).not.toBeVisible();
        if (response) {
            expect([200, 403, 404]).toContain(response.status());
        }

        await freshContext.close();

        // Database assertions for soft-deleted entity A
        const dbA = await prisma.clientLE.findUnique({ where: { id: fixtureLEIdA } });
        expect(dbA).not.toBeNull();
        expect(dbA?.isDeleted).toBe(true);
        expect(dbA?.status).toBe('ACTIVE'); // Operational status preserved
        expect(dbA?.legalEntityId).toBe(fixtureLegalEntityId);
    });

    test('2. ONP-24: When deleted historical dossier coexists with current replacement dossier, only current dossier appears', async ({ page, browser }) => {
        // Setup: Ensure Dossier A is soft-deleted and create fresh current Dossier B for same LegalEntity & Client Org
        await prisma.clientLE.update({
            where: { id: fixtureLEIdA },
            data: { isDeleted: true, status: 'ACTIVE' }
        });

        const clientLEB = await prisma.clientLE.create({
            data: {
                name: FIXTURE_NAME_B,
                shortCode: FIXTURE_SHORT_CODE_B,
                lei: FIXTURE_LEI,
                jurisdiction: 'GB',
                status: 'ACTIVE',
                isDeleted: false,
                legalEntityId: fixtureLegalEntityId,
                owners: {
                    create: {
                        partyId: clientOrgId
                    }
                }
            }
        });
        fixtureLEIdB = clientLEB.id;

        if (adminUserId) {
            await prisma.membership.create({
                data: {
                    userId: adminUserId,
                    clientLEId: fixtureLEIdB,
                    role: 'LE_ADMIN'
                }
            });
        }

        // 1. Verify on Client Org Overview: Dossier B is listed; Dossier A is absent
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page.getByText(FIXTURE_NAME_B).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // 2. Verify on Home Dashboard: Dossier B is listed; Dossier A is absent
        await page.goto('/app');
        await expect(page.getByText(FIXTURE_NAME_B).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // 3. Verify current dossier B opens correctly and renders Master Record
        await page.goto(`/app/le/${fixtureLEIdB}/master`);
        await expect(page.getByRole('heading', { name: 'Master Record' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(FIXTURE_NAME_B).first()).toBeVisible();

        // 4. Verify reload preserves B visible and A absent
        await page.goto(`/app/clients/${clientOrgId}`);
        await page.reload();
        await expect(page.getByText(FIXTURE_NAME_B).first()).toBeVisible();
        await expect(page.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // 5. Verify fresh browser session preserves B visible and A absent
        const freshContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });
        const freshPage = await freshContext.newPage();

        await freshPage.goto('/app');
        await expect(freshPage.getByText(FIXTURE_NAME_B).first()).toBeVisible({ timeout: 15000 });
        await expect(freshPage.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        await freshPage.goto(`/app/clients/${clientOrgId}`);
        await expect(freshPage.getByText(FIXTURE_NAME_B).first()).toBeVisible({ timeout: 15000 });
        await expect(freshPage.getByText(FIXTURE_NAME_A)).not.toBeVisible();

        // 6. Direct navigation to deleted dossier A fails safely
        const responseA = await freshPage.goto(`/app/le/${fixtureLEIdA}/master`);
        await expect(freshPage.getByText('Master Record')).not.toBeVisible();
        await expect(freshPage.getByText(FIXTURE_NAME_A, { exact: true })).not.toBeVisible();
        if (responseA) {
            expect([200, 403, 404]).toContain(responseA.status());
        }

        await freshContext.close();

        // 7. Database coexistence assertion
        const [dbA, dbB] = await Promise.all([
            prisma.clientLE.findUnique({ where: { id: fixtureLEIdA } }),
            prisma.clientLE.findUnique({ where: { id: fixtureLEIdB } })
        ]);

        expect(dbA?.isDeleted).toBe(true);
        expect(dbB?.isDeleted).toBe(false);
        expect(dbA?.legalEntityId).toBe(fixtureLegalEntityId);
        expect(dbB?.legalEntityId).toBe(fixtureLegalEntityId);
    });
});
