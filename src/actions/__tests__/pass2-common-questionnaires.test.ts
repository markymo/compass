import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { addCommonQuestionnaire } from "@/actions/client-le";
import { getFIWorkbenchData } from "@/actions/fi";
import { getIdentity } from "@/lib/auth";
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
            findMany: vi.fn()
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
            value: "Live Shared Value 1",
            claimId: "claim-common-1",
            sourceType: "REGISTRY",
            sourceReference: "GB-COH-9999",
            assertedAt: new Date("2026-07-01")
        }),
        resolveScopeId: vi.fn().mockResolvedValue("scope-common")
    }
}));

vi.mock("@/services/masterData/referenceEnrichmentService", () => ({
    enrichPartyReferences: vi.fn().mockResolvedValue(undefined),
    enrichAddressReferences: vi.fn().mockResolvedValue(undefined)
}));

const prismaMock = prisma as any;
const getIdentityMock = getIdentity as any;
const kycStateMock = KycStateService as any;

describe("Pass 2: Shared-by-Default for Common Questionnaires", () => {
    const userId = "user-client-1";
    const templateId = "tmpl-cq-1";
    const clientLEId = "cle-x";

    beforeEach(() => {
        vi.clearAllMocks();
        getIdentityMock.mockResolvedValue({ userId });
        kycStateMock.getAuthoritativeValue.mockResolvedValue({
            value: "Live Shared Value 1",
            claimId: "claim-common-1",
            sourceType: "REGISTRY",
            sourceReference: "GB-COH-9999",
            assertedAt: new Date("2026-07-01")
        });
    });

    it("A. Shared-by-default creation: addCommonQuestionnaire creates questions with status=SHARED and audit fields", async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            id: templateId,
            fiOrgId: "org-master",
            extractedContent: {},
            questions: [
                { text: "What is the tax residence status?", compactText: "Tax Resid", order: 1, masterFieldNo: 240 }
            ]
        });

        prismaMock.clientLE.findUnique.mockResolvedValue({ id: clientLEId, shortCode: "CLEX" });
        prismaMock.questionnaire.findFirst.mockResolvedValue(null);
        prismaMock.questionnaire.create.mockResolvedValue({
            id: "cq-instance-100",
            kind: "COMMON_QUESTIONNAIRE"
        });

        const result = await addCommonQuestionnaire(clientLEId, templateId);

        expect(result.success).toBe(true);
        expect(prismaMock.questionnaire.create).toHaveBeenCalledTimes(1);

        const createArg = prismaMock.questionnaire.create.mock.calls[0][0];
        expect(createArg.data.kind).toBe("COMMON_QUESTIONNAIRE");

        const questionsArg = createArg.data.questions.create;
        expect(questionsArg).toHaveLength(1);

        expect(questionsArg[0].status).toBe("SHARED");
        expect(questionsArg[0].sharedAt).toBeInstanceOf(Date);
        expect(questionsArg[0].sharedByUserId).toBe(userId);
    });

    it("B & C. Multiple relationships & Same live answer: Supplier A and Supplier B resolve the same live Common Questionnaire data", async () => {
        const supplierOrgA = "supplier-org-a";
        const supplierOrgB = "supplier-org-b";
        const sharedAt = new Date("2026-08-18");

        const commonQuestionRecordForA = {
            id: "q-common-1",
            text: "Primary Business Address?",
            status: "SHARED",
            sharedAt,
            sharedByUserId: userId,
            answer: null,
            masterFieldNo: 3,
            order: 1,
            documents: [],
            questionnaire: {
                id: "cq-100",
                name: "Common Master KYC",
                kind: "COMMON_QUESTIONNAIRE",
                commonForClients: [
                    {
                        id: clientLEId,
                        fiEngagements: [
                            { id: "eng-a", fiOrgId: supplierOrgA, clientLEId, clientLE: { id: clientLEId, name: "Client LE X", legalEntityId: "le-x", owners: [] } }
                        ]
                    }
                ]
            }
        };

        // Supplier A setup
        getIdentityMock.mockResolvedValue({ userId: "user-sup-a" });
        prismaMock.membership.findFirst.mockResolvedValue({ id: "mem-a", userId: "user-sup-a", organizationId: supplierOrgA, organization: { types: ["FI"] } });
        prismaMock.membership.findMany.mockResolvedValue([]);

        prismaMock.question.findMany.mockResolvedValue([commonQuestionRecordForA]);

        const resultA = await getFIWorkbenchData(supplierOrgA);

        expect(resultA.questions).toHaveLength(1);
        expect(resultA.questions[0].answerVisibility).toBe("SHARED");
        expect(resultA.questions[0].answer).toBe("Live Shared Value 1");

        // Simulate live canonical value update
        kycStateMock.getAuthoritativeValue.mockResolvedValue({
            value: "Live Shared Value 2 (Updated)",
            claimId: "claim-common-2",
            sourceType: "MANUAL",
            sourceReference: null,
            assertedAt: new Date("2026-08-18")
        });

        // Supplier B setup
        const commonQuestionRecordForB = {
            ...commonQuestionRecordForA,
            questionnaire: {
                ...commonQuestionRecordForA.questionnaire,
                commonForClients: [
                    {
                        id: clientLEId,
                        fiEngagements: [
                            { id: "eng-b", fiOrgId: supplierOrgB, clientLEId, clientLE: { id: clientLEId, name: "Client LE X", legalEntityId: "le-x", owners: [] } }
                        ]
                    }
                ]
            }
        };

        getIdentityMock.mockResolvedValue({ userId: "user-sup-b" });
        prismaMock.membership.findFirst.mockResolvedValue({ id: "mem-b", userId: "user-sup-b", organizationId: supplierOrgB, organization: { types: ["FI"] } });

        prismaMock.question.findMany.mockResolvedValue([commonQuestionRecordForB]);

        const resultB = await getFIWorkbenchData(supplierOrgB);

        expect(resultB.questions).toHaveLength(1);
        expect(resultB.questions[0].answerVisibility).toBe("SHARED");
        expect(resultB.questions[0].answer).toBe("Live Shared Value 2 (Updated)");
    });

    it("D. Private fallback: Setting Common question to DRAFT redacts answer/provenance/documents for Supplier A and Supplier B", async () => {
        const supplierOrgA = "supplier-org-a";

        prismaMock.membership.findFirst.mockResolvedValue({ id: "mem-a", userId: "user-sup-a", organizationId: supplierOrgA, organization: { types: ["FI"] } });
        prismaMock.membership.findMany.mockResolvedValue([]);

        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-common-draft",
                text: "Sensitive tax declaration",
                status: "DRAFT",
                sharedAt: null,
                sharedByUserId: null,
                answer: "Private Draft Answer",
                masterFieldNo: 240,
                documents: [{ id: "doc-priv", name: "private.pdf", mimeType: "application/pdf", sizeBytes: 100, createdAt: new Date() }],
                questionnaire: {
                    id: "cq-100",
                    name: "Common Master KYC",
                    kind: "COMMON_QUESTIONNAIRE",
                    commonForClients: [
                        {
                            id: clientLEId,
                            fiEngagements: [
                                { id: "eng-a", fiOrgId: supplierOrgA, clientLEId, clientLE: { id: clientLEId, name: "Client LE X", legalEntityId: "le-x", owners: [] } }
                            ]
                        }
                    ]
                }
            }
        ]);

        const result = await getFIWorkbenchData(supplierOrgA);

        expect(result.questions).toHaveLength(1);
        const q = result.questions[0];

        expect(q.answerVisibility).toBe("NOT_SHARED");
        expect(q.answer).toBeNull();
        expect(q.provenance).toBeNull();
        expect(q.documents).toEqual([]);
    });

    it("E. Relationship isolation: Supplier associated only with Client LE Y receives zero questions from Client LE X Common Questionnaire", async () => {
        const supplierOrgC = "supplier-org-c";
        const clientLEYId = "cle-y";

        prismaMock.membership.findFirst.mockResolvedValue({ id: "mem-c", userId: "user-sup-c", organizationId: supplierOrgC, organization: { types: ["FI"] } });
        prismaMock.membership.findMany.mockResolvedValue([]);

        prismaMock.question.findMany.mockResolvedValue([]);

        const result = await getFIWorkbenchData(supplierOrgC);

        expect(result.questions).toEqual([]);
        expect(prismaMock.question.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    questionnaire: expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                kind: "COMMON_QUESTIONNAIRE"
                            })
                        ])
                    })
                })
            })
        );
    });

    it("F. Inactive relationship: ARCHIVED relationship does not grant access to Common Questionnaire", async () => {
        const supplierOrgA = "supplier-org-a";

        prismaMock.membership.findFirst.mockResolvedValue({ id: "mem-a", userId: "user-sup-a", organizationId: supplierOrgA, organization: { types: ["FI"] } });
        prismaMock.membership.findMany.mockResolvedValue([]);

        prismaMock.question.findMany.mockResolvedValue([]);

        const result = await getFIWorkbenchData(supplierOrgA);

        expect(result.questions).toEqual([]);
    });
});
