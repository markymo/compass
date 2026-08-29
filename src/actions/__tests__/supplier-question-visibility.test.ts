import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getFIWorkbenchData } from "@/actions/fi";
import { getIdentity } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
    default: {
        membership: {
            findFirst: vi.fn(),
            findMany: vi.fn()
        },
        fIEngagement: {
            findMany: vi.fn().mockResolvedValue([])
        },
        question: {
            findMany: vi.fn()
        },
        questionnaireSubmission: {
            findMany: vi.fn().mockResolvedValue([])
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

const prismaMock = prisma as any;
const getIdentityMock = getIdentity as any;

describe("Supplier-Safe Question Visibility & Server-Side Redaction", () => {
    const fiOrgId = "supplier-org-100";
    const userId = "user-supplier-1";

    beforeEach(() => {
        vi.clearAllMocks();
        getIdentityMock.mockResolvedValue({ userId });
        prismaMock.membership.findFirst.mockResolvedValue({
            id: "mem-1",
            userId,
            organizationId: fiOrgId,
            organization: { types: ["FI"] }
        });
        prismaMock.membership.findMany.mockResolvedValue([]);
    });

    it("1. DRAFT question: text returned, answerVisibility=NOT_SHARED, answer/provenance null, documents empty, internal DRAFT status not exposed", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-draft-1",
                text: "What is your ESG policy?",
                status: "DRAFT",
                answer: "Draft internal secret answer",
                approvedAt: null,
                documents: [{ id: "doc-1", fileName: "draft.pdf", createdAt: new Date() }],
                questionnaire: {
                    id: "qnaire-1",
                    name: "ESG Questionnaire",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", name: "Alpha Corp", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        expect(result.questions).toHaveLength(1);
        const q = result.questions[0];

        expect(q.id).toBe("q-draft-1");
        expect(q.questionText).toBe("What is your ESG policy?");
        expect(q.answerVisibility).toBe("NOT_SHARED");
        expect(q.answer).toBeNull();
        expect(q.provenance).toBeNull();
        expect(q.documents).toEqual([]);

        // Ensure internal 'DRAFT' status is not exposed on the object
        expect((q as any).status).toBeUndefined();
    });

    it("2. APPROVED question: text returned, answerVisibility=NOT_SHARED, answer/provenance null, documents empty, approval metadata absent", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-approved-1",
                text: "What is your credit risk score?",
                status: "APPROVED",
                answer: "Confidential internal score 850",
                approvedAt: new Date("2026-05-01"),
                approvedByUserId: "admin-999",
                documents: [{ id: "doc-secret", fileName: "audit.pdf", createdAt: new Date() }],
                questionnaire: {
                    id: "qnaire-1",
                    name: "Credit Risk Form",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", name: "Alpha Corp", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        const q = result.questions[0];
        expect(q.answerVisibility).toBe("NOT_SHARED");
        expect(q.answer).toBeNull();
        expect(q.provenance).toBeNull();
        expect(q.documents).toEqual([]);

        expect((q as any).approvedAt).toBeUndefined();
        expect((q as any).approvedByUserId).toBeUndefined();
        expect((q as any).status).toBeUndefined();
    });

    it("3. SHARED question: text returned, shared answer returned, marked SHARED, no release metadata", async () => {
        const sharedAt = new Date("2026-06-15");
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-1",
                text: "Describe data encryption standard.",
                status: "SHARED",
                answer: "AES-256 GCM in transit and at rest",
                sharedAt,
                documents: [
                    { id: "doc-pub-1", name: "encryption_cert.pdf", mimeType: "application/pdf", sizeBytes: 1024, createdAt: sharedAt }
                ],
                questionnaire: {
                    id: "qnaire-1",
                    name: "Security Form",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", name: "Alpha Corp", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        const q = result.questions[0];
        expect(q.answerVisibility).toBe("SHARED");
        expect(q.answer).toBe("AES-256 GCM in transit and at rest");
        expect(q.provenance?.source).toBe("Provisional Shared");
        expect(q.documents).toHaveLength(1);
        expect(q.documents[0].fileName).toBe("encryption_cert.pdf");
        expect(q.releasedAt).toBeNull();
    });

    it("4. RELEASED question: text returned, released answer returned, release timestamp & provenance returned", async () => {
        const releasedAt = new Date("2026-07-01");
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-released-1",
                text: "What is your primary LEI number?",
                status: "RELEASED",
                answer: "5493001KJ957L6151874",
                releasedAt,
                releaseProvenance: { sourceLabel: "GLEIF Registry" },
                documents: [
                    { id: "doc-lei-1", name: "lei_cert.pdf", mimeType: "application/pdf", sizeBytes: 2048, createdAt: releasedAt }
                ],
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", name: "Alpha Corp", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        const q = result.questions[0];
        expect(q.answerVisibility).toBe("RELEASED");
        expect(q.answer).toBe("5493001KJ957L6151874");
        expect(q.releasedAt).toBeDefined();
        expect(q.provenance?.source).toBe("GLEIF Registry");
        expect(q.documents).toHaveLength(1);
    });

    it("5. Security: Supplier A cannot retrieve Supplier B's questions", async () => {
        prismaMock.membership.findFirst.mockResolvedValue(null);
        prismaMock.membership.findMany.mockResolvedValue([]);

        const result = await getFIWorkbenchData("supplier-org-OTHER");

        expect(result.questions).toEqual([]);
        expect(prismaMock.question.findMany).not.toHaveBeenCalled();
    });

    it("6. Security: Inaccessible Relationship cannot be retrieved by guessing its ID", async () => {
        // User belongs to supplier-org-100, but has restricted engagement memberships
        prismaMock.membership.findFirst.mockResolvedValue(null); // No org-wide admin
        prismaMock.membership.findMany.mockResolvedValue([{ fiEngagementId: "eng-allowed-only" }]);

        await getFIWorkbenchData(fiOrgId);

        // Verify prisma query includes engagement id filter
        const queryArg = prismaMock.question.findMany.mock.calls[0][0];
        const engBranch = queryArg.where.questionnaire.OR.find((b: any) => b.fiEngagementId);
        expect(engBranch.fiEngagement.id).toEqual({ in: ["eng-allowed-only"] });
    });

    it("7. Security: Questions from unassigned templates are not returned", async () => {
        await getFIWorkbenchData(fiOrgId);

        const queryArg = prismaMock.question.findMany.mock.calls[0][0];
        const engBranch = queryArg.where.questionnaire.OR.find((b: any) => b.fiEngagementId);
        expect(engBranch.fiEngagementId).toEqual({ not: null });
    });

    it("8 & 9. Security: Hidden answers and draft documents are absent from serialized result", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-draft-2",
                text: "Draft question",
                status: "DRAFT",
                answer: "TOP SECRET UNAPPROVED ANSWER",
                documents: [{ id: "doc-draft", fileName: "secret.pdf" }],
                questionnaire: {
                    id: "qnaire-1",
                    name: "Test",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", name: "Alpha", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);
        const serializedJson = JSON.stringify(result);

        expect(serializedJson).not.toContain("TOP SECRET UNAPPROVED ANSWER");
        expect(serializedJson).not.toContain("secret.pdf");
        expect(serializedJson).not.toContain("doc-draft");
    });

    it("11. Counts: Total and visibility counts reconcile correctly (total = notShared + shared + released)", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            { id: "q1", text: "Q1", status: "DRAFT", questionnaire: { id: "q", name: "N", fiEngagement: { id: "e", clientLE: { id: "c", name: "L" } } } },
            { id: "q2", text: "Q2", status: "APPROVED", questionnaire: { id: "q", name: "N", fiEngagement: { id: "e", clientLE: { id: "c", name: "L" } } } },
            { id: "q3", text: "Q3", status: "SHARED", answer: "A3", questionnaire: { id: "q", name: "N", fiEngagement: { id: "e", clientLE: { id: "c", name: "L" } } } },
            { id: "q4", text: "Q4", status: "RELEASED", answer: "A4", questionnaire: { id: "q", name: "N", fiEngagement: { id: "e", clientLE: { id: "c", name: "L" } } } }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);

        expect(result.counts.notShared).toBe(2);
        expect(result.counts.shared).toBe(1);
        expect(result.counts.released).toBe(1);
        expect(result.counts.total).toBe(4);
        expect(result.counts.total).toBe(result.counts.notShared + result.counts.shared + result.counts.released);
    });

    it("12. Provenance metadata propagation: sourceType, sourceReference, and lastValidatedAt populated", async () => {
        const releasedAt = new Date("2026-07-22T13:34:00Z");
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-released-prov-1",
                text: "What is your registered legal name?",
                status: "RELEASED",
                answer: "ZZOOMM PLC",
                releasedAt,
                releaseProvenance: {
                    sourceType: "REGISTRATION_AUTHORITY",
                    sourceReference: "COMPANIES_HOUSE",
                    sourceLabel: "Companies House",
                    lastValidatedAt: "2026-07-22T13:34:00.000Z"
                },
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", name: "ZZOOMM PLC", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.answerVisibility).toBe("RELEASED");
        expect(q.answer).toBe("ZZOOMM PLC");
        expect(q.provenance).toBeDefined();
        expect(q.provenance?.sourceType).toBe("REGISTRATION_AUTHORITY");
        expect(q.provenance?.sourceReference).toBe("COMPANIES_HOUSE");
        expect(q.provenance?.lastValidatedAt).toBeDefined();
    });
});
