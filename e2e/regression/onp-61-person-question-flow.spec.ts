import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QB-01 — Mapped person/party Master data flows to Question Bank/Workbench
// Linear: ONP-61

const prisma = new PrismaClient();

test.describe('QB-01 / ONP-61 — Mapped Person/Party Master Data Flow to Question Bank/Workbench', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.supplierOrgAdminA });
    test.setTimeout(90000);

    let supplierOrgId: string;
    let alphaEngagementId: string;
    let clientLEId: string;
    let subjectLeId: string;
    let testUser: any;
    let testQuestionnaire: any;
    let testQuestion: any;
    let initialParty: any;
    let updatedParty: any;
    let initialClaim: any;
    let updatedClaim: any;

    const testPrefix = `QB01 Mapped Party Flow ${Date.now()}`;
    const initialForenames = `Winston`;
    const initialSurname = `Churchill-${Date.now().toString().slice(-4)}`;
    const initialName = `${initialForenames} ${initialSurname}`;
    const initialEmail = `winston.churchill.${Date.now()}@partyqb.example`;

    const updatedForenames = `Clement`;
    const updatedSurname = `Attlee-${Date.now().toString().slice(-4)}`;
    const updatedName = `${updatedForenames} ${updatedSurname}`;
    const updatedEmail = `clement.attlee.${Date.now()}@partyqb.example`;

    test.beforeAll(async () => {
        // Dynamically locate UAT alpha ClientLE and its connected supplier engagement
        const clientLE = await prisma.clientLE.findFirst({
            where: { shortCode: 'uat_cle_alpha' }
        });
        if (!clientLE) throw new Error('uat_cle_alpha not found in database');

        const engagement = await prisma.fIEngagement.findFirst({
            where: { clientLEId: clientLE.id, isDeleted: false }
        });
        if (!engagement) throw new Error(`Active engagement for ${clientLE.id} not found`);

        clientLEId = clientLE.id;
        subjectLeId = clientLE.legalEntityId || clientLE.id;
        supplierOrgId = engagement.fiOrgId;
        alphaEngagementId = engagement.id;

        testUser = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });

        // 1. Create questionnaire attached to supplier and relationship
        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: `${testPrefix} QN`,
                description: 'Testing Master party data flow to supplier questions workbench',
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                engagements: { connect: { id: alphaEngagementId } }
            }
        });

        // 2. Create question mapped to Field 104 (SSI callback contact) with status SHARED
        testQuestion = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: `${testPrefix}: Who is the designated SSI callback contact?`,
                order: 1,
                masterFieldNo: 104,
                expectedDataType: 'PARTY',
                status: 'SHARED'
            }
        });

        // 3. Create initial CCParty for Field 104
        initialParty = await prisma.cCParty.create({
            data: {
                clientLEId: clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    forenames: initialForenames,
                    surname: initialSurname,
                    emails: [initialEmail],
                    phones: [{ type: 'MOBILE', number: '+44 7700 900111' }],
                    roles: [{ roleType: 'CONTACT', roleTitle: 'Primary SSI Contact' }],
                    sourceIdentifiers: []
                }
            }
        });

        // 4. Create authoritative FieldClaim for Field 104 with initialParty
        initialClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 104,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'MANUAL_ENTRY',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedByUserId: testUser?.id || (await prisma.user.findFirst())?.id!,
                verifiedAt: new Date(),
                valueJson: {
                    ccPartyId: initialParty.id
                }
            }
        });
    });

    test.afterAll(async () => {
        if (testQuestionnaire?.id) {
            await prisma.question.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
            await prisma.questionnaire.deleteMany({ where: { id: testQuestionnaire.id } });
        }
        if (initialClaim?.id) {
            await prisma.fieldClaim.deleteMany({ where: { id: { in: [initialClaim.id, updatedClaim?.id].filter(Boolean) } } });
        }
        if (initialParty?.id) {
            await prisma.cCParty.deleteMany({ where: { id: { in: [initialParty.id, updatedParty?.id].filter(Boolean) } } });
        }
        await prisma.$disconnect();
    });

    test('1. Mapped person/party Master data flows to Question Bank/Workbench and updates dynamically on Master change', async ({ page }) => {
        // Step 1: Open Supplier Questions Workbench filtered by test question search text
        await page.goto(`/app/s/${supplierOrgId}/questions?s=${encodeURIComponent(testPrefix)}`);
        await page.waitForLoadState('networkidle');

        // Verify question card renders with distinctive question text
        const questionHeading = page.locator(`h3:has-text("${testPrefix}")`).first();
        await expect(questionHeading).toBeVisible({ timeout: 15000 });

        // Assert the distinctive mapped Master party value (name & email) flows to the rendered answer
        const answerSection = page.locator('.space-y-4, .card, div').filter({ hasText: testPrefix }).first();
        await expect(answerSection).toContainText(initialName, { timeout: 10000 });
        await expect(answerSection).toContainText(initialEmail, { timeout: 10000 });

        // Step 2: Update observable Master property in database to updatedParty
        updatedParty = await prisma.cCParty.create({
            data: {
                clientLEId: clientLEId,
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    forenames: updatedForenames,
                    surname: updatedSurname,
                    emails: [updatedEmail],
                    phones: [{ type: 'MOBILE', number: '+44 7700 900222' }],
                    roles: [{ roleType: 'CONTACT', roleTitle: 'Secondary SSI Contact' }],
                    sourceIdentifiers: []
                }
            }
        });

        // Supersonic newer claim supersedes initial claim
        updatedClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 104,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'MANUAL_ENTRY',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(Date.now() + 5000),
                verifiedByUserId: testUser?.id || (await prisma.user.findFirst())?.id!,
                verifiedAt: new Date(Date.now() + 5000),
                valueJson: {
                    ccPartyId: updatedParty.id
                }
            }
        });

        // Step 3: Reload Supplier Questions Workbench and assert dynamic update
        await page.reload();
        await page.waitForLoadState('networkidle');

        const reloadedAnswerSection = page.locator('.space-y-4, .card, div').filter({ hasText: testPrefix }).first();
        await expect(reloadedAnswerSection).toContainText(updatedName, { timeout: 15000 });
        await expect(reloadedAnswerSection).toContainText(updatedEmail, { timeout: 15000 });
    });
});
