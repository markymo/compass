import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";
import { getSupplierTeamMembers } from "../fi";

vi.mock("@/lib/prisma", () => ({
    default: {
        membership: { findMany: vi.fn() },
        invitation: { findMany: vi.fn() }
    }
}));

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn()
}));

const prismaMock = prisma as any;

describe("Supplier Team Members Data Layer (getSupplierTeamMembers)", () => {
    const supplierOrgId = "org-supplier-100";

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: "user-supplier-admin" });
    });

    it("11, 12. Security & Tenant Isolation: Supplier A sees only Supplier A members; unauthorized user rejected", async () => {
        // Calling user belongs to org-supplier-OTHER
        prismaMock.membership.findMany.mockResolvedValueOnce([
            { organizationId: "org-supplier-OTHER", fiEngagement: null }
        ]);

        const result = await getSupplierTeamMembers(supplierOrgId);
        expect(result.members).toEqual([]);
        expect(result.pendingInvitations).toEqual([]);
    });

    it("3, 6, 7. Supplier-wide access vs Relationship-specific access scope derivation", async () => {
        // User memberships check (calling user is pure ORG_ADMIN on supplierOrgId)
        prismaMock.membership.findMany
            .mockResolvedValueOnce([
                { organizationId: supplierOrgId, fiEngagement: null, role: "ORG_ADMIN" }
            ])
            // Team memberships query
            .mockResolvedValueOnce([
                {
                    organizationId: supplierOrgId,
                    role: "ORG_ADMIN",
                    createdAt: new Date("2026-01-01"),
                    user: { id: "user-1", name: "Jane Smith", email: "jane@riskbridge.com" },
                    fiEngagement: null
                },
                {
                    organizationId: null,
                    role: "RELATIONSHIP_USER",
                    createdAt: new Date("2026-02-01"),
                    user: { id: "user-2", name: "Tom Jones", email: "tom@riskbridge.com" },
                    fiEngagement: {
                        id: "eng-100",
                        clientLE: { name: "Lynn Wind Farm Limited" }
                    }
                }
            ]);

        prismaMock.invitation.findMany.mockResolvedValueOnce([]);

        const result = await getSupplierTeamMembers(supplierOrgId);
        expect(result.members).toHaveLength(2);

        const jane = result.members.find((m) => m.userId === "user-1");
        expect(jane?.roleLabel).toBe("Supplier Admin");
        expect(jane?.accessScope.kind).toBe("SUPPLIER");

        const tom = result.members.find((m) => m.userId === "user-2");
        expect(tom?.roleLabel).toBe("Relationship User");
        expect(tom?.accessScope.kind).toBe("RELATIONSHIPS");
        expect(tom?.accessScope.relationships).toHaveLength(1);
        expect(tom?.accessScope.relationships?.[0].clientLEName).toBe("Lynn Wind Farm Limited");
    });

    it("14, 15. DTO Security: Tokens, passwords, and raw prisma auth records are absent", async () => {
        prismaMock.membership.findMany
            .mockResolvedValueOnce([
                { organizationId: supplierOrgId, fiEngagement: null, role: "ORG_ADMIN" }
            ])
            .mockResolvedValueOnce([
                {
                    organizationId: supplierOrgId,
                    role: "ORG_ADMIN",
                    createdAt: new Date("2026-01-01"),
                    user: { id: "user-1", name: "Jane Smith", email: "jane@riskbridge.com" }
                }
            ]);

        prismaMock.invitation.findMany.mockResolvedValueOnce([
            {
                id: "inv-1",
                sentToEmail: "newuser@riskbridge.com",
                role: "RELATIONSHIP_USER",
                createdAt: new Date("2026-03-01"),
                expiresAt: new Date("2026-04-01"),
                organizationId: supplierOrgId,
                fiEngagement: null
            }
        ]);

        const result = await getSupplierTeamMembers(supplierOrgId);
        const member = result.members[0] as any;
        const invite = result.pendingInvitations[0] as any;

        expect(member.password).toBeUndefined();
        expect(member.tokenHash).toBeUndefined();
        expect(invite.tokenHash).toBeUndefined();
        expect(invite.token).toBeUndefined();
    });

    it("17, 18, 19. Pending invitations: Genuine Supplier invitations rendered without token exposure", async () => {
        prismaMock.membership.findMany
            .mockResolvedValueOnce([
                { organizationId: supplierOrgId, fiEngagement: null, role: "ORG_ADMIN" }
            ])
            .mockResolvedValueOnce([]);

        prismaMock.invitation.findMany.mockResolvedValueOnce([
            {
                id: "inv-999",
                sentToEmail: "pending@riskbridge.com",
                role: "RELATIONSHIP_ADMIN",
                createdAt: new Date("2026-03-15"),
                expiresAt: new Date("2026-04-15"),
                organizationId: null,
                fiEngagement: { clientLE: { name: "Example Solar Holdco" } }
            }
        ]);

        const result = await getSupplierTeamMembers(supplierOrgId);
        expect(result.pendingInvitations).toHaveLength(1);
        expect(result.pendingInvitations[0].email).toBe("pending@riskbridge.com");
        expect(result.pendingInvitations[0].accessScope).toBe("Example Solar Holdco");
        expect(result.pendingInvitations[0].roleLabel).toBe("Relationship Admin");
    });

    describe("Contract Scoping: ORG_ADMIN vs pure ORG_MEMBER vs Scoped Relationship User", () => {
        it("1. pure ORG_ADMIN -> queries supplier-wide Team metadata and pending invitations", async () => {
            prismaMock.membership.findMany
                .mockResolvedValueOnce([
                    { organizationId: supplierOrgId, fiEngagement: null, role: "ORG_ADMIN" }
                ])
                .mockResolvedValueOnce([
                    {
                        organizationId: supplierOrgId,
                        role: "ORG_ADMIN",
                        createdAt: new Date("2026-01-01"),
                        user: { id: "admin-1", name: "Admin One", email: "admin@riskbridge.com" },
                        fiEngagement: null
                    }
                ]);

            prismaMock.invitation.findMany.mockResolvedValueOnce([
                {
                    id: "inv-org",
                    sentToEmail: "invitee@riskbridge.com",
                    role: "RELATIONSHIP_ADMIN",
                    createdAt: new Date("2026-03-01"),
                    expiresAt: new Date("2026-04-01"),
                    organizationId: supplierOrgId,
                    fiEngagement: null
                }
            ]);

            const result = await getSupplierTeamMembers(supplierOrgId);
            expect(result.members).toHaveLength(1);
            expect(result.pendingInvitations).toHaveLength(1);

            // Verify supplier-wide query args
            const teamQueryArgs = prismaMock.membership.findMany.mock.calls[1][0];
            expect(teamQueryArgs.where).toEqual({
                OR: [
                    { organizationId: supplierOrgId },
                    { fiEngagement: { fiOrgId: supplierOrgId, isDeleted: false } }
                ]
            });

            const inviteQueryArgs = prismaMock.invitation.findMany.mock.calls[0][0];
            expect(inviteQueryArgs.where.OR).toEqual([
                { organizationId: supplierOrgId },
                { fiEngagement: { fiOrgId: supplierOrgId, isDeleted: false } }
            ]);
        });

        it("2. pure ORG_MEMBER -> no Relationship Team or invitation metadata (zero child queries)", async () => {
            prismaMock.membership.findMany.mockResolvedValueOnce([
                { organizationId: supplierOrgId, fiEngagementId: null, fiEngagement: null, role: "ORG_MEMBER" }
            ]);

            const result = await getSupplierTeamMembers(supplierOrgId);
            expect(result.members).toEqual([]);
            expect(result.pendingInvitations).toEqual([]);

            // Only caller's own membership check was performed; team and invitation queries were NOT executed
            expect(prismaMock.membership.findMany).toHaveBeenCalledTimes(1);
            expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
        });

        it("3. Alpha-only Relationship user -> queries Alpha Team/invites only, never Beta", async () => {
            const alphaEngId = "eng-alpha";

            // Calling user is assigned strictly to Alpha relationship
            prismaMock.membership.findMany
                .mockResolvedValueOnce([
                    {
                        organizationId: null,
                        fiEngagementId: alphaEngId,
                        role: "RELATIONSHIP_USER",
                        fiEngagement: { fiOrgId: supplierOrgId }
                    }
                ])
                // Team memberships query scoped to Alpha
                .mockResolvedValueOnce([
                    {
                        organizationId: null,
                        role: "RELATIONSHIP_USER",
                        createdAt: new Date("2026-02-01"),
                        user: { id: "alpha-worker", name: "Alpha Worker", email: "alpha@riskbridge.com" },
                        fiEngagement: {
                            id: alphaEngId,
                            clientLE: { name: "Alpha Client LE" }
                        }
                    }
                ]);

            prismaMock.invitation.findMany.mockResolvedValueOnce([
                {
                    id: "inv-alpha",
                    sentToEmail: "new-alpha@riskbridge.com",
                    role: "RELATIONSHIP_USER",
                    createdAt: new Date("2026-03-01"),
                    expiresAt: new Date("2026-04-01"),
                    fiEngagementId: alphaEngId,
                    fiEngagement: { clientLE: { name: "Alpha Client LE" } }
                }
            ]);

            const result = await getSupplierTeamMembers(supplierOrgId);

            // Verify membership query was strictly scoped to Alpha engagement
            const teamQueryArgs = prismaMock.membership.findMany.mock.calls[1][0];
            expect(teamQueryArgs.where).toEqual({
                fiEngagementId: { in: [alphaEngId] },
                fiEngagement: { isDeleted: false }
            });

            // Verify invitation query was strictly scoped to Alpha engagement
            const inviteQueryArgs = prismaMock.invitation.findMany.mock.calls[0][0];
            expect(inviteQueryArgs.where.fiEngagementId).toEqual({ in: [alphaEngId] });
            expect(inviteQueryArgs.where.fiEngagement).toEqual({ isDeleted: false });

            // Verify returned content contains Alpha only
            expect(result.members).toHaveLength(1);
            expect(result.members[0].email).toBe("alpha@riskbridge.com");
            expect(result.pendingInvitations).toHaveLength(1);
            expect(result.pendingInvitations[0].email).toBe("new-alpha@riskbridge.com");
        });
    });
});
