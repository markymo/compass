import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import { deleteClientLE } from '@/actions/client';

const prisma = new PrismaClient();

const ACTIVE_LE_NAME = 'LIFE-02 Active LE Limited';
const DELETED_LE_NAME = 'LIFE-02 Deleted LE Limited';
const ACTIVE_LE_LEI = '984500LIFE02ACT001';
const DELETED_LE_LEI = '984500LIFE02DEL002';

test.describe('LIFE-02 — Admin Organisation Relationships Lifecycle (ONP-72)', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
    test.setTimeout(120000);

    let supplierOrgId: string;
    let clientOrgId: string;
    let activeClientLEId: string;
    let deletedClientLEId: string;
    let activeLegalEntityId: string;
    let deletedLegalEntityId: string;
    let activeEngagementId: string;
    let deletedEngagementId: string;

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        supplierOrgId = manifest.supplierOrgA.id;
        clientOrgId = manifest.clientOrgA.id;

        // 1. Create or ensure LegalEntity records
        let leActive = await prisma.legalEntity.findFirst({ where: { reference: ACTIVE_LE_LEI } });
        if (!leActive) {
            leActive = await prisma.legalEntity.create({
                data: {
                    reference: ACTIVE_LE_LEI,
                    name: ACTIVE_LE_NAME,
                    jurisdiction: 'GB',
                    localRegistrationNumber: 'LIFE02001'
                }
            });
        }
        activeLegalEntityId = leActive.id;

        let leDeleted = await prisma.legalEntity.findFirst({ where: { reference: DELETED_LE_LEI } });
        if (!leDeleted) {
            leDeleted = await prisma.legalEntity.create({
                data: {
                    reference: DELETED_LE_LEI,
                    name: DELETED_LE_NAME,
                    jurisdiction: 'GB',
                    localRegistrationNumber: 'LIFE02002'
                }
            });
        }
        deletedLegalEntityId = leDeleted.id;

        // 2. Clean up previous test state if any
        await prisma.fIEngagement.deleteMany({
            where: {
                fiOrgId: supplierOrgId,
                clientLE: {
                    legalEntityId: { in: [activeLegalEntityId, deletedLegalEntityId] }
                }
            }
        });
        await prisma.clientLEOwner.deleteMany({
            where: {
                clientLE: {
                    legalEntityId: { in: [activeLegalEntityId, deletedLegalEntityId] }
                }
            }
        });
        await prisma.clientLE.deleteMany({
            where: {
                legalEntityId: { in: [activeLegalEntityId, deletedLegalEntityId] }
            }
        });

        // 3. Create active ClientLE A and soft-deleted ClientLE B
        const clientLEA = await prisma.clientLE.create({
            data: {
                name: ACTIVE_LE_NAME,
                shortCode: 'life02_act',
                lei: ACTIVE_LE_LEI,
                jurisdiction: 'GB',
                status: 'ACTIVE',
                isDeleted: false,
                legalEntityId: activeLegalEntityId,
                owners: { create: { partyId: clientOrgId } }
            }
        });
        activeClientLEId = clientLEA.id;

        const clientLEB = await prisma.clientLE.create({
            data: {
                name: DELETED_LE_NAME,
                shortCode: 'life02_del',
                lei: DELETED_LE_LEI,
                jurisdiction: 'GB',
                status: 'ACTIVE',
                isDeleted: true, // Soft-deleted
                legalEntityId: deletedLegalEntityId,
                owners: { create: { partyId: clientOrgId } }
            }
        });
        deletedClientLEId = clientLEB.id;

        // 4. Create Active Engagement A and Soft-Deleted Engagement B
        const engA = await prisma.fIEngagement.create({
            data: {
                fiOrgId: supplierOrgId,
                clientLEId: activeClientLEId,
                status: 'CONNECTED',
                isDeleted: false
            }
        });
        activeEngagementId = engA.id;

        const engB = await prisma.fIEngagement.create({
            data: {
                fiOrgId: supplierOrgId,
                clientLEId: deletedClientLEId,
                status: 'CONNECTED',
                isDeleted: true // Soft-deleted
            }
        });
        deletedEngagementId = engB.id;
    });

    test.afterAll(async () => {
        // Idempotent teardown
        await prisma.fIEngagement.deleteMany({
            where: {
                fiOrgId: supplierOrgId,
                clientLE: {
                    legalEntityId: { in: [activeLegalEntityId, deletedLegalEntityId] }
                }
            }
        });
        await prisma.clientLEOwner.deleteMany({
            where: {
                clientLE: {
                    legalEntityId: { in: [activeLegalEntityId, deletedLegalEntityId] }
                }
            }
        });
        await prisma.clientLE.deleteMany({
            where: {
                legalEntityId: { in: [activeLegalEntityId, deletedLegalEntityId] }
            }
        });
        await prisma.$disconnect();
    });

    test('1. System Admin Relationships tab renders active engagement and excludes soft-deleted engagement', async ({ page }) => {
        await page.goto(`/app/admin/organizations/${supplierOrgId}`);
        await expect(page.getByRole('heading', { name: 'UAT Supplier Org A' })).toBeVisible({ timeout: 15000 });

        // Switch to Relationships tab
        const relTab = page.getByRole('button', { name: 'Relationships' });
        await expect(relTab).toBeVisible();
        await relTab.click();

        // Verify active engagement A is visible
        await expect(page.getByText(ACTIVE_LE_NAME).first()).toBeVisible({ timeout: 10000 });

        // Verify soft-deleted engagement B is NOT visible
        await expect(page.getByText(DELETED_LE_NAME)).not.toBeVisible();
    });

    test('2. Deleting an active ClientLE transitions its engagement out of the Admin Relationships tab across reload & fresh session', async ({ page, browser }) => {
        // Soft-delete ClientLE A (which cascade soft-deletes its engagement in standard lifecycle)
        await prisma.fIEngagement.update({
            where: { id: activeEngagementId },
            data: { isDeleted: true }
        });
        await prisma.clientLE.update({
            where: { id: activeClientLEId },
            data: { isDeleted: true }
        });

        // 1. Reload Admin Organisation page
        await page.goto(`/app/admin/organizations/${supplierOrgId}`);
        const relTab = page.getByRole('button', { name: 'Relationships' });
        await relTab.click();

        // 2. Assert neither deleted engagement appears in the Relationships table
        await expect(page.getByText(ACTIVE_LE_NAME)).not.toBeVisible();
        await expect(page.getByText(DELETED_LE_NAME)).not.toBeVisible();

        // 3. Fresh browser session verification
        const freshContext = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.systemAdmin });
        const freshPage = await freshContext.newPage();

        await freshPage.goto(`/app/admin/organizations/${supplierOrgId}`);
        const freshRelTab = freshPage.getByRole('button', { name: 'Relationships' });
        await freshRelTab.click();

        await expect(freshPage.getByText(ACTIVE_LE_NAME)).not.toBeVisible();
        await expect(freshPage.getByText(DELETED_LE_NAME)).not.toBeVisible();

        await freshContext.close();
    });

    test('3. Live baseline verification: Barclays organization displays only active engagements', async ({ page }) => {
        const barclays = await prisma.organization.findFirst({ where: { name: 'Barclays' } });
        if (!barclays) return;

        await page.goto(`/app/admin/organizations/${barclays.id}`);
        await expect(page.getByRole('heading', { name: 'Barclays' })).toBeVisible({ timeout: 15000 });

        const relTab = page.getByRole('button', { name: 'Relationships' });
        await relTab.click();

        // Active engagements must remain visible
        await expect(page.getByText('FUSION UK FINCO LIMITED').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('ZZOOMM PLC').first()).toBeVisible();

        // Historical soft-deleted engagements must NOT appear
        await expect(page.getByText('TotalEnergies SE')).not.toBeVisible();
        await expect(page.getByText('ABERDEEN GROUP PLC')).not.toBeVisible();
        await expect(page.getByText('TEST S.R.L.')).not.toBeVisible();
    });
});
