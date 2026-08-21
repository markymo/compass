import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFIEngagement } from "../client-le";
import { getIdentity } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
    getIdentity: vi.fn(),
    ensureAuthorization: vi.fn(),
    Action: {},
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
    const mockObj = {
        organization: {
            findUnique: vi.fn(),
        },
        fIEngagement: {
            findUnique: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
    };
    return {
        default: mockObj,
        prisma: mockObj,
    };
});

import { prisma } from "@/lib/prisma";

describe("createFIEngagement Server Action Contract & Duplicate Protection", () => {
    const mockUserId = "user-123";
    const mockClientLEId = "cle-999";
    const mockFiOrgId = "org-fi-1";

    beforeEach(() => {
        vi.clearAllMocks();
        (getIdentity as any).mockResolvedValue({ userId: mockUserId, email: "user@example.com" });
    });

    it("1. Returns error if organization does not exist by fiOrgId", async () => {
        (prisma.organization.findUnique as any).mockResolvedValue(null);

        const result = await createFIEngagement(mockClientLEId, "non-existent-id");
        expect(result).toEqual({ success: false, error: "Organization not found" });
        expect(prisma.fIEngagement.create).not.toHaveBeenCalled();
    });

    it("2. Returns error if organization is not of type FI", async () => {
        (prisma.organization.findUnique as any).mockResolvedValue({
            id: mockFiOrgId,
            name: "Law Firm Org",
            types: ["LAW_FIRM"],
        });

        const result = await createFIEngagement(mockClientLEId, mockFiOrgId);
        expect(result).toEqual({ success: false, error: "Selected organization is not a financial institution" });
        expect(prisma.fIEngagement.create).not.toHaveBeenCalled();
    });

    it("3. Creates a new engagement if no relationship exists for [fiOrgId, clientLEId]", async () => {
        (prisma.organization.findUnique as any).mockResolvedValue({
            id: mockFiOrgId,
            name: "Barclays Bank PLC",
            types: ["FI"],
        });
        (prisma.fIEngagement.findUnique as any).mockResolvedValue(null);
        (prisma.fIEngagement.create as any).mockResolvedValue({
            id: "eng-new",
            clientLEId: mockClientLEId,
            fiOrgId: mockFiOrgId,
            status: "PREPARATION",
            org: { id: mockFiOrgId, name: "Barclays Bank PLC" },
        });

        const result = await createFIEngagement(mockClientLEId, mockFiOrgId);
        expect(result.success).toBe(true);
        expect(result.actionType).toBe("CREATED");
        expect(prisma.fIEngagement.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                clientLEId: mockClientLEId,
                fiOrgId: mockFiOrgId,
            }),
        }));
    });

    it("4. Restores existing soft-deleted engagement (isDeleted: true) preserving existing engagement ID", async () => {
        (prisma.organization.findUnique as any).mockResolvedValue({
            id: mockFiOrgId,
            name: "Barclays Bank PLC",
            types: ["FI"],
        });
        (prisma.fIEngagement.findUnique as any).mockResolvedValue({
            id: "eng-existing-deleted",
            clientLEId: mockClientLEId,
            fiOrgId: mockFiOrgId,
            isDeleted: true,
            status: "PREPARATION",
        });
        (prisma.fIEngagement.update as any).mockResolvedValue({
            id: "eng-existing-deleted",
            clientLEId: mockClientLEId,
            fiOrgId: mockFiOrgId,
            isDeleted: false,
            status: "INVITED",
            org: { id: mockFiOrgId, name: "Barclays Bank PLC" },
        });

        const result = await createFIEngagement(mockClientLEId, mockFiOrgId);
        expect(result.success).toBe(true);
        expect(result.actionType).toBe("RESTORED");
        expect(result.engagement.id).toBe("eng-existing-deleted");
        expect(prisma.fIEngagement.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "eng-existing-deleted" },
            data: { isDeleted: false, status: "INVITED" },
        }));
    });

    it("5. Returns ALREADY_EXISTS status when relationship is already active", async () => {
        (prisma.organization.findUnique as any).mockResolvedValue({
            id: mockFiOrgId,
            name: "Barclays Bank PLC",
            types: ["FI"],
        });
        (prisma.fIEngagement.findUnique as any).mockResolvedValue({
            id: "eng-active",
            clientLEId: mockClientLEId,
            fiOrgId: mockFiOrgId,
            isDeleted: false,
            status: "CONNECTED",
        });

        const result = await createFIEngagement(mockClientLEId, mockFiOrgId);
        expect(result.success).toBe(true);
        expect(result.actionType).toBe("ALREADY_EXISTS");
        expect(prisma.fIEngagement.create).not.toHaveBeenCalled();
        expect(prisma.fIEngagement.update).not.toHaveBeenCalled();
    });
});
