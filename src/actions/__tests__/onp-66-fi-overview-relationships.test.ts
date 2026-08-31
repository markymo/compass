import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSupplierRelationshipsSummary } from "../fi";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
    default: {
        membership: {
            findMany: vi.fn(),
        },
        fIEngagement: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn(),
}));

describe("ONP-66 — FI Overview Relationship Display Semantics Proof", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. Deterministically queries, scopes, and groups multiple client relationships for an FI organization", async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: "user-fi-admin" } as any);

        // User is member of FI organization fi-bank-1
        vi.mocked(prisma.membership.findMany).mockResolvedValue([
            { organizationId: "fi-bank-1", fiEngagementId: null },
        ] as any);

        // FI has 3 relationships across 2 client organizations
        const mockEngagements = [
            {
                id: "eng-1",
                fiOrgId: "fi-bank-1",
                status: "ACTIVE",
                dueDate: new Date("2026-09-30"),
                clientLEId: "le-acme-uk",
                clientLE: {
                    id: "le-acme-uk",
                    name: "Acme UK Operations Ltd",
                    isDeleted: false,
                    owners: [
                        {
                            party: {
                                id: "org-acme-global",
                                name: "Acme Global Group",
                            },
                        },
                    ],
                },
                questionnaireInstances: [
                    {
                        id: "qi-1",
                        name: "KYC Master Profile",
                        status: "SHARED",
                        isDeleted: false,
                        updatedAt: new Date("2026-08-15"),
                        questions: [
                            { id: "q-1", status: "SHARED", sharedAt: new Date(), releasedAt: null },
                            { id: "q-2", status: "RELEASED", sharedAt: new Date(), releasedAt: new Date() },
                        ],
                    },
                ],
            },
            {
                id: "eng-2",
                fiOrgId: "fi-bank-1",
                status: "IN_PROGRESS",
                dueDate: null,
                clientLEId: "le-acme-eu",
                clientLE: {
                    id: "le-acme-eu",
                    name: "Acme European Holdings B.V.",
                    isDeleted: false,
                    owners: [
                        {
                            party: {
                                id: "org-acme-global",
                                name: "Acme Global Group",
                            },
                        },
                    ],
                },
                questionnaireInstances: [],
            },
            {
                id: "eng-3",
                fiOrgId: "fi-bank-1",
                status: "ACTIVE",
                dueDate: new Date("2026-10-15"),
                clientLEId: "le-beta-corp",
                clientLE: {
                    id: "le-beta-corp",
                    name: "Beta Technologies Ltd",
                    isDeleted: false,
                    owners: [
                        {
                            party: {
                                id: "org-beta-holdings",
                                name: "Beta Holdings Inc",
                            },
                        },
                    ],
                },
                questionnaireInstances: [
                    {
                        id: "qi-2",
                        name: "ISDA Schedule",
                        status: "SHARED",
                        isDeleted: false,
                        updatedAt: new Date("2026-08-20"),
                        questions: [
                            { id: "q-3", status: "SHARED", sharedAt: new Date(), releasedAt: null },
                        ],
                    },
                ],
            },
        ];

        vi.mocked(prisma.fIEngagement.findMany).mockResolvedValue(mockEngagements as any);

        const groups = await getSupplierRelationshipsSummary("fi-bank-1");

        // Verify Prisma query was strictly scoped to fiOrgId: 'fi-bank-1'
        expect(prisma.fIEngagement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    fiOrgId: "fi-bank-1",
                    isDeleted: false,
                }),
            })
        );

        // Exactly 2 client organization groups
        expect(groups).toHaveLength(2);

        // Group 1: Acme Global Group (2 relationships)
        const acmeGroup = groups.find((g) => g.clientOrganizationId === "org-acme-global");
        expect(acmeGroup).toBeDefined();
        expect(acmeGroup?.clientOrganizationName).toBe("Acme Global Group");
        expect(acmeGroup?.legalEntities).toHaveLength(2);
        expect(acmeGroup?.legalEntities.map((le) => le.clientLEName)).toEqual([
            "Acme European Holdings B.V.",
            "Acme UK Operations Ltd",
        ]);

        // Group 2: Beta Holdings Inc (1 relationship)
        const betaGroup = groups.find((g) => g.clientOrganizationId === "org-beta-holdings");
        expect(betaGroup).toBeDefined();
        expect(betaGroup?.clientOrganizationName).toBe("Beta Holdings Inc");
        expect(betaGroup?.legalEntities).toHaveLength(1);
        expect(betaGroup?.legalEntities[0].clientLEName).toBe("Beta Technologies Ltd");

        // Verify Total Relationship Count = 3
        const totalRelationships = groups.reduce((acc, g) => acc + g.legalEntities.length, 0);
        expect(totalRelationships).toBe(3);
    });

    it("2. Returns empty list if caller has no membership access to the requested FI organization", async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: "unauthorized-user" } as any);
        vi.mocked(prisma.membership.findMany).mockResolvedValue([] as any);

        const groups = await getSupplierRelationshipsSummary("fi-foreign-org");
        expect(groups).toEqual([]);
        expect(prisma.fIEngagement.findMany).not.toHaveBeenCalled();
    });
});
