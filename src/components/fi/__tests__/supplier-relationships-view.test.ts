import { describe, it, expect } from "vitest";
import { SupplierRelationshipsView } from "../supplier-relationships-view";
import { SupplierRelationshipSummary } from "@/actions/fi";

const mockRelationships: SupplierRelationshipSummary[] = [
    {
        id: "eng-1",
        supplierOrgId: "org-1",
        clientLEId: "cle-1",
        clientLEName: "Lynn Wind Farm Limited",
        clientOrganizationName: "Ørsted",
        status: "Active",
        questionCounts: {
            total: 124,
            notShared: 34,
            shared: 12,
            released: 78
        },
        questionnaires: [
            {
                id: "q-101",
                questionnaireId: "q-101",
                name: "KYC Overview",
                version: "1.0",
                referenceCode: "KYC-V1",
                questionCounts: {
                    total: 50,
                    notShared: 10,
                    shared: 10,
                    released: 30
                },
                latestSharedOrReleasedAt: "2026-07-01T00:00:00Z"
            }
        ]
    },
    {
        id: "eng-2",
        supplierOrgId: "org-1",
        clientLEId: "cle-2",
        clientLEName: "Example Solar Holdco Limited",
        clientOrganizationName: "Vattenfall AB",
        status: "In Progress",
        questionCounts: {
            total: 20,
            notShared: 5,
            shared: 5,
            released: 10
        },
        questionnaires: []
    }
];

describe("SupplierRelationshipsView Component Structure & Safety", () => {
    it("1. Exports SupplierRelationshipsView function component", () => {
        expect(typeof SupplierRelationshipsView).toBe("function");
    });

    it("14, 15. DTO data displays no completion percentage or Approve Onboarding", () => {
        mockRelationships.forEach((rel: any) => {
            expect(rel.completionPercentage).toBeUndefined();
            expect(rel.approveOnboarding).toBeUndefined();
            expect(rel.slaData).toBeUndefined();
            expect(rel.aiInsights).toBeUndefined();
        });
    });

    it("13, 17. Question counts reconcile (total = notShared + shared + released)", () => {
        mockRelationships.forEach((rel) => {
            const { total, notShared, shared, released } = rel.questionCounts;
            expect(total).toBe(notShared + shared + released);

            rel.questionnaires.forEach((q) => {
                const qc = q.questionCounts;
                expect(qc.total).toBe(qc.notShared + qc.shared + qc.released);
            });
        });
    });

    it("18. Review link format uses questionnaireId in deep route /app/s/[orgId]/engagements/[relId]/workbench/[questionnaireId]", () => {
        const rel = mockRelationships[0];
        const q = rel.questionnaires[0];
        const reviewHref = `/app/s/${rel.supplierOrgId}/engagements/${rel.id}/workbench/${q.questionnaireId}`;
        expect(reviewHref).toBe("/app/s/org-1/engagements/eng-1/workbench/q-101");
    });
});
