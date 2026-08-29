import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import {
    computeDefinitionFingerprint,
    createQuestionnaireSubmission,
    getLatestSubmissionForRelationship,
    getSubmissionHistoryForRelationship,
    getSubmissionById
} from "@/services/submissionService";

// Contract: QNR-02 — Questionnaire versions retain correct mappings/completion state
// Linear: ONP-34

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "version-test-user-id" })
}));

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!process.env.DATABASE_URL)("QNR-02 / ONP-34 — Questionnaire Versioning & Mapping Retention", () => {
    let testOrg: any;
    let testClientLE: any;
    let testUser: any;
    let testEngagement: any;
    let testQuestionnaire: any;
    let testQ1: any;
    let testQ2: any;

    beforeEach(async () => {
        await prisma.submissionAnswerAttachment.deleteMany({ where: { submissionAnswer: { submission: { questionnaire: { name: { startsWith: "QNR02 Version QN" } } } } } });
        await prisma.submissionAnswer.deleteMany({ where: { submission: { questionnaire: { name: { startsWith: "QNR02 Version QN" } } } } });
        await prisma.questionnaireSubmission.deleteMany({ where: { questionnaire: { name: { startsWith: "QNR02 Version QN" } } } });
        await prisma.questionDefinitionSnapshot.deleteMany({ where: { definitionVersion: { questionnaire: { name: { startsWith: "QNR02 Version QN" } } } } });
        await prisma.questionnaireDefinitionVersion.deleteMany({ where: { questionnaire: { name: { startsWith: "QNR02 Version QN" } } } });
        await prisma.question.deleteMany({ where: { questionnaire: { name: { startsWith: "QNR02 Version QN" } } } });
        await prisma.membership.deleteMany({ where: { user: { email: { startsWith: "qnr02_" } } } });
        await prisma.questionnaire.deleteMany({ where: { name: { startsWith: "QNR02 Version QN" } } });
        await prisma.fIEngagement.deleteMany({ where: { org: { name: { startsWith: "QNR02 FI Org" } } } });
        await prisma.clientLE.deleteMany({ where: { name: { startsWith: "QNR02 Client LE" } } });
        await prisma.legalEntity.deleteMany({ where: { reference: { startsWith: "REF-QNR02-" } } });
        await prisma.organization.deleteMany({ where: { name: { startsWith: "QNR02 FI Org" } } });
        await prisma.fieldClaim.deleteMany({ where: { sourceReference: "QNR02_TEST_CLAIM" } });

        const rand = Math.floor(Math.random() * 1000000);

        testUser = await prisma.user.upsert({
            where: { id: "version-test-user-id" },
            create: { id: "version-test-user-id", email: `qnr02_${rand}@example.com`, name: "Version Test User" },
            update: { email: `qnr02_${rand}@example.com` }
        });

        testOrg = await prisma.organization.create({
            data: { name: `QNR02 FI Org ${rand}`, types: ["FI"] }
        });

        await prisma.membership.create({
            data: { userId: testUser.id, organizationId: testOrg.id, role: "MEMBER" }
        });

        const testLegalEntity = await prisma.legalEntity.create({
            data: { name: "QNR02 Legal Entity", reference: `REF-QNR02-${rand}` }
        });

        testClientLE = await prisma.clientLE.create({
            data: { name: "QNR02 Client LE", legalEntityId: testLegalEntity.id }
        });

        testEngagement = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testOrg.id,
                clientLEId: testClientLE.id,
                status: "CONNECTED"
            }
        });

        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: "QNR02 Version QN",
                description: "Testing versioned mappings and submission fidelity",
                fiOrgId: testOrg.id,
                fiEngagementId: testEngagement.id,
                engagements: { connect: { id: testEngagement.id } }
            }
        });

        // V1 Questions: Q1 mapped to F2 (Legal Name), Q2 mapped to F1 (LEI)
        testQ1 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "Question 1 - Entity Name",
                order: 1,
                masterFieldNo: 2,
                expectedDataType: "TEXT",
                status: "SHARED"
            }
        });

        testQ2 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "Question 2 - Entity LEI",
                order: 2,
                masterFieldNo: 1,
                expectedDataType: "TEXT",
                status: "SHARED"
            }
        });

        // Set up Master claims for F2 and F1
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 2,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "QNR02_TEST_CLAIM",
                valueText: "Acme Corporation Alpha",
                assertedAt: new Date()
            }
        });

        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "QNR02_TEST_CLAIM",
                valueText: "5493006MHB84DD0ZWV18",
                assertedAt: new Date()
            }
        });
    });

    it("1. Deterministic fingerprint changes when question mappings change and remains identical when unchanged", async () => {
        const fp1 = await computeDefinitionFingerprint(testQuestionnaire.id);
        const fp1Again = await computeDefinitionFingerprint(testQuestionnaire.id);
        expect(fp1).toBe(fp1Again);

        // Modify mapping on Q2 from F1 to F78
        await prisma.question.update({
            where: { id: testQ2.id },
            data: { masterFieldNo: 78 }
        });

        const fp2 = await computeDefinitionFingerprint(testQuestionnaire.id);
        expect(fp2).not.toBe(fp1);
    });

    it("2. Consecutive submissions across different versions retain version-scoped mappings and completion answers", async () => {
        // --- Submission 1 (Version 1: Q1->F2, Q2->F1) ---
        const subResult1 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagement.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(subResult1.success).toBe(true);
        expect(subResult1.versionNumber).toBe(1);
        expect(subResult1.submissionNumber).toBe(1);

        // --- Mutate live questionnaire to create Version 2 ---
        // Change Q2 mapping to F78 and add Q3 mapped to F1
        await prisma.question.update({
            where: { id: testQ2.id },
            data: { masterFieldNo: 78, text: "Question 2 - Companies House Number (Updated)" }
        });

        await prisma.fieldClaim.create({
            data: {
                fieldNo: 78,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "QNR02_TEST_CLAIM",
                valueText: "12345678",
                assertedAt: new Date()
            }
        });

        const testQ3 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "Question 3 - LEI Identifier",
                order: 3,
                masterFieldNo: 1,
                expectedDataType: "TEXT",
                status: "SHARED"
            }
        });

        // --- Submission 2 (Version 2: Q1->F2, Q2->F78, Q3->F1) ---
        const subResult2 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagement.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(subResult2.success).toBe(true);
        expect(subResult2.versionNumber).toBe(2);
        expect(subResult2.submissionNumber).toBe(1);

        // --- Verify Submission 1 (Frozen V1) ---
        const sub1 = await getSubmissionById(subResult1.submissionId!);
        expect(sub1).not.toBeNull();
        expect(sub1?.definitionVersion.versionNumber).toBe(1);
        expect(sub1?.definitionVersion.questionCount).toBe(2);
        expect(sub1?.answers).toHaveLength(2);

        const v1AnswerQ1 = sub1?.answers.find(a => a.sourceQuestionId === testQ1.id);
        const v1AnswerQ2 = sub1?.answers.find(a => a.sourceQuestionId === testQ2.id);

        expect(v1AnswerQ1?.masterFieldNo).toBe(2);
        expect(v1AnswerQ1?.valueJson).toBe("Acme Corporation Alpha");

        expect(v1AnswerQ2?.masterFieldNo).toBe(1); // Retains F1, NOT mutated to F78!
        expect(v1AnswerQ2?.valueJson).toBe("5493006MHB84DD0ZWV18");

        // --- Verify Submission 2 (Frozen V2) ---
        const sub2 = await getSubmissionById(subResult2.submissionId!);
        expect(sub2).not.toBeNull();
        expect(sub2?.definitionVersion.versionNumber).toBe(2);
        expect(sub2?.definitionVersion.questionCount).toBe(3);
        expect(sub2?.answers).toHaveLength(3);

        const v2AnswerQ1 = sub2?.answers.find(a => a.sourceQuestionId === testQ1.id);
        const v2AnswerQ2 = sub2?.answers.find(a => a.sourceQuestionId === testQ2.id);
        const v2AnswerQ3 = sub2?.answers.find(a => a.sourceQuestionId === testQ3.id);

        expect(v2AnswerQ1?.masterFieldNo).toBe(2);
        expect(v2AnswerQ1?.valueJson).toBe("Acme Corporation Alpha");

        expect(v2AnswerQ2?.masterFieldNo).toBe(78); // Updated to F78
        expect(v2AnswerQ2?.valueJson).toBe("12345678");

        expect(v2AnswerQ3?.masterFieldNo).toBe(1); // New Q3
        expect(v2AnswerQ3?.valueJson).toBe("5493006MHB84DD0ZWV18");

        // --- History Retrieval ---
        const history = await getSubmissionHistoryForRelationship(testQuestionnaire.id, testEngagement.id);
        expect(history).toHaveLength(2);
        expect(history[0].definitionVersion.versionNumber).toBe(2);
        expect(history[1].definitionVersion.versionNumber).toBe(1);
    });
});
