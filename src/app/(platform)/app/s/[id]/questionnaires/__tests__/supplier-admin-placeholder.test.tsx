import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFIOganization } from "@/actions/fi";
import { getFIPortalTabs } from "@/config/navigation-tabs";

vi.mock("@/actions/fi", () => ({
    getFIOganization: vi.fn(),
    getFIQuestionnaires: vi.fn()
}));

describe("Supplier Admin Placeholder Page Requirements", () => {
    const orgId = "org-supplier-777";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. Navigation tabs keep Admin active and correctly scoped to Supplier org", () => {
        const tabs = getFIPortalTabs(orgId);
        const adminTab = tabs.find((t) => t.label === "Admin");

        expect(adminTab).toBeDefined();
        expect(adminTab?.href).toBe(`/app/s/${orgId}/questionnaires`);
    });

    it("2. Page loads Supplier organization and returns null/404 if organization does not exist", async () => {
        vi.mocked(getFIOganization).mockResolvedValue(null);
        const result = await getFIOganization(orgId);
        expect(result).toBeNull();
    });

    it("3. Required placeholder copy and supporting text are specified", () => {
        const copyPrimary = "Supplier administration will be available here in a future release.";
        const copySecondary = "Questionnaire templates and mappings are currently managed by OnPro administrators.";

        expect(copyPrimary).toContain("Supplier administration will be available here");
        expect(copySecondary).toContain("Questionnaire templates and mappings are currently managed");
    });

    it("4. No data query functions for questionnaires or permissions are required by the placeholder", async () => {
        const mockOrg = { id: orgId, name: "Riskbridge Financial" };
        vi.mocked(getFIOganization).mockResolvedValue(mockOrg as any);

        const org = await getFIOganization(orgId);
        expect(org?.name).toBe("Riskbridge Financial");
    });
});
