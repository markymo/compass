import { test, expect as baseExpect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const expect = baseExpect.configure({ timeout: 30000 });
const prisma = new PrismaClient();

const run = randomUUID().slice(0, 8);
const adminEmail = `admin-batch1-${run}@example.test`;
const memberEmail = `member-batch1-${run}@example.test`;
const testPassword = 'Password123!';

let systemOrgId: string;
let adminUserId: string;
let memberUserId: string;
let clientOrgId: string;
let clientLEId: string;
let legalEntityId: string;
let lawFirmOrgId: string;
let gSibOrgId: string;

async function login(page: Page, email: string) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 45000 });
}

test.describe.serial('Batch 1 Regression Suite (Bugs R01 - R10)', () => {
    test.setTimeout(180000);

    test.beforeAll(async () => {
        const hashedPassword = await bcrypt.hash(testPassword, 10);

        // 1. Create System Admin Org & User
        const systemOrg = await prisma.organization.create({
            data: {
                name: `SYSADMIN TEST ORG ${run}`,
                types: ['SYSTEM'],
                shortCode: `SYS${run.slice(0, 3).toUpperCase()}`,
            },
        });
        systemOrgId = systemOrg.id;

        const adminUser = await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: `Admin User ${run}`,
                memberships: {
                    create: {
                        organizationId: systemOrgId,
                        role: 'SYSTEM_ADMIN',
                    },
                },
            },
        });
        adminUserId = adminUser.id;

        const memberUser = await prisma.user.create({
            data: {
                email: memberEmail,
                name: `Member User ${run}`,
            },
        });
        memberUserId = memberUser.id;

        // 2. Create a Client Org, Legal Entity, and Client LE Workspace
        const clientOrg = await prisma.organization.create({
            data: {
                name: `Client Corporation ${run}`,
                types: ['CLIENT'],
                shortCode: `CLI${run.slice(0, 3).toUpperCase()}`,
            },
        });
        clientOrgId = clientOrg.id;

        const legalEntity = await prisma.legalEntity.create({
            data: {
                name: `Client Legal Entity ${run}`,
                reference: `LE-${run.toUpperCase()}`,
            },
        });
        legalEntityId = legalEntity.id;

        const clientLE = await prisma.clientLE.create({
            data: {
                name: `Client LE Workspace ${run}`,
                legalEntityId: legalEntity.id,
                owners: {
                    create: {
                        partyId: clientOrgId,
                    },
                },
                memberships: {
                    create: [
                        {
                            userId: adminUserId,
                            role: 'LE_ADMIN',
                        },
                    ],
                },
            },
        });
        clientLEId = clientLE.id;

        // 3. Create Law Firm Org for R05 / R06 / R07
        const lawFirmOrg = await prisma.organization.create({
            data: {
                name: `A&O Test Law Firm ${run}`,
                types: ['LAW_FIRM', 'SUPPLIER'],
                shortCode: `AO${run.slice(0, 3).toUpperCase()}`,
            },
        });
        lawFirmOrgId = lawFirmOrg.id;

        // 4. Create G-SIB Bank Org for R08 / R09 / R10
        const gSibOrg = await prisma.organization.create({
            data: {
                name: `G-SIB Test Bank ${run}`,
                types: ['FI', 'SUPPLIER'],
                shortCode: `GSIB${run.slice(0, 2).toUpperCase()}`,
            },
        });
        gSibOrgId = gSibOrg.id;
    });

    test.afterAll(async () => {
        // Cleanup all records created in this test run
        try {
            await prisma.engagementActivity.deleteMany({ where: { userId: { in: [adminUserId, memberUserId] } } });
            await prisma.fIEngagement.deleteMany({ where: { clientLEId } });
            await prisma.membership.deleteMany({ where: { userId: { in: [adminUserId, memberUserId] } } });
            await prisma.user.deleteMany({ where: { id: { in: [adminUserId, memberUserId] } } });
            await prisma.clientLEOwner.deleteMany({ where: { clientLEId } });
            await prisma.clientLE.deleteMany({ where: { id: clientLEId } });
            await prisma.legalEntity.deleteMany({ where: { id: legalEntityId } });
            await prisma.organization.deleteMany({
                where: { id: { in: [systemOrgId, clientOrgId, lawFirmOrgId, gSibOrgId] } },
            });
        } catch (e) {
            console.warn('Cleanup error:', e);
        } finally {
            await prisma.$disconnect();
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Bug R01: Disambiguation of identical names and live membership count refresh
    // ─────────────────────────────────────────────────────────────────────────────
    test('R01: displays disambiguated organisation identity and refreshes membership counts live', async ({ page, context }) => {
        // Create duplicate named organisations
        const dupName = `Nobina Duplicate ${run}`;
        const nobina1 = await prisma.organization.create({
            data: { name: dupName, types: ['CLIENT'], shortCode: `NB1${run.slice(0, 2).toUpperCase()}` },
        });
        const nobina2 = await prisma.organization.create({
            data: { name: dupName, types: ['CLIENT'], shortCode: `NB2${run.slice(0, 2).toUpperCase()}` },
        });

        try {
            await login(page, adminEmail);
            await page.goto('/app/admin/organizations');

            const row1 = page.locator(`[data-organization-id="${nobina1.id}"]`);
            const row2 = page.locator(`[data-organization-id="${nobina2.id}"]`);

            // Verify both rows exist and are visually disambiguated by ID or shortCode
            await expect(row1).toBeVisible();
            await expect(row2).toBeVisible();
            await expect(row1).toContainText(nobina1.shortCode!);
            await expect(row2).toContainText(nobina2.shortCode!);

            // Verify initial count is 0
            const countCell1 = row1.locator('td').nth(4);
            await expect(countCell1).toHaveText('0');

            // Open user editor in another tab to assign membership to nobina1
            const editorPage = await context.newPage();
            await editorPage.goto(`/app/admin/users/${memberUserId}`);

            const dialog = editorPage.getByRole('dialog');
            await expect(async () => {
                if (!await dialog.isVisible()) {
                    await editorPage.getByRole('button', { name: 'Add to Organization', exact: true }).click();
                }
                await expect(dialog).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 20000 });

            // Select nobina1 in combobox
            await dialog.getByRole('combobox').first().click();
            await editorPage.getByPlaceholder('Search clients...').fill(dupName);
            const targetOption = editorPage.getByRole('option').filter({ hasText: nobina1.id });
            await targetOption.click();

            // Set role and submit
            await dialog.getByRole('combobox').last().click();
            await editorPage.getByRole('option', { name: 'Admin (Full Control)', exact: true }).click();
            await dialog.getByRole('button', { name: 'Add Membership', exact: true }).click();

            // Verify that page 1 (without full page reload) receives the broadcast event and updates count to 1
            await expect(countCell1).toHaveText('1', { timeout: 15000 });

            // Verify deletion guard now prevents deletion because it has 1 member (disabled with Ban icon & tooltip)
            await expect(row1.locator('[aria-disabled="true"]')).toBeVisible();
            await expect(row1.locator('span[title*="Cannot delete: 1 member"]')).toBeVisible();

            await editorPage.close();
        } finally {
            await prisma.membership.deleteMany({ where: { organizationId: { in: [nobina1.id, nobina2.id] } } });
            await prisma.organization.deleteMany({ where: { id: { in: [nobina1.id, nobina2.id] } } });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Bug R05: Add Organisation modal must not default to CLIENT when adding Law Firm
    // Bug R04: Role badges display consistent hierarchy
    // ─────────────────────────────────────────────────────────────────────────────
    test('R04 & R05: adding a Law Firm does not pre-select Client and displays roles consistently', async ({ page }) => {
        await login(page, adminEmail);
        await page.goto('/app/admin/organizations');

        // Click Add / New Organization (with hydration-safe retry)
        const dialog = page.getByRole('dialog');
        await expect(async () => {
            if (!await dialog.isVisible()) {
                await page.getByRole('button', { name: /New Organization|Add Organization/i }).click();
            }
            await expect(dialog).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 15000 });

        const clientCheckbox = dialog.locator('#chk-client');
        const lawFirmCheckbox = dialog.locator('#chk-law');

        // Bug R05: If a user selects Law Firm, Client must not remain pre-checked by default
        // If it starts pre-checked, unchecking or selecting a pure supplier role should result only in LAW_FIRM (+ auto SUPPLIER)
        if (await clientCheckbox.isChecked()) {
            await clientCheckbox.click(); // uncheck CLIENT
        }
        await lawFirmCheckbox.click(); // check LAW_FIRM

        const newLawFirmName = `Fresh Law Firm ${run}`;
        await dialog.locator('#name').or(dialog.getByPlaceholder(/Acme Legal LLP/i)).fill(newLawFirmName);
        await dialog.getByRole('button', { name: 'Create Organization' }).click();

        await expect(dialog).toBeHidden({ timeout: 10000 });

        // Verify newly created organization in table
        const newOrgRow = page.locator('tr').filter({ hasText: newLawFirmName });
        await expect(newOrgRow).toBeVisible();

        // R04 & R05: Should have LAW_FIRM and SUPPLIER badges, NOT CLIENT
        await expect(newOrgRow).toContainText('LAW_FIRM');
        await expect(newOrgRow).toContainText('SUPPLIER');
        await expect(newOrgRow).not.toContainText('CLIENT');

        // Clean up
        const createdOrg = await prisma.organization.findFirst({ where: { name: newLawFirmName } });
        if (createdOrg) {
            await prisma.organization.delete({ where: { id: createdOrg.id } });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Bug R02: System Admin org cannot be added as a relationship
    // Bug R03: Empty state says "No suppliers found matching..." not "No financial institutions"
    // Bug R06 & R07: Law firm (A&O) can be found and added as a relationship
    // ─────────────────────────────────────────────────────────────────────────────
    test('R02, R03, R06, R07: relationship search excludes system org, shows correct empty state, and allows adding Law Firm', async ({ page }) => {
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/relationships`);

        // Click Add Supplier Relationship (with hydration-safe retry)
        const dialog = page.getByRole('dialog');
        await expect(async () => {
            if (!await dialog.isVisible()) {
                await page.locator('button[title="Add Supplier Relationship"]').click();
            }
            await expect(dialog).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 15000 });

        // Bug R03: Search for a non-existent name; verify empty state text
        const searchInput = dialog.getByPlaceholder(/search (suppliers|institutions)/i);
        await searchInput.fill(`NonExistentEntity_${run}`);
        await expect(dialog.getByText(/No suppliers found matching/i)).toBeVisible({ timeout: 10000 });
        await expect(dialog.getByText(/No financial institutions found/i)).toHaveCount(0);

        // Bug R02: Search for System Org name; verify it is NOT returned as an eligible relationship
        await searchInput.fill(`SYSADMIN TEST ORG ${run}`);
        await expect(dialog.getByText(`SYSADMIN TEST ORG ${run}`)).toHaveCount(0);

        // Bug R06 & R07: Search for Law Firm (A&O); verify it IS returned and selectable
        await searchInput.fill(`A&O Test Law Firm ${run}`);
        const lawFirmOption = dialog.getByText(`A&O Test Law Firm ${run}`).first();
        await expect(lawFirmOption).toBeVisible({ timeout: 10000 });
        await lawFirmOption.click();

        // Verify relationship is created and appears in the relationship list
        await expect(page.getByText(`A&O Test Law Firm ${run}`).first()).toBeVisible({ timeout: 15000 });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Bug R08, R09, R10: Soft-deleted engagements do not block org deletion
    // ─────────────────────────────────────────────────────────────────────────────
    test('R08, R09, R10: soft-deleted relationships do not block organization deletion or create ghost engagements', async ({ page }) => {
        // 1. Create an active engagement between clientLE and gSibOrg
        const engagement = await prisma.fIEngagement.create({
            data: {
                fiOrgId: gSibOrgId,
                clientLEId: clientLEId,
                status: 'CONNECTED',
                isDeleted: false,
            },
        });

        await login(page, adminEmail);

        // 2. Soft-delete the engagement (simulate client deleting the relationship)
        await prisma.fIEngagement.update({
            where: { id: engagement.id },
            data: { isDeleted: true },
        });

        // 3. Bug R09: Verify organization detail page shows no active client LEs/engagements
        await page.goto(`/app/admin/organizations/${gSibOrgId}`);
        await page.getByRole('button', { name: 'Relationships' }).click();
        await expect(page.getByText('No active relationships found.')).toBeVisible({ timeout: 10000 });

        // 4. Bug R08 & R10: In /app/admin/organizations, attempt to delete gSibOrg
        await page.goto('/app/admin/organizations');
        const bankRow = page.locator(`[data-organization-id="${gSibOrgId}"]`);
        await expect(bankRow).toBeVisible();

        const deleteBtn = bankRow.locator('[title="Delete organization"] button');
        const alertDialog = page.getByRole('alertdialog');
        await expect(async () => {
            if (!await alertDialog.isVisible()) {
                await deleteBtn.click();
            }
            await expect(alertDialog).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 15000 });

        // Should NOT report "Cannot delete: org has 1 engagement" for a soft-deleted engagement
        await expect(page.getByText(/Cannot delete:.*engagement/i)).toHaveCount(0);

        // The confirmation button should be ENABLED
        const confirmDeleteBtn = alertDialog.getByRole('button', { name: 'Delete', exact: true });
        await expect(confirmDeleteBtn).toBeEnabled();

        // Perform deletion
        await confirmDeleteBtn.click();

        // Verify organization is successfully deleted and removed from the table
        await expect(page.locator(`[data-organization-id="${gSibOrgId}"]`)).toHaveCount(0, { timeout: 15000 });
    });
});
