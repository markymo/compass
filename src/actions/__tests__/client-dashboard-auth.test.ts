import { describe, it, expect, vi, beforeEach } from "vitest";
import { getClientDashboardData } from "../client";
import prisma from "@/lib/prisma";
import { getIdentity } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
    default: {
        membership: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
        clientLE: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn(),
}));

describe("ONP-23 — Supplier Client Navigation Authorization Isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. Rejects unauthenticated requests with Unauthorized error", async () => {
        vi.mocked(getIdentity).mockResolvedValue(null);

        const result = await getClientDashboardData("client-org-123");
        expect(result).toEqual({ success: false, error: "Unauthorized" });
    });

    it("2. Denies supplier user without client org membership from accessing client dashboard", async () => {
        // Supplier persona: user has membership only in FI org, not in the target Client Org
        vi.mocked(getIdentity).mockResolvedValue({
            userId: "supplier-user-1",
            email: "supplier@bank.example.com",
            role: "SUPPLIER_ADMIN"
        } as any);

        // Membership lookup for target client organization returns null
        vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);
        // Direct LE-level membership for that client's LEs also returns none
        vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

        const result = await getClientDashboardData("client-org-123");

        // Asserts that client organization privacy is strictly preserved
        expect(result).toEqual({ success: false, error: "Unauthorized" });
        expect(prisma.membership.findFirst).toHaveBeenCalledWith({
            where: {
                userId: "supplier-user-1",
                organizationId: "client-org-123",
            },
            include: { organization: true },
        });
    });

    it("3. Allows authorized client org admin to access client dashboard", async () => {
        vi.mocked(getIdentity).mockResolvedValue({
            userId: "client-admin-1",
            email: "admin@acme.example.com",
            role: "CLIENT_ADMIN"
        } as any);

        vi.mocked(prisma.membership.findFirst).mockResolvedValue({
            id: "mem-1",
            userId: "client-admin-1",
            organizationId: "client-org-123",
            role: "ORG_ADMIN",
            organization: {
                id: "client-org-123",
                name: "Acme Corp",
                status: "ACTIVE",
            },
        } as any);

        vi.mocked(prisma.clientLE.findMany).mockResolvedValue([
            {
                id: "le-1",
                name: "Acme UK Ltd",
                isDeleted: false,
                fIEngagements: [],
            } as any,
        ]);

        const result = await getClientDashboardData("client-org-123");

        expect(result.success).toBe(true);
        expect((result as any).data.org.name).toBe("Acme Corp");
        expect((result as any).data.permissions.canViewAllLEs).toBe(true);
    });
});
