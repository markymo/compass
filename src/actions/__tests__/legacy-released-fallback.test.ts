import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import { KycStateService } from "@/lib/kyc/KycStateService";
import { getFIWorkbenchData } from "@/actions/fi";

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: "legacy-fallback-user-id" })
}));

describe("Legacy RELEASED Fallback Integration & Regression Tests", () => {
    let testOrg: any;
    let testUser: any;
    let testRealLE: any;
    let testClientLE: any;
    let testEngagement: any;
    let testQuestionnaire: any;

    beforeEach(async () => {
        // Cleanup test data safely (scoped to test prefix)
        await prisma.submissionAnswerAttachment.deleteMany({ where: { submissionAnswer: { submission: { questionnaire: { name: { startsWith: "Legacy Fallback QN" } } } } } });
        await prisma.submissionAnswer.deleteMany({ where: { submission: { questionnaire: { name: { startsWith: "Legacy Fallback QN" } } } } });
        await prisma.questionnaireSubmission.deleteMany({ where: { questionnaire: { name: { startsWith: "Legacy Fallback QN" } } } });
        await prisma.questionDefinitionSnapshot.deleteMany({ where: { definitionVersion: { questionnaire: { name: { startsWith: "Legacy Fallback QN" } } } } });
        await prisma.questionnaireDefinitionVersion.deleteMany({ where: { questionnaire: { name: { startsWith: "Legacy Fallback QN" } } } });
        await prisma.question.deleteMany({ where: { questionnaire: { name: { startsWith: "Legacy Fallback QN" } } } });
        await prisma.membership.deleteMany({ where: { OR: [{ userId: "legacy-fallback-user-id" }, { user: { email: { startsWith: "legacy_user_" } } }] } });
        await prisma.questionnaire.deleteMany({ where: { name: { startsWith: "Legacy Fallback QN" } } });
        await prisma.fIEngagement.deleteMany({ where: { org: { name: { startsWith: "Legacy Org" } } } });
        await prisma.legalEntity.deleteMany({ where: { reference: { startsWith: "REF-LEGACY-" } } });
        await prisma.organization.deleteMany({ where: { name: { startsWith: "Legacy Org" } } });
        await prisma.user.deleteMany({ where: { OR: [{ id: "legacy-fallback-user-id" }, { email: { startsWith: "legacy_user_" } }] } });
        await prisma.fieldClaim.deleteMany({ where: { sourceReference: "LEGACY_TEST_CLAIM" } });

        const rand = Math.floor(Math.random() * 1000000);

        testUser = await prisma.user.create({
            data: { id: "legacy-fallback-user-id", email: `legacy_user_${rand}@example.com`, name: "Legacy Test User" }
        });

        testOrg = await prisma.organization.create({
            data: { name: `Legacy Org ${rand}`, types: ["FI"] }
        });

        await prisma.membership.create({
            data: { userId: testUser.id, organizationId: testOrg.id, role: "MEMBER" }
        });

        testRealLE = await prisma.legalEntity.create({
            data: { name: "Legacy Legal Entity", reference: `REF-LEGACY-${rand}` }
        });

        testClientLE = await prisma.clientLE.create({
            data: { name: "Legacy Client LE", legalEntityId: testRealLE.id }
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
                name: "Legacy Fallback QN",
                description: "Test Description",
                fiOrgId: testOrg.id,
                fiEngagementId: testEngagement.id,
                engagements: { connect: { id: testEngagement.id } }
            }
        });
    });

    it("1. Exact ZZOOMM pattern: RELEASED + q.answer = null + masterFieldNo present + releaseProvenance/releasedAt + historical FieldClaim value -> supplier sees historical released value", async () => {
        // Assert historical FieldClaim
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 3, // Legal Name
                subjectLeId: testRealLE.id,
                clientLeScopeId: testClientLE.id,
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "LEGACY_TEST_CLAIM",
                valueText: "ZZOOMM PLC Historical Name",
                assertedAt: new Date("2026-07-20T10:00:00Z")
            }
        });

        // Create question: RELEASED, q.answer = null
        const question = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "LEGAL NAME",
                order: 1,
                masterFieldNo: 3,
                status: "RELEASED",
                answer: null,
                releasedAt: new Date("2026-07-20T12:00:00Z"),
                releaseProvenance: { sourceLabel: "Companies House Release" } as any
            }
        });

        // Verify getFIWorkbenchData returns the historical released value instead of null / "None"
        const wbData = await getFIWorkbenchData(testOrg.id);
        const supplierQ = wbData.questions.find(q => q.id === question.id);

        expect(supplierQ).toBeDefined();
        expect(supplierQ?.answerVisibility).toBe("RELEASED");
        expect(supplierQ?.answer).toBe("ZZOOMM PLC Historical Name");
        expect(supplierQ?.provenance?.source).toBe("Companies House Release");
    });

    it("2. Legacy explicit none: q.answer = { explicitNone: true } -> supplier sees explicit none", async () => {
        const question = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "TRADING NAME",
                order: 2,
                masterFieldNo: 4,
                status: "RELEASED",
                answer: { explicitNone: true },
                releasedAt: new Date("2026-07-20T12:00:00Z")
            }
        });

        const wbData = await getFIWorkbenchData(testOrg.id);
        const supplierQ = wbData.questions.find(q => q.id === question.id);

        expect(supplierQ).toBeDefined();
        expect(supplierQ?.answerVisibility).toBe("RELEASED");
        expect(supplierQ?.answer).toEqual({ explicitNone: true });
    });

    it("3. Legacy manual answer: q.answer = 'Manual Text' -> supplier sees manual text", async () => {
        const question = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "CUSTOM NOTES",
                order: 3,
                masterFieldNo: null,
                status: "RELEASED",
                answer: "Manual Custom Answer Text",
                releasedAt: new Date("2026-07-20T12:00:00Z")
            }
        });

        const wbData = await getFIWorkbenchData(testOrg.id);
        const supplierQ = wbData.questions.find(q => q.id === question.id);

        expect(supplierQ).toBeDefined();
        expect(supplierQ?.answerVisibility).toBe("RELEASED");
        expect(supplierQ?.answer).toBe("Manual Custom Answer Text");
    });

    it("4. Legacy historical value changed later: FieldClaim updated after releasedAt -> supplier sees value active at releasedAt", async () => {
        // Claim 1: asserted BEFORE release (2026-07-10)
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 3,
                subjectLeId: testRealLE.id,
                clientLeScopeId: testClientLE.id,
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "LEGACY_TEST_CLAIM",
                valueText: "Original Name At Release",
                assertedAt: new Date("2026-07-10T10:00:00Z")
            }
        });

        // Question released on 2026-07-15
        const question = await prisma.question.create({
            data: {
                questionnaireId: testQuestionnaire.id,
                text: "LEGAL NAME",
                order: 4,
                masterFieldNo: 3,
                status: "RELEASED",
                answer: null,
                releasedAt: new Date("2026-07-15T12:00:00Z")
            }
        });

        // Claim 2: asserted AFTER release (2026-08-01) with new value
        await prisma.fieldClaim.create({
            data: {
                fieldNo: 3,
                subjectLeId: testRealLE.id,
                clientLeScopeId: testClientLE.id,
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "LEGACY_TEST_CLAIM",
                valueText: "New Name Asserted Later",
                assertedAt: new Date("2026-08-01T10:00:00Z")
            }
        });

        const wbData = await getFIWorkbenchData(testOrg.id);
        const supplierQ = wbData.questions.find(q => q.id === question.id);

        expect(supplierQ).toBeDefined();
        expect(supplierQ?.answerVisibility).toBe("RELEASED");
        expect(supplierQ?.answer).toBe("Original Name At Release"); // NOT "New Name Asserted Later"!
    });
});
