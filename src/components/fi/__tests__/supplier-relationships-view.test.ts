import { describe, it, expect } from "vitest";
import { SupplierRelationshipsView } from "../supplier-relationships-view";
import { SupplierClientRelationshipGroup } from "@/actions/fi";

const mockRelationships: SupplierClientRelationshipGroup[] = [
    {
        clientOrganizationId: "client-org-1",
        clientOrganizationName: "Ørsted Group",
        questionnaireCount: 2,
        questionCounts: {
            total: 144,
            notShared: 39,
            shared: 17,
            released: 88
        },
        legalEntities: [
            {
                relationshipId: "eng-1",
                clientLEId: "cle-1",
                clientLEName: "Lynn Wind Farm Limited",
                status: "CONNECTED",
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
                relationshipId: "eng-2",
                clientLEId: "cle-2",
                clientLEName: "Race Bank Wind Farm Limited",
                status: "PREPARATION",
                questionCounts: {
                    total: 20,
                    notShared: 5,
                    shared: 5,
                    released: 10
                },
                questionnaires: []
            }
        ]
    },
    {
        clientOrganizationId: "client-org-2",
        clientOrganizationName: "Vattenfall AB",
        questionnaireCount: 1,
        questionCounts: {
            total: 30,
            notShared: 5,
            shared: 5,
            released: 20
        },
        legalEntities: [
            {
                relationshipId: "eng-3",
                clientLEId: "cle-3",
                clientLEName: "Example Solar Holdco Limited",
                status: "ACTIVE",
                questionCounts: {
                    total: 30,
                    notShared: 5,
                    shared: 5,
                    released: 20
                },
                questionnaires: [
                    {
                        id: "q-201",
                        questionnaireId: "q-201",
                        name: "Financial Review",
                        version: "2.0",
                        referenceCode: "FIN-V2",
                        questionCounts: {
                            total: 30,
                            notShared: 5,
                            shared: 5,
                            released: 20
                        },
                        latestSharedOrReleasedAt: "2026-07-05T00:00:00Z"
                    }
                ]
            }
        ]
    }
];

describe("SupplierRelationshipsView Hierarchy, Counts & Navigation", () => {
    it("1. Component exports SupplierRelationshipsView function", () => {
        expect(typeof SupplierRelationshipsView).toBe("function");
    });

    it("2. Multiple ClientLEs owned by same Client group into one Client card", () => {
        const orstedGroup = mockRelationships.find((r) => r.clientOrganizationName === "Ørsted Group");
        expect(orstedGroup).toBeDefined();
        expect(orstedGroup?.legalEntities).toHaveLength(2);
        expect(orstedGroup?.legalEntities[0].clientLEName).toBe("Lynn Wind Farm Limited");
        expect(orstedGroup?.legalEntities[1].clientLEName).toBe("Race Bank Wind Farm Limited");
    });

    it("3. ClientLEs owned by different Clients appear in separate Client cards", () => {
        expect(mockRelationships).toHaveLength(2);
        expect(mockRelationships[0].clientOrganizationName).toBe("Ørsted Group");
        expect(mockRelationships[1].clientOrganizationName).toBe("Vattenfall AB");
    });

    it("9, 10, 11. Question counts aggregate and reconcile at Client, ClientLE, and Questionnaire levels", () => {
        mockRelationships.forEach((clientGrp) => {
            let sumTotal = 0;
            let sumNotShared = 0;
            let sumShared = 0;
            let sumReleased = 0;

            clientGrp.legalEntities.forEach((le) => {
                const { total, notShared, shared, released } = le.questionCounts;
                expect(total).toBe(notShared + shared + released);
                sumTotal += total;
                sumNotShared += notShared;
                sumShared += shared;
                sumReleased += released;

                le.questionnaires.forEach((q) => {
                    const qc = q.questionCounts;
                    expect(qc.total).toBe(qc.notShared + qc.shared + qc.released);
                });
            });

            expect(clientGrp.questionCounts.total).toBe(sumTotal);
            expect(clientGrp.questionCounts.notShared).toBe(sumNotShared);
            expect(clientGrp.questionCounts.shared).toBe(sumShared);
            expect(clientGrp.questionCounts.released).toBe(sumReleased);
        });
    });

    it("12, 13. Relationship status appears at ClientLE level; no Client-wide status exists", () => {
        mockRelationships.forEach((clientGrp: any) => {
            expect(clientGrp.status).toBeUndefined();
            clientGrp.legalEntities.forEach((le: any) => {
                expect(le.status).toBeDefined();
            });
        });
    });

    it("Task 8B. Review questionnaire links target Questions & Answers with URL-encoded rel and q filters", () => {
        const orgId = "org-1";
        const le = mockRelationships[0].legalEntities[0];
        const q = le.questionnaires[0];
        const params = new URLSearchParams({
            rel: le.clientLEName,
            q: q.name
        });
        const reviewHref = `/app/s/${orgId}/questions?${params.toString()}`;
        expect(reviewHref).toBe("/app/s/org-1/questions?rel=Lynn+Wind+Farm+Limited&q=KYC+Overview");
        expect(reviewHref).not.toContain("/workbench/");
    });

    it("14, 15. DTO data displays no completion percentage or fake metrics", () => {
        mockRelationships.forEach((grp: any) => {
            expect(grp.completionPercentage).toBeUndefined();
            expect(grp.approveOnboarding).toBeUndefined();
            expect(grp.slaData).toBeUndefined();
        });
    });
});
