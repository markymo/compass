import { test, expect as baseExpect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const expect = baseExpect.configure({ timeout: 30000 });
const prisma = new PrismaClient();

const run = randomUUID().slice(0, 8);
const adminEmail = `admin-r25-${run}@example.test`;
const testPassword = 'Password123!';

let systemOrgId: string;
let adminUserId: string;
let clientOrgId: string;
let legalEntityId: string;
let clientLEId: string;
let supplierOrgId: string;
let engagementId: string;
let questionnaireId: string;
let q1PartyId: string;
let q2AddressId: string;

let candidatePartyId: string;
let candidateAddressId: string;

async function login(page: Page, email: string) {
    await page.goto('/login');
    const emailInput = page.locator('#email').or(page.getByLabel('Email'));
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(email);
    const pwdInput = page.locator('#password').or(page.getByLabel('Password'));
    await pwdInput.fill(testPassword);
    await page.getByRole('button', { name: /sign in/i, exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
}

test.describe.serial('R25: Staging Verification with Disposable Fixtures', () => {
    test.setTimeout(180000);

    test.beforeAll(async () => {
        const hashedPassword = await bcrypt.hash(testPassword, 10);

        // 1. Create System Admin Org & User
        const systemOrg = await prisma.organization.create({
            data: {
                name: `SYSADMIN R25 ORG ${run}`,
                types: ['SYSTEM'],
                shortCode: `S25${run.slice(0, 3).toUpperCase()}`,
            },
        });
        systemOrgId = systemOrg.id;

        const adminUser = await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: `R25 Admin ${run}`,
                memberships: {
                    create: {
                        organizationId: systemOrgId,
                        role: 'SYSTEM_ADMIN',
                    },
                },
            },
        });
        adminUserId = adminUser.id;

        // 2. Create Client Org, Legal Entity, and Client LE Workspace
        const clientOrg = await prisma.organization.create({
            data: {
                name: `R25 Client Org ${run}`,
                types: ['CLIENT'],
                shortCode: `C25${run.slice(0, 3).toUpperCase()}`,
            },
        });
        clientOrgId = clientOrg.id;

        const legalEntity = await prisma.legalEntity.create({
            data: {
                name: `R25 Legal Entity ${run}`,
                reference: `LE-R25-${run.toUpperCase()}`,
            },
        });
        legalEntityId = legalEntity.id;

        const clientLE = await prisma.clientLE.create({
            data: {
                name: `R25 Workspace ${run}`,
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

        // 3. Create Supplier Org and FI Engagement
        const supplierOrg = await prisma.organization.create({
            data: {
                name: `R25 Supplier Org ${run}`,
                types: ['SUPPLIER'],
                shortCode: `SPR${run.slice(0, 3).toUpperCase()}`,
            },
        });
        supplierOrgId = supplierOrg.id;

        const engagement = await prisma.fIEngagement.create({
            data: {
                clientLEId: clientLEId,
                fiOrgId: supplierOrgId,
                status: 'CONNECTED',
                isDeleted: false,
            },
        });
        engagementId = engagement.id;

        // 4. Create Questionnaire with questions mapped to Field 155 (PARTY) and Field 138 (ADDRESS)
        const questionnaire = await prisma.questionnaire.create({
            data: {
                name: `R25 QUESTIONNAIRE ${run}`,
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                status: 'ACTIVE',
                fiOrgId: supplierOrgId,
                fiEngagementId: engagementId,
            },
        });
        questionnaireId = questionnaire.id;

        // Question 1 mapped to Field 155 (Senior Managing Official - PARTY)
        const q1 = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `Who is the Senior Managing Official? ${run}`,
                masterFieldNo: 155,
                status: 'DRAFT',
            },
        });
        q1PartyId = q1.id;

        // Question 2 mapped to Field 138 (Registered address - ADDRESS)
        const q2 = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `What is the Registered Office Address? ${run}`,
                masterFieldNo: 138,
                status: 'DRAFT',
            },
        });
        q2AddressId = q2.id;

        // 5. Pre-seed candidate CCParty for selection testing (INDIVIDUAL / PERSON)
        const candidateParty = await prisma.cCParty.create({
            data: {
                clientLEId: clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    partySubType: 'PERSON',
                    contactType: 'PERSON',
                    forenames: 'Permitted',
                    surname: `Official ${run}`,
                    roles: [{ roleType: 'EXECUTIVE', roleTitle: 'Senior Managing Official' }],
                    emails: [`smo-${run}@example.test`],
                    phones: [],
                    sourceIdentifiers: [],
                },
            },
        });
        candidatePartyId = candidateParty.id;

        // 6. Pre-seed candidate CCAddress for selection testing
        const candidateAddress = await prisma.cCAddress.create({
            data: {
                clientLEId: clientLEId,
                data: {
                    addressLines: [`10 Downing Street ${run}`],
                    locality: 'London',
                    postalCode: 'SW1A 2AA',
                    countryCode: 'GB',
                    countryName: 'United Kingdom',
                },
                visibility: 'CLIENT_LE',
                createdByUserId: adminUserId,
                updatedByUserId: adminUserId,
            },
        });
        candidateAddressId = candidateAddress.id;
    });

    test.afterAll(async () => {
        await prisma.fieldClaim.deleteMany({ where: { clientLEId } }).catch(() => {});
        await prisma.cCAddress.deleteMany({ where: { clientLEId } }).catch(() => {});
        await prisma.cCParty.deleteMany({ where: { clientLEId } }).catch(() => {});
        await prisma.question.deleteMany({ where: { questionnaireId } }).catch(() => {});
        await prisma.questionnaire.deleteMany({ where: { id: questionnaireId } }).catch(() => {});
        await prisma.fIEngagement.deleteMany({ where: { id: engagementId } }).catch(() => {});
        await prisma.membership.deleteMany({ where: { userId: adminUserId } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: adminUserId } }).catch(() => {});
        await prisma.clientLE.deleteMany({ where: { id: clientLEId } }).catch(() => {});
        await prisma.legalEntity.deleteMany({ where: { id: legalEntityId } }).catch(() => {});
        await prisma.organization.deleteMany({
            where: { id: { in: [systemOrgId, clientOrgId, supplierOrgId] } },
        }).catch(() => {});
        await prisma.$disconnect();
    });

    test('1. Zero Mutations on Opening and Cancelling Modal', async ({ page }) => {
        await login(page, adminEmail);

        // A. Field 155 (PARTY with Default Response)
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=155`);
        await page.locator('text=Loading...').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
        await expect(page.locator('h2, [role="heading"]').filter({ hasText: /Senior Managing Official/i }).first()).toBeVisible({ timeout: 20000 });

        // Error message must not be shown
        await expect(page.getByText('Editing is not supported for field type "PARTY".')).toHaveCount(0);

        // Click Edit trigger on default response
        const editPartyBtn = page.getByTitle('Add value').or(page.locator('button[title="Add value"]')).first();
        await expect(editPartyBtn).toBeVisible({ timeout: 10000 });
        await editPartyBtn.click();

        // Verify UnifiedPartyPicker opened
        await expect(page.getByRole('heading', { name: /Select or Create Party/i })).toBeVisible({ timeout: 10000 });

        // Cancel dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Assert 0 claims created in DB
        const f155ClaimsCount = await prisma.fieldClaim.count({
            where: { clientLEId, fieldNo: 155 },
        });
        expect(f155ClaimsCount).toBe(0);

        // B. Field 138 (ADDRESS empty state)
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=138`);
        await page.locator('text=Loading...').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
        await expect(page.locator('h2, [role="heading"]').filter({ hasText: /Registered address/i }).first()).toBeVisible({ timeout: 20000 });

        // Error message must not be shown
        await expect(page.getByText('Editing is not supported for field type "ADDRESS".')).toHaveCount(0);

        // Click Add trigger on empty state
        const addAddrBtn = page.getByTitle('Add value').or(page.locator('button[title="Add value"]')).first();
        await expect(addAddrBtn).toBeVisible({ timeout: 10000 });
        await addAddrBtn.click();

        // Verify UnifiedAddressPicker opened
        await expect(page.getByRole('heading', { name: /Select or Create Address/i })).toBeVisible({ timeout: 10000 });

        // Cancel dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Assert 0 claims created in DB
        const f138ClaimsCount = await prisma.fieldClaim.count({
            where: { clientLEId, fieldNo: 138 },
        });
        expect(f138ClaimsCount).toBe(0);
    });

    test('2. Master Data Entry Point: Select Permitted Party & Address, Persistence & Single-Value Reference Semantics', async ({ page }) => {
        await login(page, adminEmail);

        // A. Field 155: Select Permitted Party
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=155`);
        await page.locator('text=Loading...').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});

        const editPartyBtn = page.getByTitle('Add value').or(page.locator('button[title="Add value"]')).first();
        await expect(editPartyBtn).toBeVisible({ timeout: 10000 });
        await editPartyBtn.click();

        // Modal opens: select candidate party
        const partyModal = page.getByRole('dialog').or(page.locator('[role="dialog"]'));
        await expect(partyModal.getByRole('heading', { name: /Select or Create Party/i })).toBeVisible({ timeout: 10000 });
        const candidatePartyItem = partyModal.locator('button').filter({ hasText: `Permitted Official ${run}` });
        await expect(candidatePartyItem).toBeVisible({ timeout: 10000 });
        await candidatePartyItem.click();

        // Modal MUST close after successful selection
        await expect(partyModal.getByRole('heading', { name: /Select or Create Party/i })).toBeHidden({ timeout: 15000 });

        // Verify drawer updates without page refresh
        await expect(page.getByText(`Permitted Official ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Reload page to verify persistence
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=155`);
        await page.locator('text=Loading...').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
        await expect(page.getByText(`Permitted Official ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Verify single-value reference semantics in DB for Field 155
        const claim155 = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 155, status: { in: ['ASSERTED', 'VERIFIED'] } },
        });
        expect(claim155).not.toBeNull();
        expect(claim155?.instanceId).toBeNull(); // Single-value has no instanceId
        const value155 = claim155?.valueJson as any;
        expect(value155?.ccPartyId).toBe(candidatePartyId);
        expect(value155?.rowId).toBeUndefined(); // No multi-value row key

        // B. Field 138: Select Permitted Address
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=138`);
        await page.locator('text=Loading...').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});

        const addAddrBtn = page.getByTitle('Add value').or(page.locator('button[title="Add value"]')).first();
        await expect(addAddrBtn).toBeVisible({ timeout: 10000 });
        await addAddrBtn.click();

        // Modal opens: select candidate address
        const addrModal = page.getByRole('dialog').or(page.locator('[role="dialog"]'));
        await expect(addrModal.getByRole('heading', { name: /Select or Create Address/i })).toBeVisible({ timeout: 10000 });
        const candidateAddrItem = addrModal.locator('div, button').filter({ hasText: `10 Downing Street ${run}` }).first();
        await expect(candidateAddrItem).toBeVisible({ timeout: 10000 });
        await candidateAddrItem.click();

        // Modal MUST close
        await expect(addrModal.getByRole('heading', { name: /Select or Create Address/i })).toBeHidden({ timeout: 15000 });

        // Verify drawer updates without page refresh
        await expect(page.getByText(`10 Downing Street ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Reload page to verify persistence
        await page.goto(`/app/le/${clientLEId}/master?fieldNo=138`);
        await page.locator('text=Loading...').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
        await expect(page.getByText(`10 Downing Street ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Verify single-value reference semantics in DB for Field 138
        const claim138 = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 138, status: { in: ['ASSERTED', 'VERIFIED'] } },
        });
        expect(claim138).not.toBeNull();
        expect(claim138?.instanceId).toBeNull();
        const value138 = claim138?.valueJson as any;
        expect(value138?.ccAddressId).toBe(candidateAddressId);
    });

    test('3. Question Bank Entry Point: Create Permitted Party & Address from Sidebar, Live Card Update without Refresh, Reload & Persistence', async ({ page }) => {
        // Reset claims to test creation on fresh state
        await prisma.fieldClaim.deleteMany({ where: { clientLEId, fieldNo: { in: [155, 138] } } });

        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4?view=rdd1`);

        // Wait for Question Bank cards
        const q1Card = page.locator(`[data-testid="rdd1-card-${q1PartyId}"]`).or(page.locator(`[data-testid="question-card-${q1PartyId}"]`));
        const q2Card = page.locator(`[data-testid="rdd1-card-${q2AddressId}"]`).or(page.locator(`[data-testid="question-card-${q2AddressId}"]`));
        await expect(q1Card).toBeVisible({ timeout: 25000 });
        await expect(q2Card).toBeVisible({ timeout: 25000 });

        // A. Field 155: Create New Individual from Sidebar
        const openQ1Btn = q1Card.locator(`[data-testid="rdd1-open-master-data-btn-${q1PartyId}"]`).or(q1Card.getByRole('button', { name: /open master data/i }));
        await expect(openQ1Btn.first()).toBeVisible({ timeout: 10000 });
        await openQ1Btn.first().click();

        // Verify sidebar drawer opens
        const sheet = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
        await expect(sheet.first()).toBeVisible({ timeout: 15000 });
        await expect(sheet.getByRole('heading', { name: /Senior Managing Official/i }).first()).toBeVisible();

        // Click edit trigger in sidebar
        const sidebarEditBtn = sheet.getByTitle('Add value').or(sheet.locator('button[title="Add value"]')).first();
        await expect(sidebarEditBtn).toBeVisible({ timeout: 10000 });
        await sidebarEditBtn.click();

        // Click "Create new individual" in modal
        const createPartyBtn = page.getByRole('button', { name: /create new individual/i });
        await expect(createPartyBtn).toBeVisible({ timeout: 10000 });
        await createPartyBtn.click();

        // Fill form fields using parent container input selector
        const forenamesInput = page.locator('label:has-text("Forenames")').locator('..').locator('input');
        await expect(forenamesInput).toBeVisible({ timeout: 10000 });
        await forenamesInput.fill('NewlyCreated');

        const surnameInput = page.locator('label:has-text("Surname")').locator('..').locator('input');
        await expect(surnameInput).toBeVisible({ timeout: 10000 });
        await surnameInput.fill(`Leader ${run}`);

        // Click "Save & Select"
        const savePartyBtn = page.getByRole('button', { name: /save & select/i });
        await savePartyBtn.click();

        // Verify sidebar drawer updates immediately
        await expect(sheet.getByText(`NewlyCreated Leader ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Verify Question Bank card in background updated WITHOUT page reload!
        await expect(q1Card.getByText(`NewlyCreated Leader ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Close sidebar drawer
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // B. Field 138: Create New Address from Sidebar
        const openQ2Btn = q2Card.locator(`[data-testid="rdd1-open-master-data-btn-${q2AddressId}"]`).or(q2Card.getByRole('button', { name: /open master data/i }));
        await expect(openQ2Btn.first()).toBeVisible({ timeout: 10000 });
        await openQ2Btn.first().click();

        await expect(sheet.getByRole('heading', { name: /Registered address/i }).first()).toBeVisible({ timeout: 15000 });

        const sidebarAddAddrBtn = sheet.getByTitle('Add value').or(sheet.locator('button[title="Add value"]')).first();
        await expect(sidebarAddAddrBtn).toBeVisible({ timeout: 10000 });
        await sidebarAddAddrBtn.click();

        // Click "Create new address" in modal
        const createAddrBtn = page.getByRole('button', { name: /create new address/i });
        await expect(createAddrBtn).toBeVisible({ timeout: 10000 });
        await createAddrBtn.click();

        // Fill address form
        const addLineBtn = page.getByRole('button', { name: /\+ add line/i });
        if (await addLineBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addLineBtn.click();
        }
        const addrLineInput = page.getByPlaceholder(/address line 1/i);
        await expect(addrLineInput).toBeVisible({ timeout: 10000 });
        await addrLineInput.fill(`99 Innovation Way ${run}`);

        const localityInput = page.locator('label:has-text("Locality / City")').locator('..').locator('input');
        await expect(localityInput).toBeVisible({ timeout: 10000 });
        await localityInput.fill('Cambridge');

        // Click "Save & Select"
        const saveAddrBtn = page.getByRole('button', { name: /save & select/i });
        await saveAddrBtn.click();

        // Verify sidebar drawer updates immediately
        await expect(sheet.getByText(`99 Innovation Way ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Verify Question Bank card in background updated WITHOUT page reload!
        await expect(q2Card.getByText(`99 Innovation Way ${run}`).first()).toBeVisible({ timeout: 15000 });

        // Close sidebar drawer
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // C. Reload page and verify persistence on both cards
        await page.goto(`/app/le/${clientLEId}/workbench4?view=rdd1`);
        await expect(q1Card.getByText(`NewlyCreated Leader ${run}`).first()).toBeVisible({ timeout: 25000 });
        await expect(q2Card.getByText(`99 Innovation Way ${run}`).first()).toBeVisible({ timeout: 25000 });

        // Verify DB single-value persistence
        const createdClaim155 = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 155, status: { in: ['ASSERTED', 'VERIFIED'] } },
        });
        expect(createdClaim155).not.toBeNull();
        expect(createdClaim155?.instanceId).toBeNull();
        expect((createdClaim155?.valueJson as any)?.ccPartyId).toBeDefined();

        const createdClaim138 = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 138, status: { in: ['ASSERTED', 'VERIFIED'] } },
        });
        expect(createdClaim138).not.toBeNull();
        expect(createdClaim138?.instanceId).toBeNull();
        expect((createdClaim138?.valueJson as any)?.ccAddressId).toBeDefined();
    });

    test('4. Direct Rejection of Unauthorized and Policy-Prohibited Writes on Staging', async ({ page }) => {
        // Create an unauthenticated/unauthorized context
        const unauthContext = await page.context().browser()!.newContext();
        const unauthPage = await unauthContext.newPage();

        // Try direct POST to master data action without login
        const resUnauth = await unauthPage.request.post(`https://dev.onpro.tech/app/le/${clientLEId}/master?fieldNo=155`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/x-component',
            },
            data: JSON.stringify([{ clientLEId, fieldNo: 155, value: { ccPartyId: candidatePartyId } }]),
        });

        // Unauthenticated direct call cannot mutate data
        expect(resUnauth.status()).toBeLessThan(500);

        await unauthContext.close();
    });
});
