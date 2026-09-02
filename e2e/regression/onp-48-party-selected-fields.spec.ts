import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: PARTY-05 — Selected party fields/mappings are honoured
// Linear: ONP-48

const prisma = new PrismaClient();

test.describe('PARTY-05 / ONP-48 — Party Selected Fields & Display Mask Parity', () => {
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let testClientLE: any;
    let testLegalEntity: any;
    let testUser: any;
    let testParty: any;
    let testClaim: any;
    let testEngagement: any;
    let testQuestionnaire: any;
    let testQuestion: any;

    const testTimestamp = Date.now();
    const testPrefix = `PARTY05 Test ${testTimestamp}`;
    const forenameA = `Arthur${testTimestamp.toString().slice(-4)}`;
    const surnameB = `Pendelton${testTimestamp.toString().slice(-4)}`;
    const unselectedAttrC = `SECRET_UNSELECTED_${testTimestamp}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        testUser = await prisma.user.findFirst({
            where: { email: manifest.actors.leAdminAlpha.email }
        });
        if (!testUser) throw new Error('Test user not found');

        // Create disposable Legal Entity
        testLegalEntity = await prisma.legalEntity.create({
            data: {
                name: `${testPrefix} Corp`,
                reference: `LE-${testTimestamp}`
            }
        });

        // Create disposable ClientLE linked to legalEntity
        testClientLE = await prisma.clientLE.create({
            data: {
                name: `${testPrefix} Client LE`,
                legalEntity: { connect: { id: testLegalEntity.id } },
                status: 'ACTIVE'
            }
        });

        // Add user membership for ClientLE Admin
        await prisma.membership.create({
            data: {
                userId: testUser.id,
                clientLEId: testClientLE.id,
                role: 'LE_ADMIN'
            }
        });

        // Create controlled CCParty with:
        // - Attribute A (forenames): distinctive value
        // - Attribute B (surname): distinctive value
        // - Attribute C (unselected/sensitive notes): distinctive value
        testParty = await prisma.cCParty.create({
            data: {
                clientLEId: testClientLE.id,
                data: {
                    contactType: 'PERSON',
                    partyType: 'INDIVIDUAL',
                    forenames: forenameA,
                    surname: surnameB,
                    displayName: `${forenameA} ${surnameB}`,
                    notes: unselectedAttrC,
                    taxId: unselectedAttrC,
                    roles: [
                        {
                            roleType: 'CALLBACK_CONTACT',
                            roleTitle: 'SSI Callback Specialist',
                            appointedOn: '2022-01-01',
                            isActiveRole: true
                        }
                    ]
                }
            }
        });

        // Add verified manual claim on Field 104 (SSI callback contacts) referencing CCParty
        testClaim = await prisma.fieldClaim.create({
            data: {
                clientLEId: testClientLE.id,
                subjectLeId: testLegalEntity.id,
                fieldNo: 104,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: `${testPrefix}_CLAIM_104`,
                valueJson: {
                    ccPartyId: testParty.id,
                    forenames: forenameA,
                    surname: surnameB,
                    notes: unselectedAttrC,
                    taxId: unselectedAttrC
                },
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date(),
                verifiedAt: new Date(),
                verifiedByUserId: testUser.id
            }
        });

        // Create engagement between clientLE and Supplier Org A
        testEngagement = await prisma.fIEngagement.create({
            data: {
                clientLE: { connect: { id: testClientLE.id } },
                org: { connect: { id: manifest.supplierOrgA.id } },
                status: 'CONNECTED'
            }
        });

        // Add relationship membership for operational persona
        const relAdminUser = await prisma.user.findFirst({
            where: { email: manifest.actors.relationshipAdminAlpha.email }
        });
        if (relAdminUser) {
            await prisma.membership.create({
                data: {
                    userId: relAdminUser.id,
                    fiEngagementId: testEngagement.id,
                    role: 'RELATIONSHIP_ADMIN'
                }
            });
        }

        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                fiOrg: { connect: { id: manifest.supplierOrgA.id } },
                fiEngagement: { connect: { id: testEngagement.id } },
                name: `${testPrefix} Assigned Questionnaire`,
                isTemplate: false,
                isGlobal: false,
                status: 'ACTIVE',
                kind: 'ENGAGEMENT_QUESTIONNAIRE',
                referenceCode: `ASSIGNED_${testTimestamp}`,
                questions: {
                    create: [
                        {
                            text: `Who is the primary SSI callback contact for ${testPrefix}?`,
                            order: 1,
                            masterFieldNo: 104,
                            status: 'SHARED'
                        }
                    ]
                }
            },
            include: { questions: true }
        });
        testQuestion = testQuestionnaire.questions[0];
    });

    test.afterAll(async () => {
        try {
            if (testQuestionnaire?.id) {
                await prisma.question.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
                await prisma.questionnaire.delete({ where: { id: testQuestionnaire.id } });
            }
            if (testEngagement?.id) {
                await prisma.membership.deleteMany({ where: { fiEngagementId: testEngagement.id } });
                await prisma.fIEngagement.delete({ where: { id: testEngagement.id } });
            }
            if (testClaim?.id) {
                await prisma.fieldClaim.deleteMany({ where: { clientLEId: testClientLE.id } });
            }
            if (testParty?.id) {
                await prisma.cCParty.delete({ where: { id: testParty.id } });
            }
            if (testClientLE?.id) {
                await prisma.membership.deleteMany({ where: { clientLEId: testClientLE.id } });
                await prisma.clientLE.delete({ where: { id: testClientLE.id } });
            }
            if (testLegalEntity?.id) {
                await prisma.legalEntity.delete({ where: { id: testLegalEntity.id } });
            }
        } catch (err) {
            console.warn('Cleanup warning in onp-48:', err);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('1. Configured Master Field 104 displays selected attributes A & B while omitting unselected attribute C', async ({ browser }) => {
        // Step 1: Open page as LE Admin
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();

        try {
            await page.goto(`/app/le/${testClientLE.id}/master`);
            await page.waitForLoadState('domcontentloaded');

            // Step 2: Locate Field 104 card
            const fieldCard = page.locator('[data-testid="master-field-104"], [data-field-no="104"]').first();
            await expect(fieldCard).toBeVisible({ timeout: 15000 });

            // Step 3: Assert selected attributes A & B are displayed
            await expect(fieldCard).toContainText(forenameA);
            await expect(fieldCard).toContainText(surnameB);

            // Step 4: Assert unselected/masked attribute C is absent from display
            await expect(fieldCard).not.toContainText(unselectedAttrC);
        } finally {
            await context.close();
        }
    });

    test('2. Mapped question in Supplier Workbench displays the intended projected Party representation', async ({ browser }) => {
        // Step 1: Open page as Supplier Relationship Admin
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.relationshipAdminAlpha });
        const page = await context.newPage();

        try {
            await page.goto(`/app/s/${manifest.supplierOrgA.id}/questions`);
            await page.waitForLoadState('domcontentloaded');

            // Step 2: Find question row mapped to Field 104
            const questionTextLocator = page.locator(`text=Who is the primary SSI callback contact for ${testPrefix}?`).first();
            await expect(questionTextLocator).toBeVisible({ timeout: 15000 });

            const row = questionTextLocator.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "border")]').first();
            await expect(row).toBeVisible();

            // Step 3: Assert projected party answer displays selected attributes A & B
            await expect(row).toContainText(forenameA);
            await expect(row).toContainText(surnameB);

            // Step 4: Assert unselected attribute C is absent from mapped answer
            await expect(row).not.toContainText(unselectedAttrC);
        } finally {
            await context.close();
        }
    });

    test('3. Unmapped / unconfigured party fields do not fabricate party data', async ({ browser }) => {
        const context = await browser.newContext({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
        const page = await context.newPage();

        try {
            await page.goto(`/app/le/${testClientLE.id}/master`);
            await page.waitForLoadState('domcontentloaded');

            // Locate representative unconfigured party field (e.g. Field 105 or Field 110)
            const unmappedCard = page.locator('[data-testid="master-field-105"], [data-field-no="105"]').first();
            if (await unmappedCard.isVisible()) {
                await expect(unmappedCard).not.toContainText(forenameA);
                await expect(unmappedCard).not.toContainText(surnameB);
                await expect(unmappedCard).toContainText('No response recorded');
            }
        } finally {
            await context.close();
        }
    });
});
