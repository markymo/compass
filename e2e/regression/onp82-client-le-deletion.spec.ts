import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

const FIXTURE_NAME = 'ONP-82 Deletion Fixture Limited';
const FIXTURE_LEI = '984500ONP82DELFIXT01';
const FIXTURE_SHORT_CODE = 'onp82_del_fixture';

test.describe('ONP-82 — Client LE Deletion User Journey for Client Org Admin', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });
    test.setTimeout(90000);

    let clientOrgId: string;
    let fixtureLEId: string;
    let fixtureLegalEntityId: string;
    let adminUserId: string | undefined;

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        clientOrgId = manifest.clientOrgA.id;

        const adminUser = await prisma.user.findFirst({
            where: { email: manifest.actors.clientOrgAdminA.email }
        });
        adminUserId = adminUser?.id;

        // Ensure or create underlying LegalEntity
        let leRecord = await prisma.legalEntity.findFirst({
            where: { reference: FIXTURE_LEI }
        });
        if (!leRecord) {
            leRecord = await prisma.legalEntity.create({
                data: {
                    reference: FIXTURE_LEI,
                    name: FIXTURE_NAME,
                    jurisdiction: 'GB',
                    localRegistrationNumber: 'ONP82001'
                }
            });
        }
        fixtureLegalEntityId = leRecord.id;

        // Ensure a deterministic, active ClientLE fixture exists for Client Org A
        let clientLE = await prisma.clientLE.findFirst({
            where: {
                legalEntityId: fixtureLegalEntityId,
                owners: { some: { partyId: clientOrgId, endAt: null } }
            }
        });

        if (!clientLE) {
            clientLE = await prisma.clientLE.create({
                data: {
                    name: FIXTURE_NAME,
                    shortCode: FIXTURE_SHORT_CODE,
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
            // Reset to clean active state if left over from a previous interrupted run
            await prisma.clientLE.update({
                where: { id: clientLE.id },
                data: {
                    isDeleted: false,
                    status: 'ACTIVE'
                }
            });
        }
        fixtureLEId = clientLE.id;

        // Ensure Client Org Admin has operational LE_ADMIN assignment on this fixture
        if (adminUserId) {
            const existingMem = await prisma.membership.findFirst({
                where: {
                    userId: adminUserId,
                    clientLEId: fixtureLEId
                }
            });
            if (!existingMem) {
                await prisma.membership.create({
                    data: {
                        userId: adminUserId,
                        clientLEId: fixtureLEId,
                        role: 'LE_ADMIN'
                    }
                });
            }
        }
    });

    test.afterAll(async () => {
        // Restore fixture to active state for deterministic repeatability
        if (fixtureLEId) {
            await prisma.clientLE.update({
                where: { id: fixtureLEId },
                data: {
                    isDeleted: false,
                    status: 'ACTIVE'
                }
            });
        }
        await prisma.$disconnect();
    });

    test('Client Org Admin deletes ClientLE dossier end-to-end', async ({ page }) => {
        // 1. Confirm ClientLE is initially active and visible on Client Org overview
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page.getByText(FIXTURE_NAME).first()).toBeVisible({ timeout: 15000 });

        // 2. Navigate to /app/le/[id]/master
        await page.goto(`/app/le/${fixtureLEId}/master`);
        await expect(page).toHaveURL(new RegExp(`/app/le/${fixtureLEId}/master`));

        // 3. Open the ... actions menu in header
        const actionsTrigger = page.getByRole('button', { name: /Entity actions/i }).or(
            page.locator('button:has(svg.lucide-ellipsis-vertical), button:has(svg.lucide-more-vertical)')
        ).first();
        await expect(actionsTrigger).toBeVisible({ timeout: 10000 });
        await actionsTrigger.click();

        // 4. Confirm Delete is visible and Archive is NOT visible
        const deleteOption = page.getByRole('menuitem', { name: /Delete/i });
        await expect(deleteOption).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /Archive/i })).not.toBeVisible();

        // 5. Click Delete
        await deleteOption.click();

        // 6. Confirm the deletion dialog (ConfirmDeleteDialog)
        const deleteDialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
        await expect(deleteDialog).toBeVisible();
        await expect(deleteDialog.getByRole('heading', { name: /Delete Legal Entity\?/i })).toBeVisible();

        const confirmButton = deleteDialog.getByRole('button', { name: 'Delete', exact: true });
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        // 7. Assert the operation succeeds: success toast and redirect to /app
        await expect(page).toHaveURL(/\/app(\?.*)?$/, { timeout: 15000 });
        await expect(page.getByText(/Entity deleted/i)).toBeVisible({ timeout: 10000 });

        // 8. Verify the deleted ClientLE is absent from the active client org view
        await page.goto(`/app/clients/${clientOrgId}`);
        await expect(page.getByText(FIXTURE_NAME)).not.toBeVisible();

        // 9. Attempt direct navigation back to /app/le/[deleted-id]/master
        const response = await page.goto(`/app/le/${fixtureLEId}/master`);

        // 10. Assert operational dossier access is denied / Master Record is not displayed
        await expect(page.getByText('Master Record')).not.toBeVisible();
        await expect(page.getByRole('tab', { name: 'Master Data' })).not.toBeVisible();
        await expect(page.getByText(FIXTURE_NAME, { exact: true })).not.toBeVisible();
        if (response) {
            expect([200, 403, 404]).toContain(response.status());
        }

        // Database Assertions
        const dbLE = await prisma.clientLE.findUnique({
            where: { id: fixtureLEId }
        });
        expect(dbLE).not.toBeNull();
        expect(dbLE?.isDeleted).toBe(true);
        expect(dbLE?.status).toBe('ACTIVE'); // Status must remain ACTIVE, not changed to ARCHIVED
        expect(dbLE?.legalEntityId).toBe(fixtureLegalEntityId); // legalEntityId preserved
    });
});
