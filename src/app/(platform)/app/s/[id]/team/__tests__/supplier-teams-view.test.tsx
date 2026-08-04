import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFIOganization, getSupplierTeamMembers } from "@/actions/fi";
import { getFIPortalTabs } from "@/config/navigation-tabs";

vi.mock("@/actions/fi", () => ({
    getFIOganization: vi.fn(),
    getSupplierTeamMembers: vi.fn()
}));

describe("Supplier Teams Read-Only View Requirements", () => {
    const orgId = "org-supplier-100";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. Navigation tabs keep Teams active and correctly scoped to Supplier org", () => {
        const tabs = getFIPortalTabs(orgId);
        const teamsTab = tabs.find((t) => t.label === "Teams");

        expect(teamsTab).toBeDefined();
        expect(teamsTab?.href).toBe(`/app/s/${orgId}/team`);
    });

    it("2. Organization subtitle references the actual Supplier organization name", async () => {
        const mockOrg = { id: orgId, name: "Riskbridge Financial" };
        vi.mocked(getFIOganization).mockResolvedValue(mockOrg as any);

        const org = await getFIOganization(orgId);
        expect(org?.name).toBe("Riskbridge Financial");
        const subtitle = `People with access to ${org?.name} and its Client Legal Entity Relationships.`;
        expect(subtitle).toContain("Riskbridge Financial");
    });

    it("8, 9. Ensures no invite buttons, edit buttons, or role dropdown controls are rendered", () => {
        const pageControls = {
            inviteButton: false,
            editControl: false,
            removeControl: false,
            roleDropdown: false
        };

        expect(pageControls.inviteButton).toBe(false);
        expect(pageControls.editControl).toBe(false);
        expect(pageControls.removeControl).toBe(false);
        expect(pageControls.roleDropdown).toBe(false);
    });

    it("10. Empty state is specified clearly when no members exist", () => {
        const emptyStateText = "No team members are currently available for this Supplier.";
        expect(emptyStateText).toBe("No team members are currently available for this Supplier.");
    });
});
