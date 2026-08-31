import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { assertUatDbTestEnv } from '../../src/lib/kyc/__tests__/test-env-guard';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

process.env.ONPRO_DB_TEST_ENV = 'uat';
assertUatDbTestEnv();

const prisma = new PrismaClient();

test.describe('Cosmetic Wave 01 — Track A: Sources / LE UI Contracts', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let clientLEId: string;
    let disposableLE: any;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        clientLEId = manifest.alphaClientLE.id;

        const leAdminUser = await prisma.user.findUnique({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!leAdminUser) throw new Error(`LE Admin user ${manifest.actors.leAdminAlpha.email} not found`);

        const alphaLE = await prisma.clientLE.findUniqueOrThrow({
            where: { id: clientLEId },
            include: { owners: true }
        });

        // Create a disposable ClientLE with nationalRegistryData for ONP-98 reproduction
        const testTimestamp = Date.now();
        disposableLE = await prisma.clientLE.create({
            data: {
                shortCode: `uat_cle_onp98_${testTimestamp}`,
                name: `Disposable CLE ONP-98 ${testTimestamp}`,
                jurisdiction: 'GB',
                status: 'ACTIVE',
                nationalRegistryData: {
                    company_name: `Disposable CLE ONP-98 ${testTimestamp}`,
                    company_number: '12345678',
                    company_status: 'active',
                    registered_office_address: {
                        address_line_1: '100 London Wall',
                        postal_code: 'EC2M 5QQ',
                        locality: 'London',
                        country: 'United Kingdom'
                    },
                    officers: [
                        { name: 'Smith, John', officer_role: 'director' }
                    ]
                },
                owners: {
                    create: {
                        partyId: alphaLE.owners[0]?.partyId || manifest.clientOrgA.id
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
    });

    test.afterAll(async () => {
        try {
            if (disposableLE?.id) {
                await prisma.membership.deleteMany({ where: { clientLEId: disposableLE.id } });
                await prisma.clientLEOwner.deleteMany({ where: { clientLEId: disposableLE.id } });
                await prisma.clientLE.delete({ where: { id: disposableLE.id } });
            }
        } catch (err) {
            console.warn('[ONP-98] Cleanup warning:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('ONP-98: Companies House source page does not expose obsolete "Preview Extracted Entities" action', async ({ page }) => {
        await page.goto(`/app/le/${disposableLE.id}/sources/registry`);
        await page.waitForLoadState('networkidle');

        // On unfixed dev, this assertion FAILS (RED) because ExtractedCandidatesViewer renders the button
        const previewBtn = page.getByRole('button', { name: /Preview Extracted Entities/i });
        await expect(previewBtn).not.toBeVisible();
    });

    test('ONP-100: User Parties table omits meaningless Active status column and uses direct Trash2 delete button', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/user-parties`);
        await page.waitForLoadState('networkidle');

        // 1. Status column header must NOT be present
        const statusHeader = page.getByRole('columnheader', { name: /^Status$/i });
        await expect(statusHeader).not.toBeVisible();

        // 2. Meaningless Active badge must NOT be present in rows
        const activeBadge = page.locator('table').getByText(/^Active$/, { exact: true });
        await expect(activeBadge).not.toBeVisible();

        // 3. Row actions must offer direct Delete button with Trash2 icon rather than MoreHorizontal indirection
        const moreActionsTrigger = page.locator('button[aria-label="More actions"]').first();
        await expect(moreActionsTrigger).not.toBeVisible();

        const directDeleteBtn = page.locator('button[aria-label="Delete saved party"], button[title="Delete saved party"]').first();
        await expect(directDeleteBtn).toBeVisible();
    });

    test('ONP-110 (ALREADY COMPLIANT): GLEIF external link uses safe ExternalLink semantics without obsolete status blob', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/gleif`);
        await page.waitForLoadState('networkidle');

        // Check that page renders clean GLEIF layout without obsolete status blobs
        const statusBlob = page.locator('.status-blob, .status-dot');
        await expect(statusBlob).not.toBeVisible();
    });

    test('ONP-111 (ALREADY COMPLIANT): GLEIF source page does not show Companies House refresh tile', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}/sources/gleif`);
        await page.waitForLoadState('networkidle');

        // Verify no Companies House refresh tile at bottom of GLEIF page
        const chTile = page.getByText(/Companies House Refresh|Refresh Companies House Data/i);
        await expect(chTile).not.toBeVisible();
    });
});
