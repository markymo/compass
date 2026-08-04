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

    it("1, 2. Reads questionnaireInstances relation and ignores questionnaires m2m relation", async () => {
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
                    owners: [{ party: { id: "client-org-1", name: "Ørsted" } }]
                },
                questionnaireInstances: [
                    {
                        id: "instance-1",
                        fiEngagementId: "eng-1",
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
                ],
                questionnaires: [
                    {
                        id: "m2m-template-1",
                        name: "Unassigned Template",
                        questions: [{ id: "t1", status: "DRAFT" }]
                    }
                ]
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        expect(result).toHaveLength(1);
        expect(result[0].questionnaireCount).toBe(1);

        const le = result[0].legalEntities[0];
        expect(le.questionnaires).toHaveLength(1);
        expect(le.questionnaires[0].questionnaireId).toBe("instance-1");
        expect(le.questionCounts.total).toBe(4);
        expect(le.questionCounts.notShared).toBe(2);
        expect(le.questionCounts.shared).toBe(1);
        expect(le.questionCounts.released).toBe(1);
    });

    it("Regression Test Inverse: m2m questionnaires relation with 0 questionnaireInstances returns 0 questionnaires", async () => {
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
                questionnaireInstances: [],
                questionnaires: [
                    {
                        id: "template-1",
                        name: "Associated Template",
                        questions: [{ id: "q1", status: "RELEASED" }]
                    }
                ]
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        expect(result).toHaveLength(1);
        expect(result[0].questionnaireCount).toBe(0);
        expect(result[0].legalEntities[0].questionnaires).toHaveLength(0);
        expect(result[0].legalEntities[0].questionCounts.total).toBe(0);
    });

    it("3. Multiple questionnaireInstances under one Relationship are all counted", async () => {
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
                questionnaireInstances: [
                    {
                        id: "inst-1",
                        name: "Q1",
                        questions: [{ id: "q1", status: "DRAFT" }]
                    },
                    {
                        id: "inst-2",
                        name: "Q2",
                        questions: [{ id: "q2", status: "RELEASED", releasedAt: new Date("2026-07-01") }]
                    }
                ],
                questionnaires: []
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        expect(result[0].questionnaireCount).toBe(2);
        expect(result[0].questionCounts.total).toBe(2);
    });

    it("9, 10, 11. Question counts reconcile at Client Org, ClientLE, and Questionnaire levels", async () => {
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
                questionnaireInstances: [
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
                ],
                questionnaires: []
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        const clientGroup = result[0];
        const le = clientGroup.legalEntities[0];
        const q = le.questionnaires[0];

        expect(q.questionCounts.total).toBe(4);
        expect(q.questionCounts.notShared).toBe(2);
        expect(q.questionCounts.shared).toBe(1);
        expect(q.questionCounts.released).toBe(1);

        expect(le.questionCounts).toEqual(q.questionCounts);
        expect(clientGroup.questionCounts).toEqual(le.questionCounts);
    });

    it("27. Tenant isolation: Supplier A cannot retrieve Supplier B relationships", async () => {
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
                questionnaireInstances: [
                    {
                        id: "qnaire-1",
                        name: "Financials",
                        questions: [
                            { id: "q1", status: "SHARED", sharedAt: new Date("2026-06-15T10:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z") },
                            { id: "q2", status: "RELEASED", releasedAt: new Date("2026-07-20T10:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z") }
                        ]
                    }
                ],
                questionnaires: []
            }
        ]);

        const result = await getSupplierRelationshipsSummary(supplierOrgId);
        const qSummary = result[0].legalEntities[0].questionnaires[0];
        expect(qSummary.latestSharedOrReleasedAt).toBe(new Date("2026-07-20T10:00:00Z").toISOString());
    });
});
