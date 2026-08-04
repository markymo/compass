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
        // User memberships check (calling user belongs to supplierOrgId)
        prismaMock.membership.findMany
            .mockResolvedValueOnce([
                { organizationId: supplierOrgId, fiEngagement: null }
            ])
            // Team memberships query
            .mockResolvedValueOnce([
                {
                    organizationId: supplierOrgId,
                    role: "SUPPLIER_ADMIN",
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
                { organizationId: supplierOrgId, fiEngagement: null }
            ])
            .mockResolvedValueOnce([
                {
                    organizationId: supplierOrgId,
                    role: "SUPPLIER_ADMIN",
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
                { organizationId: supplierOrgId, fiEngagement: null }
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
});
