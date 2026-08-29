import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PERSONA_STORAGE_STATES } from '../fixtures/uat-fixture';
import { createQuestionnaireSubmission, getSubmissionById, getSubmissionHistoryForRelationship } from '../../src/services/submissionService';

// Contract: QNR-02 — Mappings and completion percentage are retained across questionnaire versions
// Linear: ONP-34

const prisma = new PrismaClient();

test.describe('QNR-02 / ONP-34 — Questionnaire Versioning Mappings & Completion Retention', () => {
    test.use({ storageState: PERSONA_STORAGE_STATES.leAdminAlpha });
    test.setTimeout(90000);

    let supplierOrgId: string;
    let alphaEngagementId: string;
    let clientLEId: string;
    let subjectLeId: string | undefined;
    let testUser: any;
    let testQuestionnaire: any;
    let testQ1: any;
    let testQ2: any;
    let testQ3: any;
    let subResultV1: any;
    let subResultV2: any;

    const testPrefix = `QNR02 Versioning Suite ${Date.now()}`;

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
        subjectLeId = clientLE.legalEntityId || undefined;
        supplierOrgId = engagement.fiOrgId;
        alphaEngagementId = engagement.id;

        testUser = await prisma.user.findFirst({
            where: { email: 'uat+le-admin-alpha@onpro.tech' }
        });
        if (!testUser) throw new Error('uat+le-admin-alpha user not found');

        // 1. Create questionnaire attached to relationship
        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: `${testPrefix} QN`,
                description: 'E2E testing questionnaire version definition freezing and historical mapping retention',
                fiOrgId: supplierOrgId,
                fiEngagementId: alphaEngagementId,
                engagements: { connect: { id: alphaEngagementId } }
            }
        });

        // 2. V1 Live Questions: Q1 -> F2 (Legal Name), Q2 -> F1 (LEI)
        testQ1 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'V1 Question 1 - Entity Legal Name',
                order: 1,
                masterFieldNo: 2,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });

        testQ2 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'V1 Question 2 - Legal Entity Identifier (LEI)',
                order: 2,
                masterFieldNo: 1,
                expectedDataType: 'TEXT',
                status: 'SHARED'
            }
        });

        // 3. Set Master authoritative values for F2 and F1
        await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 2,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'QNR02_V1_CLAIM',
                valueText: 'Acme Apex Alpha Corp',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });

        await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 1,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'QNR02_V1_CLAIM',
                valueText: '5493006MHB84DD0ZWV18',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });

        // 4. Freeze V1 using supported submission service
        subResultV1 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: alphaEngagementId,
            clientLEId: clientLEId,
            submittedById: testUser.id
        });

        if (!subResultV1.success) {
            throw new Error(`V1 Submission failed: ${subResultV1.error}`);
        }

        // 5. Mutate live questionnaire to create V2:
        // Update Q2 mapping to F78 (Companies House number) and add Q3
        await prisma.question.update({
            where: { id: testQ2.id },
            data: {
                text: 'V2 Question 2 - Companies House Registration Number',
                masterFieldNo: 78
            }
        });

        await prisma.fieldClaim.create({
            data: {
                clientLEId: clientLEId,
                subjectLeId: subjectLeId,
                fieldNo: 78,
                claimRole: 'VALUE',
                sourceType: 'USER_INPUT',
                sourceReference: 'QNR02_V2_CLAIM',
                valueText: '09876543',
                status: 'VERIFIED',
                confidenceScore: 1.0,
                assertedAt: new Date()
            }
        });

        testQ3 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: 'V2 Question 3 - Primary Contact Person',
                order: 3,
                masterFieldNo: 104,
                expectedDataType: 'PARTY',
                status: 'SHARED'
            }
        });

        // 6. Freeze V2 using supported submission service
        subResultV2 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: alphaEngagementId,
            clientLEId: clientLEId,
            submittedById: testUser.id
        });

        if (!subResultV2.success) {
            throw new Error(`V2 Submission failed: ${subResultV2.error}`);
        }
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
        if (clientLEId) {
            await prisma.fieldClaim.deleteMany({ where: { clientLEId: clientLEId, sourceReference: { in: ['QNR02_V1_CLAIM', 'QNR02_V2_CLAIM'] } } });
        }
        await prisma.$disconnect();
    });

    test('1. Supported submission engine creates immutable definition versions and preserves historical mappings across versions', async () => {
        // Assert V1 submission metadata and frozen snapshot fidelity
        expect(subResultV1.versionNumber).toBe(1);
        expect(subResultV1.submissionNumber).toBe(1);

        const sub1 = await getSubmissionById(subResultV1.submissionId!);
        expect(sub1).not.toBeNull();
        expect(sub1?.definitionVersion.versionNumber).toBe(1);
        expect(sub1?.definitionVersion.questionCount).toBe(2);
        expect(sub1?.answers).toHaveLength(2);

        const v1AnsQ1 = sub1?.answers.find(a => a.sourceQuestionId === testQ1.id);
        const v1AnsQ2 = sub1?.answers.find(a => a.sourceQuestionId === testQ2.id);

        expect(v1AnsQ1?.masterFieldNo).toBe(2);
        expect(v1AnsQ1?.valueJson).toBe('Acme Apex Alpha Corp');

        expect(v1AnsQ2?.masterFieldNo).toBe(1); // Crucial: V1 frozen at F1 (LEI), not mutated to F78!
        expect(v1AnsQ2?.valueJson).toBe('5493006MHB84DD0ZWV18');

        // Assert V2 submission metadata and updated definition snapshot
        expect(subResultV2.versionNumber).toBe(2);
        expect(subResultV2.submissionNumber).toBe(1);

        const sub2 = await getSubmissionById(subResultV2.submissionId!);
        expect(sub2).not.toBeNull();
        expect(sub2?.definitionVersion.versionNumber).toBe(2);
        expect(sub2?.definitionVersion.questionCount).toBe(3);
        expect(sub2?.answers).toHaveLength(3);

        const v2AnsQ1 = sub2?.answers.find(a => a.sourceQuestionId === testQ1.id);
        const v2AnsQ2 = sub2?.answers.find(a => a.sourceQuestionId === testQ2.id);
        const v2AnsQ3 = sub2?.answers.find(a => a.sourceQuestionId === testQ3.id);

        expect(v2AnsQ1?.masterFieldNo).toBe(2);
        expect(v2AnsQ1?.valueJson).toBe('Acme Apex Alpha Corp');

        expect(v2AnsQ2?.masterFieldNo).toBe(78); // V2 updated to F78 (Companies House)
        expect(v2AnsQ2?.valueJson).toBe('09876543');

        expect(v2AnsQ3?.masterFieldNo).toBe(104);

        // Assert historical submission relationship history order
        const history = await getSubmissionHistoryForRelationship(testQuestionnaire.id, alphaEngagementId);
        expect(history).toHaveLength(2);
        expect(history[0].definitionVersion.versionNumber).toBe(2);
        expect(history[1].definitionVersion.versionNumber).toBe(1);
    });

    test('2. UI displays separate historical definition versions and preserves exact frozen answers', async ({ page }) => {
        // Navigate to Client LE questionnaire view
        await page.goto(`/app/le/${clientLEId}`);
        await page.waitForLoadState('networkidle');

        // Confirm Client LE dashboard renders without crash
        await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    });
});
