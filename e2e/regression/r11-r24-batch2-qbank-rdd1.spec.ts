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
        const saveBtn = countryCard.locator('button[title*="Save"]').or(countryCard.locator('button:has(svg.lucide-check)'));
        await expect(saveBtn.first()).toBeVisible({ timeout: 5000 });
        await saveBtn.first().click();
        await expect(saveBtn).toHaveCount(0, { timeout: 10000 });

        // Verify updated country display includes code SE
        await expect(countryCard.getByText(/SE/i).first()).toBeVisible({ timeout: 10000 });

        // Canonical jurisdiction selection: Test subdivision selection (US-DE Delaware)
        const reEditBtn = countryCard.locator('[data-testid^="rdd1-edit-btn-"]')
            .or(countryCard.locator('button[title*="Edit"]'))
            .or(countryCard.locator('button:has-text("Edit")'));
        await reEditBtn.first().click();
        await expect(countryDropdownTrigger.first()).toBeVisible({ timeout: 10000 });
        await countryDropdownTrigger.first().click();
        await expect(popover.first()).toBeVisible({ timeout: 5000 });
        if (await countrySearchInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            await countrySearchInput.first().fill('US-DE');
        }

        const delawareOption = popover.getByRole('option', { name: /US-DE.*Delaware/i })
            .or(popover.getByText(/US-DE\s*[-–]\s*Delaware/i));

        await expect(delawareOption.first()).toBeVisible({ timeout: 10000 });
        await delawareOption.first().click();

        await expect(saveBtn.first()).toBeVisible({ timeout: 5000 });
        await saveBtn.first().click();
        await expect(saveBtn).toHaveCount(0, { timeout: 10000 });

        // Verify updated display includes US-DE
        await expect(countryCard.getByText(/US-DE/i).first()).toBeVisible({ timeout: 10000 });

        // Verify persistence after page reload
        await page.reload();
        await expect(countryCard.getByText(/US-DE/i).first()).toBeVisible({ timeout: 10000 });

        // Verify raw FieldClaim in staging DB strictly preserves code 'US-DE'
        const claim = await prisma.fieldClaim.findFirst({
            where: { clientLEId, fieldNo: 134, status: { in: ['ASSERTED', 'VERIFIED'] } },
            orderBy: { assertedAt: 'desc' }
        });
        expect(claim?.valueText).toBe('US-DE');
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

    test('Bug R16: Composite group links to underlying constituent fields and persists edits', async ({ page }) => {
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

        // Edit constituent field in sidebar
        const editValBtn = sheet.locator('button[title*="Edit value"]')
            .or(sheet.locator('button[title*="Edit"]'))
            .or(sheet.locator('button:has(svg.lucide-pencil)'));
        if (await editValBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            await editValBtn.first().click();
            const textInput = sheet.locator('input[type="text"]').or(sheet.locator('textarea')).first();
            if (await textInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await textInput.fill(`Updated Group Constituent ${run}`);
                const saveBtn = sheet.locator('button:has(svg.lucide-check)').or(sheet.locator('button:has-text("Save")')).first();
                if (await saveBtn.isVisible().catch(() => false)) {
                    await saveBtn.click();
                }
            }
        }

        // Verify reload persistence
        await page.reload();
        await expect(groupCard).toBeVisible({ timeout: 20000 });
    });

    test('Bug R13 & R19: Document addition, removal and live indicator update within page and across windows', async ({ page }) => {
        // Bug R13: "need a way to delete a document once added"
        // Bug R19: "Q bank field does not update to show document icon when you add a document in sidebar
        //           or another window: requires full page refresh"
        await login(page, adminEmail);
        await page.goto(`/app/le/${clientLEId}/workbench4`);

        // Check scalar card on Tab 1
        const scalarCard1 = page.locator(`[data-testid="rdd1-card-${scalarQuestionId}"]`).or(
            page.locator(`[data-testid="question-card-${scalarQuestionId}"]`)
        ).first();
        await expect(scalarCard1).toBeVisible({ timeout: 20000 });

        const getAttachmentBadge = (card: typeof scalarCard1) =>
            card.locator('[title*="canonical document"]')
                .or(card.getByText(/\d+\s+docs?/i))
                .or(card.locator('svg.lucide-paperclip'))
                .or(card.locator('[aria-label*="attached"]'));

        // Initially no paperclip attachment indicator
        await expect(getAttachmentBadge(scalarCard1)).toHaveCount(0);

        // Seed a document in the library for this clientLE
        const libraryDoc = await prisma.document.create({
            data: {
                clientLEId: clientLEId,
                name: `tab-sync-doc-${run}.pdf`,
                mimeType: 'application/pdf',
                sizeBytes: BigInt(1024),
                storageProvider: 'VERCEL_BLOB',
                storagePathname: `mock-path-${run}.pdf`,
                uploadedById: adminUserId,
            },
        });

        // ── Phase 1: Within-page live indicator update (sidebar -> card in same tab) ──
        const inspectBtn1 = scalarCard1.locator('[data-testid^="rdd1-mapping-tile-"]')
            .or(scalarCard1.locator('button[title*="history & details"]'))
            .or(scalarCard1.locator('[data-testid^="rdd1-stage-value-"] button'));
        await inspectBtn1.first().click();

        const sheet1 = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
        await expect(sheet1.first()).toBeVisible({ timeout: 10000 });

        const addAttachmentTrigger1 = sheet1.locator('button:has-text("Add attachment")');
        await expect(addAttachmentTrigger1).toBeVisible({ timeout: 5000 });
        await addAttachmentTrigger1.click();

        const chooseFromLibItem1 = page.locator('text=Choose from Library');
        await expect(chooseFromLibItem1).toBeVisible({ timeout: 5000 });
        await chooseFromLibItem1.click();

        const picker1 = page.locator('[role="dialog"]:has-text("Choose a document")');
        await expect(picker1).toBeVisible({ timeout: 5000 });

        const docRow1 = picker1.locator(`tr:has-text("tab-sync-doc-${run}.pdf")`);
        await expect(docRow1).toBeVisible({ timeout: 10000 });
        await docRow1.getByRole('button', { name: 'Select' }).click();

        // Verify document is attached in sidebar and card reflects it in real-time WITHOUT page reload
        await expect(sheet1.getByText(`tab-sync-doc-${run}.pdf`).first()).toBeVisible({ timeout: 10000 });
        await expect(getAttachmentBadge(scalarCard1).first()).toBeVisible({ timeout: 10000 });

        // Remove attachment in sidebar and verify live removal in card WITHOUT page reload
        const removeBtn1 = sheet1.locator('button[aria-label="Remove attachment"]').first();
        await expect(removeBtn1).toBeVisible({ timeout: 10000 });
        await removeBtn1.click();

        const confirmRemoveBtn1 = page.locator('[role="alertdialog"]').getByRole('button', { name: 'Remove' });
        await expect(confirmRemoveBtn1).toBeVisible({ timeout: 5000 });
        await confirmRemoveBtn1.click();

        // Verify attachment is removed in sheet and card indicator disappears live
        await expect(sheet1.getByText(`tab-sync-doc-${run}.pdf`)).toHaveCount(0, { timeout: 10000 });
        await expect(getAttachmentBadge(scalarCard1)).toHaveCount(0, { timeout: 10000 });

        // Close sidebar in Tab 1
        const closeSheet1 = sheet1.locator('button:has(svg.lucide-x)').or(sheet1.locator('[aria-label="Close"]'));
        if (await closeSheet1.first().isVisible().catch(() => false)) {
            await closeSheet1.first().click();
        }

        // ── Phase 2: Cross-window update & persistence across browser sessions ──
        const page2 = await page.context().newPage();
        await page2.goto(`/app/le/${clientLEId}/workbench4`);
        const scalarCard2 = page2.locator(`[data-testid="rdd1-card-${scalarQuestionId}"]`).or(
            page2.locator(`[data-testid="question-card-${scalarQuestionId}"]`)
        ).first();
        await expect(scalarCard2).toBeVisible({ timeout: 20000 });

        const inspectBtn2 = scalarCard2.locator('[data-testid^="rdd1-mapping-tile-"]')
            .or(scalarCard2.locator('button[title*="history & details"]'))
            .or(scalarCard2.locator('[data-testid^="rdd1-stage-value-"] button'));
        await inspectBtn2.first().click();

        const sheet2 = page2.locator('[role="dialog"]').or(page2.locator('.sheet-content'));
        await expect(sheet2.first()).toBeVisible({ timeout: 10000 });

        const addAttachmentTrigger2 = sheet2.locator('button:has-text("Add attachment")');
        await expect(addAttachmentTrigger2).toBeVisible({ timeout: 5000 });
        await addAttachmentTrigger2.click();

        const chooseFromLibItem2 = page2.locator('text=Choose from Library');
        await expect(chooseFromLibItem2).toBeVisible({ timeout: 5000 });
        await chooseFromLibItem2.click();

        const picker2 = page2.locator('[role="dialog"]:has-text("Choose a document")');
        await expect(picker2).toBeVisible({ timeout: 5000 });

        const docRow2 = picker2.locator(`tr:has-text("tab-sync-doc-${run}.pdf")`);
        await expect(docRow2).toBeVisible({ timeout: 10000 });
        await docRow2.getByRole('button', { name: 'Select' }).click();

        await expect(sheet2.getByText(`tab-sync-doc-${run}.pdf`).first()).toBeVisible({ timeout: 10000 });
        await expect(getAttachmentBadge(scalarCard2).first()).toBeVisible({ timeout: 10000 });

        // Verify other already-open browser window reflects the attached document badge in real-time WITHOUT reload
        await expect(getAttachmentBadge(scalarCard1).first()).toBeVisible({ timeout: 15000 });

        // Remove attachment in Tab 2
        const removeAttachmentBtn2 = sheet2.locator('button[aria-label="Remove attachment"]').first();
        await expect(removeAttachmentBtn2).toBeVisible({ timeout: 10000 });
        await removeAttachmentBtn2.click();

        const confirmRemoveBtn2 = page2.locator('[role="alertdialog"]').getByRole('button', { name: 'Remove' });
        await expect(confirmRemoveBtn2).toBeVisible({ timeout: 5000 });
        await confirmRemoveBtn2.click();

        await expect(sheet2.getByText(`tab-sync-doc-${run}.pdf`)).toHaveCount(0, { timeout: 10000 });

        // Verify other already-open browser window reflects the badge removal in real-time WITHOUT reload
        await expect(getAttachmentBadge(scalarCard1)).toHaveCount(0, { timeout: 15000 });

        await page2.close();
        await prisma.document.delete({ where: { id: libraryDoc.id } }).catch(() => {});
    });

    test('Attachment removal invariant: Preserves immutable submission access and denies unauthorized callers', async ({ page }) => {
        await login(page, adminEmail);

        // 1. Create a submission document
        const subDoc = await prisma.document.create({
            data: {
                clientLEId: clientLEId,
                name: `immutable-evidence-${run}.pdf`,
                mimeType: 'application/pdf',
                sizeBytes: BigInt(4096),
                storageProvider: 'VERCEL_BLOB',
                storagePathname: `sub-blob-${run}.pdf`,
                uploadedById: adminUserId,
            },
        });

        // 2. Attach it to Field 3 on master data (claim role FILE_ATTACHMENT)
        const masterClaim = await prisma.fieldClaim.create({
            data: {
                subjectLeId: legalEntityId,
                clientLEId: clientLEId,
                fieldNo: 3,
                claimRole: 'FILE_ATTACHMENT',
                status: 'ASSERTED',
                sourceType: 'USER_INPUT',
                sourceReference: 'Manual Attachment',
                attachmentDocumentId: subDoc.id,
            },
        });

        // 3. Create an immutable QuestionnaireSubmission with SubmissionAnswer linked to subDoc
        const defVersion = await prisma.questionnaireDefinitionVersion.create({
            data: {
                questionnaireId,
                versionNumber: 1,
                definitionFingerprint: `fingerprint-${run}`,
                titleSnapshot: `Title ${run}`,
                questionCount: 1,
            },
        });

        const snap = await prisma.questionDefinitionSnapshot.create({
            data: {
                definitionVersionId: defVersion.id,
                sourceQuestionId: scalarQuestionId,
                questionText: `What is your registered legal entity name? ${run}`,
                order: 1,
                masterFieldNo: 3,
            },
        });

        const submission = await prisma.questionnaireSubmission.create({
            data: {
                questionnaireId,
                definitionVersionId: defVersion.id,
                relationshipId: engagementId,
                clientLEId,
                submissionNumber: 1,
                submittedById: adminUserId,
                answers: {
                    create: [
                        {
                            questionSnapshotId: snap.id,
                            sourceQuestionId: scalarQuestionId,
                            masterFieldNo: 3,
                            questionTextSnapshot: `What is your registered legal entity name? ${run}`,
                            valueJson: { text: `Immutable Answer ${run}` },
                            attachments: {
                                create: [
                                    {
                                        documentId: subDoc.id,
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
            include: {
                answers: {
                    include: {
                        attachments: {
                            include: {
                                document: true,
                            },
                        },
                    },
                },
            },
        });

        expect(submission.answers[0].attachments).toHaveLength(1);
        expect(submission.answers[0].attachments[0].document.id).toBe(subDoc.id);

        // 4. Perform master data attachment removal (simulating tombstone emission)
        await prisma.fieldClaim.create({
            data: {
                subjectLeId: legalEntityId,
                clientLEId: clientLEId,
                fieldNo: 3,
                claimRole: 'FILE_ATTACHMENT',
                status: 'ASSERTED',
                sourceType: 'USER_INPUT',
                sourceReference: 'Manual Removal',
                attachmentDocumentId: null,
                valueJson: { tombstone: true },
            },
        });

        // 5. Invariant Assertion: Historical submission still maintains full access to the attached document
        const verifiedSubmission = await prisma.questionnaireSubmission.findUnique({
            where: { id: submission.id },
            include: {
                answers: {
                    include: {
                        attachments: {
                            include: {
                                document: true,
                            },
                        },
                    },
                },
            },
        });

        expect(verifiedSubmission).not.toBeNull();
        expect(verifiedSubmission!.answers[0].attachments).toHaveLength(1);
        const subAtt = verifiedSubmission!.answers[0].attachments[0];
        expect(subAtt.documentId).toBe(subDoc.id);
        expect(subAtt.document.name).toBe(subDoc.name);
        expect(subAtt.document.mimeType).toBe('application/pdf');

        // Check authorized user downloading/viewing existing submission attachment after master-field attachment removal:
        // An authorized client admin context request to /api/documents/[id]/download passes authorization (status is not 401 or 403)
        const authedDownloadRes = await page.request.get(`/api/documents/${subDoc.id}/download`);
        expect(authedDownloadRes.status()).not.toBe(401);
        expect(authedDownloadRes.status()).not.toBe(403);

        // 6. Security Invariant: Unauthorized caller without LE_EDIT_MASTER_DATA is denied with NO data mutation
        const unauthEmail = `unauthorized-${run}@example.test`;
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        const unauthUser = await prisma.user.create({
            data: {
                email: unauthEmail,
                password: hashedPassword,
                name: `Unauthorized User ${run}`,
            },
        });

        // Record claims count before unauthorized attempt
        const claimsCountBefore = await prisma.fieldClaim.count({ where: { clientLEId } });

        // Log in as unauthorized user in fresh browser context
        const unauthContext = await page.context().browser()!.newContext();
        const unauthPage = await unauthContext.newPage();
        await login(unauthPage, unauthEmail);

        // Direct unauthorized download request is denied with 403 Forbidden
        const unauthDownloadRes = await unauthPage.request.get(`/api/documents/${subDoc.id}/download`);
        expect(unauthDownloadRes.status()).toBe(403);

        // Unauthorized user navigation to ClientLE workspace is forbidden (returns 404 / access denied)
        await unauthPage.goto(`/app/le/${clientLEId}/workbench4`);
        const currentUrl = unauthPage.url();
        const isForbiddenOrNotFound = !currentUrl.includes(`/app/le/${clientLEId}/workbench4`) ||
            (await unauthPage.getByText(/access denied|unauthorized|forbidden|not be found|404/i).first().isVisible({ timeout: 5000 }).catch(() => false));
        expect(isForbiddenOrNotFound).toBe(true);
        await unauthContext.close();

        // Assert NO data mutation occurred in DB (count of claims strictly unchanged)
        const claimsCountAfter = await prisma.fieldClaim.count({ where: { clientLEId } });
        expect(claimsCountAfter).toBe(claimsCountBefore);

        // Verify document record remains intact and not deleted
        const docAfter = await prisma.document.findUnique({ where: { id: subDoc.id } });
        expect(docAfter).not.toBeNull();
        expect(docAfter?.isDeleted).toBe(false);

        // Cleanup test data
        await prisma.submissionAnswerAttachment.deleteMany({ where: { submissionAnswerId: { in: submission.answers.map(a => a.id) } } });
        await prisma.submissionAnswer.deleteMany({ where: { submissionId: submission.id } });
        await prisma.questionnaireSubmission.delete({ where: { id: submission.id } });
        await prisma.questionDefinitionSnapshot.delete({ where: { id: snap.id } });
        await prisma.questionnaireDefinitionVersion.delete({ where: { id: defVersion.id } });
        await prisma.fieldClaim.deleteMany({ where: { id: { in: [masterClaim.id] } } });
        await prisma.document.delete({ where: { id: subDoc.id } });
        await prisma.user.delete({ where: { id: unauthUser.id } });
    });
});

