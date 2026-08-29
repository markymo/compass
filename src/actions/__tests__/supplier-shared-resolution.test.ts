import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getFIWorkbenchData } from "@/actions/fi";
import { getIdentity } from "@/lib/auth";
import { KycStateService } from "@/lib/kyc/KycStateService";

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
    listAllMasterFields: vi.fn().mockResolvedValue([
        { fieldNo: 3, category: "General Corporate" }
    ]),
    listAllMasterGroups: vi.fn().mockResolvedValue([])
}));

vi.mock("@/lib/kyc/KycStateService", () => ({
    KycStateService: {
        getAuthoritativeValue: vi.fn()
    }
}));

vi.mock("@/services/masterData/referenceEnrichmentService", () => ({
    enrichPartyReferences: vi.fn().mockResolvedValue(undefined),
    enrichAddressReferences: vi.fn().mockResolvedValue(undefined)
}));

const prismaMock = prisma as any;
const getIdentityMock = getIdentity as any;
const getAuthoritativeValueMock = KycStateService.getAuthoritativeValue as any;

describe("Supplier SHARED Live Canonical Resolution & Last Validated Rules", () => {
    const fiOrgId = "supplier-org-100";
    const userId = "user-supplier-1";
    const sharedAtDate = new Date("2026-08-10T10:00:00.000Z");

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

    it("1. SHARED mapped canonical value with q.answer = null: supplier sees live canonical value", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-mapped-1",
                text: "Legal Name",
                status: "SHARED",
                answer: null,
                masterFieldNo: 3,
                sharedAt: sharedAtDate,
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC", owners: [] }
                    }
                }
            }
        ]);

        getAuthoritativeValueMock.mockResolvedValue({
            claimId: "claim-100",
            value: "ABERDEEN GROUP PLC",
            sourceType: "REGISTRATION_AUTHORITY",
            sourceReference: "COMPANIES_HOUSE",
            sourceCheckedAt: new Date("2026-06-28T17:48:47.000Z"),
            assertedAt: new Date("2026-06-28T17:48:47.000Z")
        });

        const result = await getFIWorkbenchData(fiOrgId);

        expect(result.questions).toHaveLength(1);
        const q = result.questions[0];

        expect(q.id).toBe("q-shared-mapped-1");
        expect(q.answerVisibility).toBe("SHARED");
        expect(q.answer).toBe("ABERDEEN GROUP PLC");
        expect(getAuthoritativeValueMock).toHaveBeenCalledWith(
            { subjectLeId: "le-1" },
            3,
            "cle-1",
            undefined // snapshotDate = undefined (Live current value)
        );
    });

    it("2. Live canonical value changing while SHARED: supplier sees updated live value", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-mapped-1",
                text: "Legal Name",
                status: "SHARED",
                answer: null,
                masterFieldNo: 3,
                sharedAt: sharedAtDate,
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC UPDATED", owners: [] }
                    }
                }
            }
        ]);

        // Simulating Master Record update after initial share
        getAuthoritativeValueMock.mockResolvedValue({
            claimId: "claim-101",
            value: "ABERDEEN GROUP PLC UPDATED",
            sourceType: "REGISTRATION_AUTHORITY",
            sourceReference: "COMPANIES_HOUSE",
            sourceCheckedAt: new Date("2026-08-11T12:00:00.000Z"),
            assertedAt: new Date("2026-08-11T12:00:00.000Z")
        });

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.answer).toBe("ABERDEEN GROUP PLC UPDATED");
    });

    it("3. External-source provenance + genuine canonical Last Validated: uses sourceCheckedAt, NOT sharedAt", async () => {
        const canonicalCheckedAt = new Date("2026-06-28T17:48:47.000Z");

        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-ext-1",
                text: "Legal Name",
                status: "SHARED",
                answer: null,
                masterFieldNo: 3,
                sharedAt: sharedAtDate, // 2026-08-10
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC", owners: [] }
                    }
                }
            }
        ]);

        getAuthoritativeValueMock.mockResolvedValue({
            claimId: "claim-100",
            value: "ABERDEEN GROUP PLC",
            sourceType: "REGISTRATION_AUTHORITY",
            sourceReference: "COMPANIES_HOUSE",
            sourceCheckedAt: canonicalCheckedAt,
            assertedAt: canonicalCheckedAt
        });

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.provenance?.sourceType).toBe("REGISTRATION_AUTHORITY");
        expect(q.provenance?.lastValidatedAt).toBe(canonicalCheckedAt.toISOString());
        expect(q.provenance?.lastValidatedAt).not.toBe(sharedAtDate.toISOString());
    });

    it("4. USER_INPUT answer where Last Validated = sharedAt", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-userinput-1",
                text: "Custom Notes",
                status: "SHARED",
                answer: "Supplier specific manual note",
                masterFieldNo: null,
                sharedAt: sharedAtDate,
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.answerVisibility).toBe("SHARED");
        expect(q.answer).toBe("Supplier specific manual note");
        expect(q.provenance?.sourceType).toBe("USER_INPUT");
        expect(q.provenance?.lastValidatedAt).toBe(sharedAtDate.toISOString());
    });

    it("5. Explicit none preserved in SHARED state", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-none-1",
                text: "Secondary Address",
                status: "SHARED",
                answer: null,
                masterFieldNo: 15,
                sharedAt: sharedAtDate,
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC", owners: [] }
                    }
                }
            }
        ]);

        getAuthoritativeValueMock.mockResolvedValue({
            claimId: "claim-none-1",
            value: { explicitNone: true },
            sourceType: "USER_INPUT",
            assertedAt: new Date("2026-07-01T00:00:00.000Z")
        });

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.answer).toEqual({ explicitNone: true });
    });

    it("6. Manual answer override in SHARED state takes precedence over mapped canonical value", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-override-1",
                text: "Legal Name",
                status: "SHARED",
                answer: "Manual Legal Name Override",
                masterFieldNo: 3,
                sharedAt: sharedAtDate,
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC", owners: [] }
                    }
                }
            }
        ]);

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.answer).toBe("Manual Legal Name Override");
        // KycStateService should not be invoked when manual q.answer is present
        expect(getAuthoritativeValueMock).not.toHaveBeenCalled();
    });

    it("7. No accidental use of sharedAt for external-source Last Validated when sourceCheckedAt is missing", async () => {
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: "q-shared-ext-no-date",
                text: "Legal Name",
                status: "SHARED",
                answer: null,
                masterFieldNo: 3,
                sharedAt: sharedAtDate,
                questionnaire: {
                    id: "qnaire-1",
                    name: "Master Profile",
                    fiEngagement: {
                        id: "eng-1",
                        clientLE: { id: "cle-1", legalEntityId: "le-1", name: "ABERDEEN GROUP PLC", owners: [] }
                    }
                }
            }
        ]);

        getAuthoritativeValueMock.mockResolvedValue({
            claimId: "claim-102",
            value: "ABERDEEN GROUP PLC",
            sourceType: "REGISTRATION_AUTHORITY",
            sourceReference: "COMPANIES_HOUSE",
            sourceCheckedAt: null,
            assertedAt: null
        });

        const result = await getFIWorkbenchData(fiOrgId);
        const q = result.questions[0];

        expect(q.provenance?.sourceType).toBe("REGISTRATION_AUTHORITY");
        expect(q.provenance?.lastValidatedAt).toBeNull();
        expect(q.provenance?.lastValidatedAt).not.toBe(sharedAtDate.toISOString());
    });
});
