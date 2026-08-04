import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { getSupplierRelationshipsSummary } from "../fi";

vi.mock("@/lib/prisma", () => ({
    default: {
        membership: { findMany: vi.fn() },
        fIEngagement: { findMany: vi.fn() }
    }
}));

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn()
}));

const prismaMock = prisma as any;

describe("Supplier Relationships Summary Data Layer (getSupplierRelationshipsSummary)", () => {
    const supplierOrgId = "org-supplier-100";

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: "user-supplier-1" });
    });

    it("8. Each accessible ClientLE Relationship appears once with correct parent client name", async () => {
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: supplierOrgId, fiEngagementId: null }
        ]);

        prismaMock.fIEngagement.findMany.mockResolvedValue([
            {
                id: "eng-1",
                fiOrgId: supplierOrgId,
                clientLEId: "cle-1",
                status: "Active",
                clientLE: {
                    name: "Lynn Wind Farm Limited",
                    owners: [{ party: { name: "Ørsted" } }]
                },
                questionnaires: [
                    {
                        id: "qnaire-10",
                        name: "KYC Overview",
                        code: "KYC-V1",
                        version: "1.0",
                        questions: [
                            { id: "q1", status: "DRAFT", sharedAt: null, releasedAt: null },
                            { id: "q2", status: "APPROVED", sharedAt: null, releasedAt: null },
                            { id: "q3", status: "SHARED", sharedAt: new Date("2026-06-01T00:00:00Z"), releasedAt: null },
                            { id: "q4", status: "RELEASED", sharedAt: null, releasedAt: new Date("2026-07-01T00:00:00Z") }
                        ]
                    }
                ]
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        expect(result).toHaveLength(1);
        expect(result[0].clientLEName).toBe("Lynn Wind Farm Limited");
        expect(result[0].clientOrganizationName).toBe("Ørsted");
        expect(result[0].questionnaires[0].questionnaireId).toBe("qnaire-10");
    });

    it("10, 11, 12, 13. Question counts reconcile (total = awaitingClient + shared + released)", async () => {
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: supplierOrgId, fiEngagementId: null }
        ]);

        prismaMock.fIEngagement.findMany.mockResolvedValue([
            {
                id: "eng-1",
                fiOrgId: supplierOrgId,
                clientLEId: "cle-1",
                status: "Active",
                clientLE: { name: "Lynn Wind", owners: [] },
                questionnaires: [
                    {
                        id: "qnaire-10",
                        name: "Corporate Profile",
                        questions: [
                            { id: "q1", status: "DRAFT" },
                            { id: "q2", status: "APPROVED" },
                            { id: "q3", status: "SHARED", sharedAt: new Date("2026-06-01") },
                            { id: "q4", status: "RELEASED", releasedAt: new Date("2026-07-01") }
                        ]
                    }
                ]
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        const rel = result[0];
        const { total, notShared, shared, released } = rel.questionCounts;

        expect(total).toBe(4);
        expect(notShared).toBe(2); // DRAFT (1) + APPROVED (1) = 2
        expect(shared).toBe(1);
        expect(released).toBe(1);
        expect(total).toBe(notShared + shared + released);
    });

    it("14, 15, 27. DTO excludes hidden answers, percentages, supplier notes, and approval metadata", async () => {
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: supplierOrgId, fiEngagementId: null }
        ]);

        prismaMock.fIEngagement.findMany.mockResolvedValue([
            {
                id: "eng-1",
                fiOrgId: supplierOrgId,
                clientLEId: "cle-1",
                status: "Active",
                clientLE: { name: "Lynn Wind", owners: [] },
                questionnaires: []
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        const rel = result[0] as any;

        expect(rel.completionPercentage).toBeUndefined();
        expect(rel.supplierNote).toBeUndefined();
        expect(rel.answers).toBeUndefined();
        expect(rel.fieldClaims).toBeUndefined();
    });

    it("25. Tenant isolation: Supplier A cannot retrieve Supplier B relationships", async () => {
        // User belongs to org-supplier-OTHER
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: "org-supplier-OTHER", fiEngagementId: null }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        expect(result).toEqual([]);
    });

    it("Task 4A.1. Uses releasedAt for RELEASED and sharedAt for SHARED; ignores updatedAt", async () => {
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: supplierOrgId, fiEngagementId: null }
        ]);

        prismaMock.fIEngagement.findMany.mockResolvedValue([
            {
                id: "eng-1",
                fiOrgId: supplierOrgId,
                clientLEId: "cle-1",
                clientLE: { name: "Lynn Wind", owners: [] },
                questionnaires: [
                    {
                        id: "qnaire-1",
                        name: "Financials",
                        questions: [
                            { id: "q1", status: "SHARED", sharedAt: new Date("2026-06-15T10:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z") },
                            { id: "q2", status: "RELEASED", releasedAt: new Date("2026-07-20T10:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z") }
                        ]
                    }
                ]
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        const qSummary = result[0].questionnaires[0];
        // Must match maximum of sharedAt / releasedAt (2026-07-20), ignoring newer updatedAt dates
        expect(qSummary.latestSharedOrReleasedAt).toBe(new Date("2026-07-20T10:00:00Z").toISOString());
    });

    it("Task 4A.5. Questionnaire with no sharedAt or releasedAt timestamps returns null", async () => {
        prismaMock.membership.findMany.mockResolvedValue([
            { organizationId: supplierOrgId, fiEngagementId: null }
        ]);

        prismaMock.fIEngagement.findMany.mockResolvedValue([
            {
                id: "eng-1",
                fiOrgId: supplierOrgId,
                clientLEId: "cle-1",
                clientLE: { name: "Lynn Wind", owners: [] },
                questionnaires: [
                    {
                        id: "qnaire-1",
                        name: "Financials",
                        questions: [
                            { id: "q1", status: "SHARED", sharedAt: null, updatedAt: new Date("2026-09-01T00:00:00Z") },
                            { id: "q2", status: "DRAFT", sharedAt: null, releasedAt: null, updatedAt: new Date("2026-10-01T00:00:00Z") }
                        ]
                    }
                ]
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        const qSummary = result[0].questionnaires[0];
        expect(qSummary.latestSharedOrReleasedAt).toBeNull();
    });
});
