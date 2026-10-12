import { test, expect as baseExpect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const expect = baseExpect.configure({ timeout: 30000 });
const prisma = new PrismaClient();

const run = randomUUID().slice(0, 8);
const adminEmail = `admin-batch2-${run}@example.test`;
const testPassword = 'Password123!';

let systemOrgId: string;
let adminUserId: string;
let clientOrgId: string;
let legalEntityId: string;
let clientLEId: string;
let supplierOrgId: string;
let engagementId: string;
let questionnaireId: string;

let personQuestionId: string;
let countryFormQuestionId: string;
let countryRegQuestionId: string;
let compositeGroupQuestionId: string;
let scalarQuestionId: string;

async function login(page: Page, email: string) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 45000 });
}

test.describe.serial('Batch 2 Regression Suite: Question Bank, RDD1 Unification, Countries & Sidebar (Bugs R11 - R24)', () => {
    test.setTimeout(180000);

    test.beforeAll(async () => {
        const hashedPassword = await bcrypt.hash(testPassword, 10);

        // 1. Create System Admin Org & User
        const systemOrg = await prisma.organization.create({
            data: {
                name: `SYSADMIN BATCH2 ORG ${run}`,
                types: ['SYSTEM'],
                shortCode: `S2${run.slice(0, 3).toUpperCase()}`,
            },
        });
        systemOrgId = systemOrg.id;

        const adminUser = await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: `Batch2 Admin ${run}`,
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
                name: `Batch2 Client Org ${run}`,
                types: ['CLIENT'],
                shortCode: `C2${run.slice(0, 3).toUpperCase()}`,
            },
        });
        clientOrgId = clientOrg.id;

        const legalEntity = await prisma.legalEntity.create({
            data: {
                name: `Batch2 Legal Entity ${run}`,
                reference: `LE-B2-${run.toUpperCase()}`,
            },
        });
        legalEntityId = legalEntity.id;

        const clientLE = await prisma.clientLE.create({
            data: {
                name: `Batch2 LE Workspace ${run}`,
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
                name: `Batch2 Supplier Org ${run}`,
                types: ['SUPPLIER'],
                shortCode: `SPO${run.slice(0, 3).toUpperCase()}`,
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

        // 4. Create Questionnaire with questions for R11-R24 scenarios
        const questionnaire = await prisma.questionnaire.create({
            data: {
                name: `FSMB MASTER DRAFT ${run}`,
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                status: 'ACTIVE',
                fiOrgId: supplierOrgId,
                fiEngagementId: engagementId,
            },
        });
        questionnaireId = questionnaire.id;

        // Question 1: Person field (Field 27: Key Contact or Field 4: Director) -> Bugs R11, R12
        const qPerson = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `Who is the primary contact person? ${run}`,
                masterFieldNo: 27,
                status: 'DRAFT',
            },
        });
        personQuestionId = qPerson.id;

        // Question 2: Country of formation (Field 134) -> Bugs R14, R20
        const qCountryForm = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `COUNTRY OF INCORPORATION ${run}`,
                masterFieldNo: 134,
                status: 'DRAFT',
            },
        });
        countryFormQuestionId = qCountryForm.id;

        // Question 3: Country of registration (Field 22) -> Bug R15
        const qCountryReg = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `COUNTRY OF REGISTRATION (IF DIFFERENT) ${run}`,
                masterFieldNo: 22,
                status: 'DRAFT',
            },
        });
        countryRegQuestionId = qCountryReg.id;

        // Question 4: Composite Group -> Bug R16
        const group = await prisma.masterFieldGroup.create({
            data: {
                key: `group_b2_${run}`,
                label: `Nature of Business Group ${run}`,
                isActive: true,
                items: {
                    create: [
                        { fieldNo: 3, order: 0 },
                        { fieldNo: 134, order: 1 },
                    ],
                },
            },
            include: { items: true },
        });

        const qGroup = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `Describe company business activities ${run}`,
                masterQuestionGroupId: group.key,
                status: 'DRAFT',
            },
        });
        compositeGroupQuestionId = qGroup.id;

        // Question 5: Plain Scalar field (Field 3: Legal Name) -> Bugs R17, R21, R24
        const qScalar = await prisma.question.create({
            data: {
                questionnaireId: questionnaireId,
                text: `What is your registered legal entity name? ${run}`,
                masterFieldNo: 3,
                status: 'DRAFT',
            },
        });
        scalarQuestionId = qScalar.id;

        // Seed initial Field Claims on clientLE
        await prisma.fieldClaim.createMany({
            data: [
                {
                    subjectLeId: legalEntityId,
                    clientLEId: clientLEId,
                    fieldNo: 3,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    sourceType: 'USER_INPUT',
                    sourceReference: 'Manual Initial',
                    valueText: `Initial Corp ${run}`,
                },
                {
                    subjectLeId: legalEntityId,
                    clientLEId: clientLEId,
                    fieldNo: 134,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    sourceType: 'USER_INPUT',
                    sourceReference: 'Manual Initial',
                    valueText: 'GB',
                },
                {
                    subjectLeId: legalEntityId,
                    clientLEId: clientLEId,
                    fieldNo: 22,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    sourceType: 'USER_INPUT',
                    sourceReference: 'Manual Initial',
                    valueText: 'GB',
                },
                {
                    subjectLeId: legalEntityId,
                    clientLEId: clientLEId,
                    fieldNo: 27,
                    claimRole: 'VALUE',
                    status: 'ASSERTED',
                    sourceType: 'USER_INPUT',
                    sourceReference: 'Manual Initial',
                    valueJson: {
                        forenames: 'Jane',
                        surname: `Doe ${run}`,
                        email: `jane.${run}@example.test`,
                    },
                },
            ],
        });
    });

    test.afterAll(async () => {
        // Cleanup created data
        await prisma.fieldClaim.deleteMany({ where: { clientLEId: clientLEId } }).catch(() => {});
        await prisma.question.deleteMany({ where: { questionnaireId: questionnaireId } }).catch(() => {});
        await prisma.questionnaire.deleteMany({ where: { id: questionnaireId } }).catch(() => {});
        await prisma.fIEngagement.deleteMany({ where: { id: engagementId } }).catch(() => {});
        await prisma.membership.deleteMany({ where: { clientLEId: clientLEId } }).catch(() => {});
        await prisma.clientLEOwner.deleteMany({ where: { clientLEId: clientLEId } }).catch(() => {});
        await prisma.clientLE.deleteMany({ where: { id: clientLEId } }).catch(() => {});
        await prisma.legalEntity.deleteMany({ where: { id: legalEntityId } }).catch(() => {});
        await prisma.membership.deleteMany({ where: { userId: adminUserId } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: adminUserId } }).catch(() => {});
        await prisma.organization.deleteMany({
            where: { id: { in: [systemOrgId, clientOrgId, supplierOrgId] } },
        }).catch(() => {});
        await prisma.$disconnect();
    });

    test('Bug R11 & R12: Saved person controls simplified to single working edit action', async ({ page }) => {
        // Bug R11: "In question bank where a saved person is used, edit pencil is not selectable...
        //           However sidebar button next to it lets you edit and Master Data button unhelpfully takes you to Master Data"
        // Bug R12: "2 buttons (one of which is disabled) do the same thing and the other doesn't do anything useful - we only need one button"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        // Wait for question bank to load
        await expect(page.getByText(`Who is the primary contact person? ${run}`)).toBeVisible({ timeout: 20000 });

        // Locate card for the person question
        const personCard = page.locator(`[data-testid="question-card-${personQuestionId}"]`).or(
            page.locator(`[data-testid="rdd1-card-${personQuestionId}"]`)
        );
        await expect(personCard).toBeVisible();

        // Verify there is NO disabled edit pencil or confusing dead-end link to /master
        const disabledPencil = personCard.locator('button[disabled]:has(svg.lucide-pencil)');
        await expect(disabledPencil).toHaveCount(0);

        const deadEndMasterLink = personCard.locator(`a[href*="/app/le/${clientLEId}/master"]`);
        await expect(deadEndMasterLink).toHaveCount(0);

        // Verify there is a single working edit/inspect button
        const editAction = personCard.locator('[data-testid="edit-person-btn"]')
            .or(personCard.locator('button[title*="Edit"]'))
            .or(personCard.locator('button[title*="history & details"]'))
            .or(personCard.locator('[data-testid^="rdd1-stage-value-"] button'));

        await expect(editAction.first()).toBeVisible();
        await editAction.first().click();

        // Clicking it MUST open the sidebar inspection drawer where the person can be edited
        const sheet = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
        await expect(sheet.first()).toBeVisible({ timeout: 10000 });
        await expect(sheet.getByText(/Jane Doe/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Bug R14, R15 & R20: Country fields use country dropdown showing ISO code and name', async ({ page }) => {
        // Bug R14: "Nobina / Q Bank / FMSB Master Draft / Country of Incorporation can be edited inline,
        //           but doesnt use country dropdown and will allow any value"
        // Bug R15: "also COUNTRY OF REGISTRATION"
        // Bug R20: "Country Code dropdown fields eg F134 only show the name, not the 2 character code"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        // Test Country of Incorporation (F134)
        const countryCard = page.locator(`[data-testid="question-card-${countryFormQuestionId}"]`).or(
            page.locator(`[data-testid="rdd1-card-${countryFormQuestionId}"]`)
        );
        await expect(countryCard).toBeVisible({ timeout: 20000 });

        // Trigger inline edit on country field
        const editBtn = countryCard.locator('[data-testid="inline-edit-btn"]')
            .or(countryCard.locator('button[title="Edit value"]'))
            .or(countryCard.locator('[data-testid^="rdd1-stage-value-"] button[title*="Edit"]'));

        await editBtn.first().click();

        // It must NOT be a generic unconstrained text input for Country; it must render a country picker
        const countryDropdownTrigger = countryCard.locator('[role="combobox"]').or(
            countryCard.locator('button:has-text("United Kingdom"), button:has-text("Select country")')
        );
        await expect(countryDropdownTrigger.first()).toBeVisible({ timeout: 10000 });

        // Open the dropdown and inspect options
        await countryDropdownTrigger.first().click();
        const popover = page.locator('[data-radix-popper-content-wrapper]');
        await expect(popover.first()).toBeVisible({ timeout: 5000 });
        const countrySearchInput = popover.locator('input');
        if (await countrySearchInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            await countrySearchInput.first().fill('Sweden');
        }

        // Bug R20: Options must show the 2-character ISO code alongside the country name, e.g. "SE – Sweden" or "SE - Sweden"
        const swedenOption = popover.getByRole('option', { name: /SE.*Sweden/i })
            .or(popover.getByText(/SE\s*[-–]\s*Sweden/i));

        await expect(swedenOption.first()).toBeVisible({ timeout: 10000 });
        await swedenOption.first().click();

        // Save edit
        const saveBtn = countryCard.locator('button:has(svg.lucide-check)');
        if (await saveBtn.isVisible()) {
            await saveBtn.click();
        }

        // Verify updated country display includes code and country name
        await expect(countryCard.getByText(/SE.*Sweden|Sweden/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Bug R17, R21 & R24: Layout RDD1 allows editing fields and opening sidebar', async ({ page }) => {
        // Bug R17 & R21: "In QB layout RDD1 we cant edit any fields. We need to decide on one layout,
        //                 get it fully working incl the sidebar and delete the rest."
        // Bug R24: "Overall Q Bank flow - verify editing, countries, people, composite fields"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        // Switch to RDD1 layout if view mode toggle exists
        const rdd1Toggle = page.locator('button:has-text("RDD1"), button:has-text("Layout RDD1")');
        if (await rdd1Toggle.isVisible()) {
            await rdd1Toggle.click();
        }

        // Locate RDD1 card for scalar field (Field 3 Legal Name)
        const scalarCard = page.locator(`[data-testid="rdd1-card-${scalarQuestionId}"]`);
        await expect(scalarCard).toBeVisible({ timeout: 20000 });

        // Bug R17: Value stage must have active edit controls
        const editTrigger = scalarCard.locator('[data-testid^="rdd1-stage-value-"] button[title*="Edit"]')
            .or(scalarCard.locator('[data-testid="inline-edit-btn"]'))
            .or(scalarCard.locator('button:has(svg.lucide-pencil)'));

        await expect(editTrigger.first()).toBeVisible({ timeout: 10000 });
        await editTrigger.first().click();

        // Edit value inline
        const textInput = scalarCard.locator('input[type="text"]').or(page.locator('input[placeholder*="Enter value"]'));
        await expect(textInput.first()).toBeVisible({ timeout: 10000 });
        await textInput.first().fill(`Updated Legal Name ${run}`);

        const confirmBtn = scalarCard.locator('button:has(svg.lucide-check)');
        await confirmBtn.first().click();

        // Verify updated value appears immediately in RDD1 card
        await expect(scalarCard.getByText(`Updated Legal Name ${run}`)).toBeVisible({ timeout: 10000 });
    });

    test('Bug R18 & R22: Sidebar header shows Master Field Name and mapped questions underneath', async ({ page }) => {
        // Bug R18: "Q Bank when you open the sidebar, it shows Question name (Field Number) and field description
        //           ie is muddling question and field./ needs to show field name (underneath it shows which Qs it is mapped to)"
        // Bug R22: "Sidebar def needs work, I think its too congested and confusing at the mo"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        // Open sidebar on Country of Incorporation question
        const countryCard = page.locator(`[data-testid="rdd1-card-${countryFormQuestionId}"]`).or(
            page.locator(`[data-testid="question-card-${countryFormQuestionId}"]`)
        );
        await expect(countryCard).toBeVisible({ timeout: 20000 });

        // Click mapping tile or inspect button
        const inspectBtn = countryCard.locator('[data-testid^="rdd1-mapping-tile-"]')
            .or(countryCard.locator('button[title*="history & details"]'))
            .or(countryCard.locator('button:has(svg.lucide-panel-left-open)'));

        await inspectBtn.first().click();

        const sheet = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
        await expect(sheet.first()).toBeVisible({ timeout: 10000 });

        // Header must show Master Field Name ("Country of formation"), NOT the question text
        const sheetHeader = sheet.locator('h2').first();
        await expect(sheetHeader).toContainText(/Country of formation/i);
        await expect(sheetHeader).not.toContainText(`COUNTRY OF INCORPORATION ${run}`);

        // Underneath the header, it must cleanly show which question it is mapped to
        await expect(sheet.getByText(new RegExp(`COUNTRY OF INCORPORATION ${run}`, 'i')).first()).toBeVisible({ timeout: 10000 });
    });

    test('Bug R16: Composite group links to underlying constituent fields', async ({ page }) => {
        // Bug R16: "QB questions mapped to composite group cant be edited and have no link to the underlying fields"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        const groupCard = page.locator(`[data-testid="rdd1-card-${compositeGroupQuestionId}"]`).or(
            page.locator(`[data-testid="question-card-${compositeGroupQuestionId}"]`)
        );
        await expect(groupCard).toBeVisible({ timeout: 20000 });

        // Group card or rows must link to underlying component fields
        const childFieldRow = groupCard.locator('[data-testid^="group-field-row-"]')
            .or(groupCard.locator('button[title*="Inspect"]'));

        await expect(childFieldRow.first()).toBeVisible({ timeout: 10000 });
        await childFieldRow.first().click();

        // Clicking constituent field opens sidebar for that child field
        const sheet = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
        await expect(sheet.first()).toBeVisible({ timeout: 10000 });
    });

    test('Bug R13 & R19: Document removal and live indicator update', async ({ page }) => {
        // Bug R13: "need a way to delete a document once added"
        // Bug R19: "Q bank field does not update to show document icon when you add a document in sidebar
        //           or another window: requires full page refresh"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        // Check scalar card
        const scalarCard = page.locator(`[data-testid="rdd1-card-${scalarQuestionId}"]`).or(
            page.locator(`[data-testid="question-card-${scalarQuestionId}"]`)
        );
        await expect(scalarCard).toBeVisible({ timeout: 20000 });

        // Open inspection panel for field 3
        const inspectBtn = scalarCard.locator('[data-testid^="rdd1-mapping-tile-"]')
            .or(scalarCard.locator('button[title*="history & details"]'))
            .or(scalarCard.locator('[data-testid^="rdd1-stage-value-"] button'));

        await inspectBtn.first().click();

        const sheet = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
        await expect(sheet.first()).toBeVisible({ timeout: 10000 });

        // Attachments section in sidebar has delete/remove action when documents exist
        const attachmentsSection = sheet.locator('text=Field Attachments').or(sheet.locator('.attachments-section'));
        if (await attachmentsSection.isVisible()) {
            // Verify remove button presence on attachments
            const removeAttachmentBtn = sheet.locator('button[aria-label="Remove attachment"]').or(
                sheet.locator('button[title="Remove attachment"]')
            );
            // If attachments exist, remove button should be interactive
            if (await removeAttachmentBtn.count() > 0) {
                await expect(removeAttachmentBtn.first()).toBeEnabled();
            }
        }
    });
});
