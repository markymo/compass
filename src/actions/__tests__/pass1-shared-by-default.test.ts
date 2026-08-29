import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { assignQuestionnaireToEngagement } from "@/actions/questionnaire";
import { getFIWorkbenchData } from "@/actions/fi";
import { getIdentity } from "@/lib/auth";
import { addCommonQuestionnaire } from "@/actions/client-le";
import { KycStateService } from "@/lib/kyc/KycStateService";

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn()
}));

vi.mock("@/lib/auth/permissions", () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    can: vi.fn().mockResolvedValue(true),
    Action: {
        ENG_EDIT_DRAFT_RESPONSES: "ENG_EDIT_DRAFT_RESPONSES",
        QUESTIONNAIRE_UPDATE: "QUESTIONNAIRE_UPDATE"
    }
}));

vi.mock("@/actions/security", () => ({
    isSystemAdmin: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        membership: {
            findFirst: vi.fn(),
            findMany: vi.fn()
        },
        questionnaire: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn()
        },
        fIEngagement: {
            findUnique: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        question: {
            createMany: vi.fn(),
            findMany: vi.fn()
        },
        clientLE: {
            findUnique: vi.fn(),
            update: vi.fn()
        },
        logActivity: vi.fn(),
        user: {
            findUnique: vi.fn()
        },
        clientLEOwner: {
            findMany: vi.fn().mockResolvedValue([])
        },
        questionnaireSubmission: {
            findMany: vi.fn().mockResolvedValue([])
        },
        activityLog: {
            create: vi.fn().mockResolvedValue({ id: "log-1" })
        }
    }
}));

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn()
}));

vi.mock("@/services/masterData/definitionService", () => ({
    listAllMasterFields: vi.fn().mockResolvedValue([]),
    listAllMasterGroups: vi.fn().mockResolvedValue([])
}));

vi.mock("@/lib/kyc/KycStateService", () => ({
    KycStateService: {
        getAuthoritativeValue: vi.fn().mockResolvedValue({
            value: "Live Authoritative Value",
            claimId: "claim-100",
            sourceType: "REGISTRY",
            sourceReference: "GB-COH-12345",
            assertedAt: new Date("2026-06-01")
        }),
        resolveScopeId: vi.fn().mockResolvedValue("scope-100")
    }
}));

vi.mock("@/services/masterData/referenceEnrichmentService", () => ({
    enrichPartyReferences: vi.fn().mockResolvedValue(undefined),
    enrichAddressReferences: vi.fn().mockResolvedValue(undefined)
}));

const prismaMock = prisma as any;
const getIdentityMock = getIdentity as any;
const kycStateMock = KycStateService as any;

describe("Pass 1: Shared-by-Default for Ordinary Engagement Questionnaires", () => {
    const userId = "user-client-1";
    const templateId = "tmpl-100";
    const engagementId = "eng-100";
    const fiOrgId = "supplier-org-1";

    beforeEach(() => {
        vi.clearAllMocks();
        getIdentityMock.mockResolvedValue({ userId });
        kycStateMock.getAuthoritativeValue.mockResolvedValue({
            value: "Live Authoritative Value",
            claimId: "claim-100",
            sourceType: "REGISTRY",
            sourceReference: "GB-COH-12345",
            assertedAt: new Date("2026-06-01")
        });
    });

    it("1. Default state: assignQuestionnaireToEngagement instantiates questions as SHARED with audit fields", async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            id: templateId,
            name: "ESG Standard Form",
            referenceCode: "ESG_2026",
            questions: [
                { id: "tq1", text: "What is your primary ESG score?", order: 1, masterFieldNo: 42 },
                { id: "tq2", text: "Attach carbon footprint cert.", order: 2, masterFieldNo: 99 }
            ]
        });

        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: engagementId,
            fiOrgId,
            clientLE: { shortCode: "ALPHA" },
            org: { shortCode: "BANKA" }
        });

        prismaMock.questionnaire.findFirst.mockResolvedValue(null);
        prismaMock.questionnaire.create.mockResolvedValue({
            id: "instance-eng-100",
            name: "ESG Standard Form",
            kind: "ENGAGEMENT_QUESTIONNAIRE",
            fiEngagementId: engagementId
        });

        const result = await assignQuestionnaireToEngagement(templateId, engagementId);

        expect(result.success).toBe(true);
        expect(prismaMock.question.createMany).toHaveBeenCalledTimes(1);

        const createData = prismaMock.question.createMany.mock.calls[0][0].data;
        expect(createData).toHaveLength(2);

        expect(createData[0].status).toBe("SHARED");
        expect(createData[0].sharedAt).toBeInstanceOf(Date);
        expect(createData[0].sharedByUserId).toBe(userId);

        expect(createData[1].status).toBe("SHARED");
        expect(createData[1].sharedAt).toBeInstanceOf(Date);
        expect(createData[1].sharedByUserId).toBe(userId);
    });

    it("2. Supplier live visibility: Authorized supplier immediately sees live answer and documents for new SHARED question", async () => {
        const supplierUserId = "user-supplier-1";
        getIdentityMock.mockResolvedValue({ userId: supplierUserId });

        prismaMock.membership.findFirst.mockResolvedValue({
            id: "mem-sup-1",
            userId: supplierUserId,
            organizationId: fiOrgId,
            organization: { types: ["FI"] }
        });
        prismaMock.membership.findMany.mockResolvedValue([]);

        const sharedAt = new Date("2026-08-18");
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-auto",
                text: "What is your company registration number?",
                status: "SHARED",
                sharedAt,
                sharedByUserId: userId,
                answer: null,
                masterFieldNo: 10,
                order: 1,
                sourceSectionId: null,
                documents: [
                    { id: "doc-cert-1", name: "incorporation.pdf", mimeType: "application/pdf", sizeBytes: 2048, createdAt: sharedAt }
                ],
                questionnaire: {
                    id: "qnaire-eng-1",
                    name: "KYC Onboarding",
                    fiEngagement: {
                        id: engagementId,
                        clientLE: { id: "cle-1", name: "Alpha Ltd", legalEntityId: "le-1", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        expect(result.questions).toHaveLength(1);
        const q = result.questions[0];

        expect(q.id).toBe("q-shared-auto");
        expect(q.answerVisibility).toBe("SHARED");
        expect(q.answer).toBe("Live Authoritative Value");
        expect(q.documents).toHaveLength(1);
        expect(q.documents[0].fileName).toBe("incorporation.pdf");
    });

    it("3. Relationship isolation: Supplier from unrelated organization cannot see engagement questions", async () => {
        const unrelatedSupplierOrgId = "unrelated-org-999";
        const supplierUserId = "user-unrelated-1";
        getIdentityMock.mockResolvedValue({ userId: supplierUserId });

        prismaMock.membership.findFirst.mockResolvedValue({
            id: "mem-unrelated",
            userId: supplierUserId,
            organizationId: unrelatedSupplierOrgId,
            organization: { types: ["FI"] }
        });
        prismaMock.membership.findMany.mockResolvedValue([]);

        prismaMock.question.findMany.mockResolvedValue([]);

        const result = await getFIWorkbenchData(unrelatedSupplierOrgId);

        expect(result.questions).toEqual([]);
        expect(prismaMock.question.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    questionnaire: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                fiOrgId: unrelatedSupplierOrgId
                            })
                        ])
                    })
                })
            })
        );
    });

    it("4. Private fallback: Changing question to DRAFT suppresses answer, provenance, and documents for Supplier", async () => {
        const supplierUserId = "user-supplier-1";
        getIdentityMock.mockResolvedValue({ userId: supplierUserId });

        prismaMock.membership.findFirst.mockResolvedValue({
            id: "mem-sup-1",
            userId: supplierUserId,
            organizationId: fiOrgId,
            organization: { types: ["FI"] }
        });
        prismaMock.membership.findMany.mockResolvedValue([]);

        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-private-fallback",
                text: "What is your internal risk rating?",
                status: "DRAFT",
                sharedAt: null,
                sharedByUserId: null,
                answer: "Confidential Score",
                masterFieldNo: 99,
                documents: [{ id: "doc-secret", name: "risk_memo.pdf", mimeType: "application/pdf", sizeBytes: 500, createdAt: new Date() }],
                questionnaire: {
                    id: "qnaire-eng-1",
                    name: "Risk Questionnaire",
                    fiEngagement: {
                        id: engagementId,
                        clientLE: { id: "cle-1", name: "Alpha Ltd", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        expect(result.questions).toHaveLength(1);
        const q = result.questions[0];

        expect(q.answerVisibility).toBe("NOT_SHARED");
        expect(q.answer).toBeNull();
        expect(q.provenance).toBeNull();
        expect(q.documents).toEqual([]);
    });

    it("5. Common Questionnaires instantiate questions as SHARED by default in Pass 2", async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            id: templateId,
            fiOrgId: "org-1",
            extractedContent: {},
            questions: [
                { text: "Common tax residency question?", compactText: "Tax Resid", order: 1, masterFieldNo: 15 }
            ]
        });

        prismaMock.clientLE.findUnique.mockResolvedValue({ id: "cle-1", shortCode: "ALPHA" });
        prismaMock.questionnaire.findFirst.mockResolvedValue(null);

        prismaMock.questionnaire.create.mockResolvedValue({
            id: "cq-instance-1",
            kind: "COMMON_QUESTIONNAIRE"
        });

        const result = await addCommonQuestionnaire("cle-1", templateId);

        expect(result.success).toBe(true);
        expect(prismaMock.questionnaire.create).toHaveBeenCalledTimes(1);

        const createArg = prismaMock.questionnaire.create.mock.calls[0][0];
        expect(createArg.data.kind).toBe("COMMON_QUESTIONNAIRE");

        const questionsArg = createArg.data.questions.create;
        expect(questionsArg).toHaveLength(1);
        expect(questionsArg[0].status).toBe("SHARED");
    });
});
