/**
 * @vitest-environment happy-dom
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import ResponsiveHomeLabPage from "../page";
import { getUserContexts, DashboardContexts } from "@/actions/dashboard";
import { getAuthenticatedPendingInvitations } from "@/actions/invitations";

// Mock server actions
vi.mock("@/actions/dashboard", () => ({
    getUserContexts: vi.fn(),
}));

vi.mock("@/actions/invitations", () => ({
    getAuthenticatedPendingInvitations: vi.fn(),
}));

// Mock child components to verify exact prop hand-off
const mockHomeResponsiveContent = vi.fn((props: any) => (
    <div data-testid="mock-home-responsive-content">
        Mock Responsive Content (Client count: {props.contexts?.clients?.length ?? 0})
    </div>
));

vi.mock("@/components/dashboard/labs/home-responsive-content", () => ({
    HomeResponsiveContent: (props: any) => mockHomeResponsiveContent(props),
}));

vi.mock("@/components/dashboard/pending-invitations-banner", () => ({
    PendingInvitationsBanner: (props: any) => (
        <div data-testid="mock-pending-invitations-banner">
            Pending Invitations: {props.invitations?.length}
        </div>
    ),
}));

vi.mock("@/components/layout/StandardPageHeader", () => ({
    StandardPageHeader: (props: any) => (
        <header data-testid="standard-page-header">
            <span data-testid="header-type-label">{props.typeLabel}</span>
            <h1 data-testid="header-title">{props.title}</h1>
            <p data-testid="header-subtitle">{props.subtitle}</p>
        </header>
    ),
}));

const sampleContexts: DashboardContexts = {
    clients: [
        {
            id: "client-alpha",
            name: "Alpha Corp",
            role: "LE_ADMIN",
            source: "DIRECT",
            metrics: { total: 10, noData: 0, mapped: 10, answered: 10, approved: 5, released: 5 },
            v2Metrics: { questionnairesCount: 1, total: 10, external: 5, userInput: 5, defaultResponse: 0, unanswered: 0 },
        },
    ],
    financialInstitutions: [],
    lawFirms: [],
    legalEntities: [],
    relationships: [],
};

describe("Responsive Home Lab Page (/app/labs/home-responsive)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getUserContexts).mockResolvedValue(sampleContexts);
        vi.mocked(getAuthenticatedPendingInvitations).mockResolvedValue([]);
    });

    afterEach(() => {
        cleanup();
    });

    it("A. Renders HomeResponsiveContent rather than ExperimentalDashboardContent directly", async () => {
        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        expect(mockHomeResponsiveContent).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("mock-home-responsive-content")).toBeDefined();
    });

    it("Uses getUserContexts() as its primary data pipeline rather than introducing another data source", async () => {
        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        expect(getUserContexts).toHaveBeenCalledTimes(1);
        expect(getAuthenticatedPendingInvitations).toHaveBeenCalledTimes(1);
    });

    it("B. Allows ordinary authenticated/non-SYSTEM_ADMIN users to render the page without rejection or redirect", async () => {
        // Calling page directly succeeds with JSX and does not throw any unauthorized error or redirect
        const pageElement = await ResponsiveHomeLabPage();
        expect(pageElement).toBeDefined();

        render(pageElement);
        expect(screen.getByTestId("standard-page-header")).toBeDefined();
        expect(screen.getByTestId("mock-home-responsive-content")).toBeDefined();
    });

    it("C. Supplies exact DashboardContexts to HomeResponsiveContent renderer", async () => {
        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        expect(mockHomeResponsiveContent).toHaveBeenCalledTimes(1);
        const passedProps = mockHomeResponsiveContent.mock.calls[0][0];
        expect(passedProps.contexts).toEqual(sampleContexts);
        expect(screen.getByText(/Client count: 1/)).toBeDefined();
    });

    it("D. Confirms no SYSTEM_ADMIN-only gate or check is present", async () => {
        // Resolves cleanly without importing or enforcing isSystemAdmin
        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        // Header actions (where HomeVariantSwitcher is placed for admins on /app) is not rendered
        expect(screen.queryByTestId("home-variant-switcher")).toBeNull();
    });

    it("renders the responsive-home page shell with fluid container width and no redundant nested horizontal padding", async () => {
        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        const homeRoot = screen.getByTestId("responsive-home");
        expect(homeRoot).toBeDefined();

        // The content wrapper has w-full and max-w-7xl without px-6 (which would duplicate platform p-4/md:p-8)
        const contentWrapper = homeRoot.querySelector(".max-w-7xl");
        expect(contentWrapper).toBeDefined();
        expect(contentWrapper?.className).toContain("w-full");
        expect(contentWrapper?.className).not.toContain("px-6");
    });

    it("renders the unobtrusive 'Responsive Home Lab' identifier in the header", async () => {
        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        expect(screen.getByTestId("header-type-label").textContent).toBe("Responsive Home Lab");
        expect(screen.getByTestId("header-title").textContent).toBe("Relationships");
    });

    it("renders pending invitations banner when invitations exist", async () => {
        vi.mocked(getAuthenticatedPendingInvitations).mockResolvedValue([
            { id: "inv-1", organizationName: "Test Org", role: "MEMBER" } as any,
        ]);

        const pageElement = await ResponsiveHomeLabPage();
        render(pageElement);

        expect(screen.getByTestId("mock-pending-invitations-banner")).toBeDefined();
        expect(screen.getByText("Pending Invitations: 1")).toBeDefined();
    });
});
