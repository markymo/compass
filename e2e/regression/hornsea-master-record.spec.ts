import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

const prisma = new PrismaClient();

const HORNSEA_LEI = '2138002S3XGZ38WN5Q72';
const HORNSEA_NAME = 'HORNSEA 1 LIMITED';
const HORNSEA_COMPANY_NO = '07640868';

test.describe('Hornsea 1 End-to-End Master Record UI Lifecycle Regression', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.clientOrgAdminA });
    test.setTimeout(180000);

    let testOrgId: string;
    let testStartedAt: Date;

    async function cleanupTestOrgHornseaBaseline(orgId: string) {
        if (!orgId || orgId !== '699fc2be-b7d4-4963-83fe-0e2ad9139cdd') {
            throw new Error(`[SAFETY GUARD] Refusing cleanup: Org ID "${orgId}" does not match UAT Test Org ID.`);
        }

        const dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl.includes('prod') && !dbUrl.includes('uat')) {
            throw new Error('[SAFETY GUARD] Refusing cleanup on Production database.');
        }

        const matchingLEs = await prisma.clientLE.findMany({
            where: {
                OR: [
                    { lei: HORNSEA_LEI },
                    { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }
                ],
                owners: { some: { partyId: orgId } }
            },
            select: { id: true, legalEntityId: true }
        });

        const leIds = matchingLEs.map(le => le.id);
        const legalEntityIds = matchingLEs.map(le => le.legalEntityId).filter((id): id is string => Boolean(id));

        if (leIds.length > 0) {
            await prisma.fieldClaim.deleteMany({
                where: { clientLEId: { in: leIds } }
            });

            await prisma.clientLEOwner.updateMany({
                where: { clientLEId: { in: leIds }, partyId: orgId },
                data: { endAt: new Date() }
            });

            await prisma.clientLE.updateMany({
                where: { id: { in: leIds } },
                data: { isDeleted: true, status: 'ARCHIVED' }
            });
        }

        if (legalEntityIds.length > 0) {
            await prisma.fieldClaim.deleteMany({
                where: { subjectLeId: { in: legalEntityIds } }
            });
        }

        const remainingActive = await prisma.clientLE.count({
            where: {
                isDeleted: false,
                status: { not: 'ARCHIVED' },
                OR: [
                    { lei: HORNSEA_LEI },
                    { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }
                ],
                owners: { some: { partyId: orgId, endAt: null } }
            }
        });

        expect(remainingActive, 'Zero active Hornsea dossiers must remain in test Client Org').toBe(0);
    }

    test.beforeAll(async () => {
        const manifest = loadUATManifest();
        testOrgId = manifest.clientOrgA.id;
        await cleanupTestOrgHornseaBaseline(testOrgId);
    });

    test('Customer Journey: Establish Blank Canvas -> Create & Enrich -> Verify Master Record UI', async ({ page }) => {
        testStartedAt = new Date();
        const manifest = loadUATManifest();

        // ---------------------------------------------------------------------
        // 1. NAVIGATE TO CLIENT ORG DASHBOARD
        // ---------------------------------------------------------------------
        await page.goto(`/app/clients/${testOrgId}`);
        await expect(page).toHaveURL(new RegExp(`/app/clients/${testOrgId}`));

        // ---------------------------------------------------------------------
        // 2. OPEN ADD LEGAL ENTITY MODAL & SEARCH VIA GLEIF
        // ---------------------------------------------------------------------
        const addEntityBtn = page.getByRole('button', { name: 'Add Legal Entity' }).first();
        await expect(addEntityBtn).toBeVisible({ timeout: 15000 });
        await addEntityBtn.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 10000 });

        const searchInput = page.getByRole('textbox', { name: 'Start typing company name...' }).first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('Hornsea');

        const hornseaOption = page.getByRole('button', { name: /HORNSEA 1 LIMITED/i }).first();
        await expect(hornseaOption).toBeVisible({ timeout: 15000 });
        await hornseaOption.click();

        // Ensure GLEIF asynchronous fetch completes
        await expect(page.getByText('Verified with GLEIF')).toBeVisible({ timeout: 15000 });

        const createSubmitBtn = page.getByRole('button', { name: 'Create Legal Entity' }).first();
        await expect(createSubmitBtn).toBeEnabled({ timeout: 10000 });
        await createSubmitBtn.click();

        // ---------------------------------------------------------------------
        // 3. STEP 2: CONFIGURE TEAM ACCESS & ASSIGN ADMIN ROLE
        // ---------------------------------------------------------------------
        const finishSetupBtn = page.getByRole('button', { name: 'Finish setup' }).first();
        await expect(finishSetupBtn).toBeVisible({ timeout: 45000 });

        const setAdminBtn = page.getByRole('button', { name: /Set .* access to Admin/i }).first();
        await expect(setAdminBtn).toBeVisible({ timeout: 20000 });
        await setAdminBtn.click();
        await expect(setAdminBtn).toHaveAttribute('aria-pressed', 'true');

        await expect(finishSetupBtn).toBeEnabled({ timeout: 10000 });
        await finishSetupBtn.click();

        // Wait for modal dismissal (durable state change, immune to ephemeral toast auto-dismiss timeouts)
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 20000 });

        // Ensure fresh client list
        await page.goto(`/app/clients/${testOrgId}`);
        await page.waitForLoadState('networkidle');

        const hornseaLink = page.locator('a[href*="/app/le/"]').filter({ hasText: /HORNSEA 1 LIMITED/i }).first();
        await expect(hornseaLink).toBeVisible({ timeout: 20000 });
        await hornseaLink.click();

        await expect(page).toHaveURL(/\/app\/le\/[a-zA-Z0-9-]+/, { timeout: 15000 });

        const masterRecordTab = page.getByRole('link', { name: 'Master Record' }).or(page.locator('a[href$="/master"]')).first();
        await expect(masterRecordTab).toBeVisible({ timeout: 15000 });
        await masterRecordTab.click();
        await expect(page).toHaveURL(/\/master/, { timeout: 15000 });

        // ---------------------------------------------------------------------
        // 5. STABLE UI MASTER FIELD ASSERTIONS
        // ---------------------------------------------------------------------
        const getFieldRow = (fieldNo: number) =>
            page.locator(`[data-testid="master-field-${fieldNo}"]`)
                .or(page.locator(`[data-field-no="${fieldNo}"]`))
                .or(page.locator(`[aria-label^="Inspect field ${fieldNo}:"]`))
                .or(page.locator('div.group').filter({ hasText: new RegExp(`\\bField ${fieldNo}\\b`) }))
                .first();

        // Field 3: Legal Name
        const field3 = getFieldRow(3);
        await expect(field3).toBeVisible({ timeout: 20000 });
        await expect(async () => {
            const text = (await field3.textContent()) || '';
            if (!text.includes('HORNSEA 1 LIMITED')) {
                await page.reload();
            }
            await expect(field3).toContainText('HORNSEA 1 LIMITED');
        }).toPass({ timeout: 45000, intervals: [3000, 5000] });

        await expect(field3).toContainText(/Companies House|GLEIF/i);

        // Field 2: LEI
        const field2 = getFieldRow(2);
        await expect(field2).toBeVisible({ timeout: 10000 });
        await expect(field2).toContainText(HORNSEA_LEI);

        // Field 138: Registered Address
        const field138 = getFieldRow(138);
        await expect(field138).toBeVisible({ timeout: 10000 });
        await expect(field138).toContainText('5 HOWICK PLACE');
        await expect(field138).toContainText('LONDON');
        await expect(field138).toContainText('SW1P 1WG');

        // Field 20: Industry Classification (UK SIC)
        const field20 = getFieldRow(20);
        await expect(field20).toBeVisible({ timeout: 10000 });
        await expect(field20).toContainText('82990');

        // Field 63: Company Directors (Repeating Party Cards)
        const field63 = getFieldRow(63);
        await expect(field63).toBeVisible({ timeout: 10000 });
        await expect(field63).toContainText(/Companies House/i);

        // Field 64: Persons of Significant Control
        const field64 = getFieldRow(64);
        await expect(field64).toBeVisible({ timeout: 10000 });
        await expect(field64).toContainText('Hornsea 1 Holdings Limited');

        // Field 5: Previous Legal Name
        const field5 = getFieldRow(5);
        await expect(field5).toBeVisible({ timeout: 10000 });
        await expect(field5).toContainText('HERON WIND LIMITED');

        // Field 54: Direct Parent Exception
        const field54 = getFieldRow(54);
        await expect(field54).toBeVisible({ timeout: 10000 });
        await expect(field54).toContainText('NO_LEI');

        // Field 37: Direct Parent (>50%) - Canonical Explicit None
        const field37 = getFieldRow(37);
        await expect(field37).toBeVisible({ timeout: 10000 });
        await expect(field37).toContainText('None');

        // ---------------------------------------------------------------------
        // 6. VERIFY EXACTLY 1 ACTIVE DOSSIER REMAINS IN DB
        // ---------------------------------------------------------------------
        const finalActiveCount = await prisma.clientLE.count({
            where: {
                isDeleted: false,
                status: { not: 'ARCHIVED' },
                OR: [
                    { lei: HORNSEA_LEI },
                    { name: { equals: HORNSEA_NAME, mode: 'insensitive' } }
                ],
                owners: { some: { partyId: testOrgId, endAt: null } }
            }
        });
        expect(finalActiveCount, 'Exactly 1 active Hornsea dossier must exist in test Client Org').toBe(1);

        console.log('\n========================================');
        console.log('✅ HORNSEA 1 MASTER RECORD UI REGRESSION COMPLETED CLEANLY');
        console.log(`Test Org: ${testOrgId}`);
        console.log(`Execution Duration: ${((Date.now() - testStartedAt.getTime()) / 1000).toFixed(1)}s`);
        console.log('========================================\n');
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });
});
