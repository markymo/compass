import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
    computeDefinitionFingerprint,
    createQuestionnaireSubmission,
    getLatestSubmissionForRelationship,
    getSubmissionHistoryForRelationship,
    getSubmissionById
} from "../submissionService";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { resolveExportAnswer } from "@/lib/export/export-answer-resolver";
import { getFIWorkbenchData } from "@/actions/fi";

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "submission-service-user-id" })
}));

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!process.env.DATABASE_URL)("Immutable Questionnaire Submissions Architecture Integration Tests", () => {
    let testOrg: any;
    let testClientLE: any;
    let testUser: any;
    let testEngagementA: any;
    let testEngagementB: any;
    let testQuestionnaire: any;
    let testQ1: any;
    let testQ2: any;

    beforeEach(async () => {
        await prisma.submissionAnswerAttachment.deleteMany({ where: { submissionAnswer: { submission: { questionnaire: { name: { startsWith: "Test Sub Questionnaire" } } } } } });
        await prisma.submissionAnswer.deleteMany({ where: { submission: { questionnaire: { name: { startsWith: "Test Sub Questionnaire" } } } } });
        await prisma.questionnaireSubmission.deleteMany({ where: { questionnaire: { name: { startsWith: "Test Sub Questionnaire" } } } });
        await prisma.questionDefinitionSnapshot.deleteMany({ where: { definitionVersion: { questionnaire: { name: { startsWith: "Test Sub Questionnaire" } } } } });
        await prisma.questionnaireDefinitionVersion.deleteMany({ where: { questionnaire: { name: { startsWith: "Test Sub Questionnaire" } } } });
        await prisma.question.deleteMany({ where: { questionnaire: { name: { startsWith: "Test Sub Questionnaire" } } } });
        await prisma.membership.deleteMany({ where: { OR: [{ userId: "submission-service-user-id" }, { user: { email: { startsWith: "sub_test_" } } }] } });
        await prisma.questionnaire.deleteMany({ where: { name: { startsWith: "Test Sub Questionnaire" } } });
        await prisma.fIEngagement.deleteMany({ where: { org: { name: { startsWith: "Test FI Org Sub" } } } });
        await prisma.clientLE.deleteMany({ where: { name: { startsWith: "Test Client LE Sub" } } });
        await prisma.legalEntity.deleteMany({ where: { reference: { startsWith: "REF-SUB-" } } });
        await prisma.organization.deleteMany({ where: { name: { startsWith: "Test FI Org Sub" } } });
        await prisma.fieldClaim.deleteMany({ where: { sourceReference: "SUB_TEST_CLAIM" } });

        const rand = Math.floor(Math.random() * 1000000);

        // Setup test user, org, LE, engagements
        testUser = await prisma.user.upsert({
            where: { id: "submission-service-user-id" },
            create: { id: "submission-service-user-id", email: `sub_test_${rand}@example.com`, name: "Sub Test User" },
            update: { email: `sub_test_${rand}@example.com` }
        });

        testOrg = await prisma.organization.create({
            data: { name: `Test FI Org Sub ${rand}`, types: ["FI"] }
        });

        await prisma.membership.create({
            data: { userId: testUser.id, organizationId: testOrg.id, role: "MEMBER" }
        });

        const testRealLE = await prisma.legalEntity.create({
            data: { name: "Test Legal Entity Sub", reference: `REF-SUB-${rand}` }
        });

        testClientLE = await prisma.clientLE.create({
            data: { name: "Test Client LE Sub", legalEntityId: testRealLE.id }
        });

        testEngagementA = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testOrg.id,
                clientLEId: testClientLE.id,
                status: "CONNECTED"
            }
        });

        const testOrgB = await prisma.organization.create({
            data: { name: "Test FI Org Sub B" }
        });

        testEngagementB = await prisma.fIEngagement.create({
            data: {
                fiOrgId: testOrgB.id,
                clientLEId: testClientLE.id,
                status: "CONNECTED"
            }
        });

        testQuestionnaire = await prisma.questionnaire.create({
            data: {
                name: "Test Sub Questionnaire",
                description: "Test Description",
                fiOrgId: testOrg.id,
                fiEngagementId: testEngagementA.id,
                engagements: { connect: { id: testEngagementA.id } }
            }
        });

        testQ1 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "What is the legal name?",
                order: 1,
                masterFieldNo: 1,
                expectedDataType: "TEXT"
            }
        });

        testQ2 = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "What is the registered address?",
                order: 2,
                masterFieldNo: 2,
                expectedDataType: "ADDRESS"
            }
        });
    });

    it("1. Data changes only (Definition V1 stays unchanged, sub#1 vs sub#2 values differ)", async () => {
        // Assert field claim value A
        const claim1 = await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueText: "Value A",
                assertedAt: new Date("2026-01-01T10:00:00Z")
            }
        });

        // Submit #1
        const res1 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(res1.success).toBe(true);
        expect(res1.versionNumber).toBe(1);
        expect(res1.submissionNumber).toBe(1);

        // Update master value to Value B
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueText: "Value B",
                assertedAt: new Date("2026-02-01T10:00:00Z")
            }
        });

        // Submit #2 (same questionnaire structure)
        const res2 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(res2.success).toBe(true);
        expect(res2.versionNumber).toBe(1); // Definition version reused!
        expect(res2.submissionNumber).toBe(2);

        // Verify sub #1 frozen value
        const sub1 = await getSubmissionById(res1.submissionId!);
        const ans1Q1 = sub1?.answers.find(a => a.sourceQuestionId === testQ1.id);
        expect(ans1Q1?.valueJson).toBe("Value A");

        // Verify sub #2 frozen value
        const sub2 = await getSubmissionById(res2.submissionId!);
        const ans2Q1 = sub2?.answers.find(a => a.sourceQuestionId === testQ1.id);
        expect(ans2Q1?.valueJson).toBe("Value B");
    });

    it("2. Questionnaire structural change (creates V2, submission numbering restarts)", async () => {
        // Initial submission (V1, sub#1)
        const res1 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });
        expect(res1.versionNumber).toBe(1);
        expect(res1.submissionNumber).toBe(1);

        // Structurally edit questionnaire (Add Q3)
        await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "What is the LEI?",
                order: 3,
                masterFieldNo: 3,
                expectedDataType: "TEXT"
            }
        });

        // Submit again
        const res2 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(res2.versionNumber).toBe(2); // New definition version V2 created!
        expect(res2.submissionNumber).toBe(1); // Submission number restarts at 1 for V2!
    });

    it("3. Common Questionnaire multi-relationship isolation", async () => {
        // Submit to Relationship A
        const resA = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        // Submit to Relationship B
        const resB = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementB.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(resA.versionNumber).toBe(1);
        expect(resA.submissionNumber).toBe(1);

        expect(resB.versionNumber).toBe(1);
        expect(resB.submissionNumber).toBe(1); // Relationship B gets its own sub#1

        // History for Relationship A should only show Rel A submission
        const historyA = await getSubmissionHistoryForRelationship(testQuestionnaire.id, testEngagementA.id);
        expect(historyA.length).toBe(1);
        expect(historyA[0].relationshipId).toBe(testEngagementA.id);

        // History for Relationship B should only show Rel B submission
        const historyB = await getSubmissionHistoryForRelationship(testQuestionnaire.id, testEngagementB.id);
        expect(historyB.length).toBe(1);
        expect(historyB[0].relationshipId).toBe(testEngagementB.id);
    });

    it("4 & 5. PARTY_REF & ADDRESS_REF historical fidelity", async () => {
        // Create CCParty
        const party = await prisma.cCParty.create({
            data: {
                clientLEId: testClientLE.id,
                data: {
                    schemaVersion: 2,
                    partyType: "ORGANISATION",
                    legalName: "Original Party Name Ltd",
                    emails: [],
                    phones: [],
                    roles: [],
                    sourceIdentifiers: []
                }
            }
        });

        // Claim pointing to CCParty
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueJson: { ccPartyId: party.id },
                assertedAt: new Date()
            }
        });

        // Create Submission
        const res = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        // Live rename of party
        await prisma.cCParty.update({
            where: { id: party.id },
            data: {
                data: {
                    schemaVersion: 2,
                    partyType: "ORGANISATION",
                    legalName: "Renamed Party plc",
                    emails: [],
                    phones: [],
                    roles: [],
                    sourceIdentifiers: []
                }
            }
        });

        // Verify historical submission retains snapshotted name
        const sub = await getSubmissionById(res.submissionId!);
        const ansQ1 = sub?.answers.find(a => a.sourceQuestionId === testQ1.id);
        const valJson = ansQ1?.valueJson as any;

        expect(valJson.ccPartyId).toBe(party.id);
        expect(valJson.ccParty?.data?.legalName).toBe("Original Party Name Ltd");
    });

    it("6. Attachment replacement", async () => {
        // Create Document A
        const docA = await prisma.document.create({
            data: {
                name: "Document_A.pdf",
                clientLEId: testClientLE.id,
                storageProvider: "VERCEL_BLOB",
                storagePathname: `docs/doc_a_${Math.random()}.pdf`
            }
        });

        // Attach Document A to Q1
        await prisma.question.update({
            where: { id: testQ1.id },
            data: { documents: { connect: { id: docA.id } } }
        });

        // Submit #1
        const res1 = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        const sub1 = await getSubmissionById(res1.submissionId!);
        const ans1 = sub1?.answers.find(a => a.sourceQuestionId === testQ1.id);
        expect(ans1?.attachments.length).toBe(1);
        expect(ans1?.attachments[0].document.name).toBe("Document_A.pdf");

        // Replace live document with Document B
        const docB = await prisma.document.create({
            data: {
                name: "Document_B.pdf",
                clientLEId: testClientLE.id,
                storageProvider: "VERCEL_BLOB",
                storagePathname: `docs/doc_b_${Math.random()}.pdf`
            }
        });

        await prisma.question.update({
            where: { id: testQ1.id },
            data: {
                documents: {
                    disconnect: { id: docA.id },
                    connect: { id: docB.id }
                }
            }
        });

        // Historical sub #1 remains attached to Document A
        const sub1Check = await getSubmissionById(res1.submissionId!);
        const ans1Check = sub1Check?.answers.find(a => a.sourceQuestionId === testQ1.id);
        expect(ans1Check?.attachments[0].document.name).toBe("Document_A.pdf");
    });

    it("7. Explicit None preservation", async () => {
        // Set Q1 claim to explicitNone
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueJson: { explicitNone: true },
                assertedAt: new Date()
            }
        });

        const res = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        const sub = await getSubmissionById(res.submissionId!);
        const ansQ1 = sub?.answers.find(a => a.sourceQuestionId === testQ1.id); // explicit none
        const ansQ2 = sub?.answers.find(a => a.sourceQuestionId === testQ2.id); // unanswered

        expect(ansQ1?.explicitNone).toBe(true);
        expect(ansQ1?.valueJson).toBe(null);

        expect(ansQ2?.explicitNone).toBe(false);
        expect(ansQ2?.valueJson).toBe(null);
    });

    it("8. Supplier bug regression test (released authoritative value with null q.answer resolves correctly)", async () => {
        // Authoritative Master Record exists
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                status: "VERIFIED",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueText: "Authoritative Master Value",
                assertedAt: new Date()
            }
        });

        // Question.answer is NULL on live question table
        await prisma.question.update({
            where: { id: testQ1.id },
            data: { answer: null, status: "DRAFT" }
        });

        // Submit Questionnaire
        const subRes = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });
        expect(subRes.success).toBe(true);

        // Fetch supplier workbench view data
        const wbData = await getFIWorkbenchData(testOrg.id);
        const supplierQ1 = wbData.questions.find(q => q.id === testQ1.id);

        expect(supplierQ1).toBeDefined();
        expect(supplierQ1?.answerVisibility).toBe("RELEASED");
        expect(supplierQ1?.answer).toBe("Authoritative Master Value"); // NO LONGER NULL / "None"!
    });

    it("9. PDF consistency (historical export matches submission snapshot)", async () => {
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueText: "Snapshot Value for PDF",
                assertedAt: new Date()
            }
        });

        const res = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: testEngagementA.id,
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        // Mutate live claim to something else
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 1,
                subjectLeId: testClientLE.legalEntityId,
                clientLEId: testClientLE.id,
                claimRole: "VALUE",
                sourceType: "USER_INPUT",
                sourceReference: "SUB_TEST_CLAIM",
                valueText: "Mutated Live Value",
                assertedAt: new Date()
            }
        });

        // Export with submissionId
        const exportRes = await resolveExportAnswer(
            testQ1,
            testClientLE.legalEntityId,
            testClientLE.id,
            testClientLE.id,
            res.submissionId
        );

        expect(exportRes.displayValue).toBe("Snapshot Value for PDF");
    });

    it("10. Transactional atomicity (rollback on invalid relationship)", async () => {
        const initialCount = await prisma.questionnaireSubmission.count();

        const res = await createQuestionnaireSubmission({
            questionnaireId: testQuestionnaire.id,
            relationshipId: "invalid-relationship-id",
            clientLEId: testClientLE.id,
            submittedById: testUser.id
        });

        expect(res.success).toBe(false);
        const finalCount = await prisma.questionnaireSubmission.count();
        expect(finalCount).toBe(initialCount);
    });
});
