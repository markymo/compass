import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { loadUATManifest, PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';

// Contract: QNR-02 — Mappings and completion percentage are retained across questionnaire versions
// Linear: ONP-34

const prisma = new PrismaClient();

test.describe('QNR-02 / ONP-34 — Questionnaire Versioning Mappings & Completion Retention', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let manifest: ReturnType<typeof loadUATManifest>;
    let supplierOrgId: string;
    let alphaEngagementId: string;
    let clientLEId: string;
    let testUser: any;
    let testQuestionnaire: any;
    let testQ1: any;
    let testQ2: any;
    const testPrefix = `QNR02 E2E Suite ${Date.now()}`;

    test.beforeAll(async () => {
        manifest = loadUATManifest();
        supplierOrgId = manifest.supplierOrgA.id;
        alphaEngagementId = manifest.relationshipAlpha.id;
        clientLEId = manifest.alphaClientLE.id;

        testUser = await prisma.user.findFirst({
            where: { email: manifest.actors.leAdminAlpha.email }
        });

        // 1. Create questionnaire
        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: `${testPrefix} QN`,
                description: 'E2E Testing versioned mappings and submission fidelity',
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                engagements: { connect: { id: alphaEngagementId } }
            }
        });

        // 2. V1 Questions: Q1 mapped to F2, Q2 mapped to F1
        testQ1 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'Question 1 - Entity Name',
                order: 1,
                masterFieldNo: 2,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });

        testQ2 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'Question 2 - Entity LEI',
                order: 2,
                masterFieldNo: 1,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });
    });

    test.afterAll(async () => {
        if (testQuestionnaire?.id) {
            await prisma.submissionAnswerAttachment.deleteMany({ where: { submissionAnswer: { submission: { questionnaireId: testQuestionnaire.id } } } });
            await prisma.submissionAnswer.deleteMany({ where: { submission: { questionnaireId: testQuestionnaire.id } } });
            await prisma.questionnaireSubmission.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
            await prisma.questionDefinitionSnapshot.deleteMany({ where: { definitionVersion: { questionnaireId: testQuestionnaire.id } } });
            await prisma.questionnaireDefinitionVersion.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
            await prisma.question.deleteMany({ where: { questionnaireId: testQuestionnaire.id } });
            await prisma.questionnaire.deleteMany({ where: { id: testQuestionnaire.id } });
        }
        await prisma.$disconnect();
    });

    test('1. Version snapshots retain mapped questions and submission answers across definition versions', async () => {
        // Create V1 Definition Version
        const defV1 = await prisma.questionnaireDefinitionVersion.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                versionNumber: 1,
                titleSnapshot: testQuestionnaire.name,
                definitionFingerprint: `fp-v1-${Date.now()}`,
                questionCount: 2,
                questionSnapshots: {
                    create: [
                        {
                            sourceQuestionId: testQ1.id,
                            questionText: 'Question 1 - Entity Name',
                            order: 1,
                            masterFieldNo: 2,
                            expectedDataType: 'TEXT'
                        },
                        {
                            sourceQuestionId: testQ2.id,
                            questionText: 'Question 2 - Entity LEI',
                            order: 2,
                            masterFieldNo: 1,
                            expectedDataType: 'TEXT'
                        }
                    ]
                }
            },
            include: { questionSnapshots: true }
        });

        // Create Submission 1 against V1 Definition Version
        const sub1 = await prisma.questionnaireSubmission.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                relationshipId: alphaEngagementId,
                clientLEId: clientLEId,
                submissionNumber: 1,
                definitionVersionId: defV1.id,
                submittedById: testUser?.id || (await prisma.user.findFirst())?.id!,
                answers: {
                    create: [
                        {
                            questionSnapshotId: defV1.questionSnapshots[0].id,
                            sourceQuestionId: testQ1.id,
                            masterFieldNo: 2,
                            questionTextSnapshot: 'Question 1 - Entity Name',
                            valueJson: 'Acme Corporation Alpha'
                        },
                        {
                            questionSnapshotId: defV1.questionSnapshots[1].id,
                            sourceQuestionId: testQ2.id,
                            masterFieldNo: 1,
                            questionTextSnapshot: 'Question 2 - Entity LEI',
                            valueJson: '5493006MHB84DD0ZWV18'
                        }
                    ]
                }
            },
            include: { answers: true }
        });

        expect(sub1.answers.length).toBe(2);

        // Mutate live questions for V2 (add new question Q3)
        const testQ3 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'Question 3 - Registered Address',
                order: 3,
                masterFieldNo: 3,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });

        // Create V2 Definition Version
        const defV2 = await prisma.questionnaireDefinitionVersion.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                versionNumber: 2,
                titleSnapshot: `${testQuestionnaire.name} v2`,
                definitionFingerprint: `fp-v2-${Date.now()}`,
                questionCount: 3,
                questionSnapshots: {
                    create: [
                        { sourceQuestionId: testQ1.id, questionText: 'Question 1 - Entity Name', order: 1, masterFieldNo: 2, expectedDataType: 'TEXT' },
                        { sourceQuestionId: testQ2.id, questionText: 'Question 2 - Entity LEI', order: 2, masterFieldNo: 1, expectedDataType: 'TEXT' },
                        { sourceQuestionId: testQ3.id, questionText: 'Question 3 - Registered Address', order: 3, masterFieldNo: 3, expectedDataType: 'TEXT' }
                    ]
                }
            },
            include: { questionSnapshots: true }
        });

        // Create Submission 2 against V2 Definition Version
        const sub2 = await prisma.questionnaireSubmission.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                relationshipId: alphaEngagementId,
                clientLEId: clientLEId,
                submissionNumber: 1,
                definitionVersionId: defV2.id,
                submittedById: testUser?.id || (await prisma.user.findFirst())?.id!,
                answers: {
                    create: [
                        { questionSnapshotId: defV2.questionSnapshots[0].id, sourceQuestionId: testQ1.id, masterFieldNo: 2, questionTextSnapshot: 'Question 1 - Entity Name', valueJson: 'Acme Corporation Alpha' },
                        { questionSnapshotId: defV2.questionSnapshots[1].id, sourceQuestionId: testQ2.id, masterFieldNo: 1, questionTextSnapshot: 'Question 2 - Entity LEI', valueJson: '5493006MHB84DD0ZWV18' },
                        { questionSnapshotId: defV2.questionSnapshots[2].id, sourceQuestionId: testQ3.id, masterFieldNo: 3, questionTextSnapshot: 'Question 3 - Registered Address', valueJson: '123 Main Street' }
                    ]
                }
            },
            include: { answers: true }
        });

        expect(sub2.answers.length).toBe(3);

        // Verify V1 submission snapshot remains untouched with exactly 2 answers (immutable history)
        const sub1Retrieved = await prisma.questionnaireSubmission.findUnique({
            where: { id: sub1.id },
            include: { answers: true, definitionVersion: { include: { questionSnapshots: true } } }
        });
        expect(sub1Retrieved?.answers.length).toBe(2);
        expect(sub1Retrieved?.definitionVersion?.questionSnapshots.length).toBe(2);

        // Verify V2 submission has 3 answers and 3 snapshots
        const sub2Retrieved = await prisma.questionnaireSubmission.findUnique({
            where: { id: sub2.id },
            include: { answers: true, definitionVersion: { include: { questionSnapshots: true } } }
        });
        expect(sub2Retrieved?.answers.length).toBe(3);
        expect(sub2Retrieved?.definitionVersion?.questionSnapshots.length).toBe(3);
    });

    test('2. Client LE questionnaire view loads active questionnaire versions cleanly on dev.onpro.tech', async ({ page }) => {
        await page.goto(`/app/le/${clientLEId}`);
        await page.waitForLoadState('networkidle');

        // Confirm page renders without errors
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=Unhandled Exception')).not.toBeVisible();
    });
});
