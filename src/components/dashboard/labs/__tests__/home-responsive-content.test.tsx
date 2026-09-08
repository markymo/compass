/**
 * @vitest-environment happy-dom
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, within } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { HomeResponsiveContent } from "../home-responsive-content";
import { HomeResponsiveMetricSummary } from "../home-responsive-metric-summary";
import { DashboardContexts } from "@/actions/dashboard";
import { QuestionStateMetrics, emptyQuestionStateMetrics } from "@/lib/metrics/question-state-types";

// Mock user preferences provider
vi.mock("@/components/providers/user-preferences-provider", () => ({
    usePreferences: () => ({
        isLoading: false,
        preferences: {},
        updatePreference: vi.fn(),
    }),
}));

const mockV2Metrics: QuestionStateMetrics = {
    questionnairesCount: 4,
    total: 147,
    external: 83,
    userInput: 41,
    defaultResponse: 0,
    unanswered: 23,
};

const mockClientContexts: DashboardContexts = {
    clients: [
        {
            id: "client-1",
            name: "Acme Client Corp",
            role: "CLIENT_ADMIN",
            source: "DIRECT",
            metrics: {
                total: 147,
                noData: 23,
                mapped: 124,
                answered: 124,
                approved: 50,
                released: 30,
            },
            v2Metrics: mockV2Metrics,
        },
    ],
    financialInstitutions: [],
    lawFirms: [],
    legalEntities: [
        {
            id: "le-1",
            name: "Acme Operating Ltd",
            clientName: "Acme Client Corp",
            role: "LE_ADMIN",
            metrics: {
                total: 147,
                noData: 23,
                mapped: 124,
                answered: 124,
                approved: 50,
                released: 30,
            },
            v2Metrics: mockV2Metrics,
            commonQuestionnaires: [
                {
                    id: "cq-1",
                    name: "KYC Master Profile",
                    status: "ACTIVE",
                    updatedAt: new Date("2026-08-01"),
                    metrics: {
                        total: 50,
                        noData: 5,
                        mapped: 45,
                        answered: 45,
                        approved: 20,
                        released: 10,
                    },
                    v2Metrics: {
                        questionnairesCount: 1,
                        total: 50,
                        external: 30,
                        userInput: 15,
                        defaultResponse: 0,
                        unanswered: 5,
                    },
                },
            ],
        },
    ],
    relationships: [],
};

const mockSupplierContexts: DashboardContexts = {
    clients: [],
    financialInstitutions: [
        {
            id: "fi-1",
            name: "Riskbridge Bank",
            role: "SUPPLIER_ADMIN",
            metrics: { total: 10, noData: 0, mapped: 10, answered: 10, approved: 10, released: 10 },
            v2Metrics: { questionnairesCount: 1, total: 10, external: 10, userInput: 0, defaultResponse: 0, unanswered: 0 },
        },
    ],
    lawFirms: [],
    legalEntities: [],
    relationships: [
        {
            id: "rel-1",
            fiOrgId: "fi-1",
            clientId: "client-party-99",
            clientName: "Global Trade Corp",
            leName: "Global Trade UK Ltd",
            clientLEId: "le-trade-1",
            supplierName: "Riskbridge Bank",
            status: "ACTIVE",
            userIsClient: false,
            userIsSupplier: true,
            metrics: { total: 10, noData: 0, mapped: 10, answered: 10, approved: 10, released: 10 },
            v2Metrics: { questionnairesCount: 1, total: 10, external: 10, userInput: 0, defaultResponse: 0, unanswered: 0 },
            questionnaires: [
                { id: "q-1", name: "Standard Due Diligence", status: "SHARED", updatedAt: new Date("2026-08-15") },
            ],
        },
    ],
};

describe("HomeResponsiveContent Component (Labs Dedicated Renderer)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("B. Consumes supplied DashboardContexts and renders reshaped tree data without separate data fetching", () => {
        render(<HomeResponsiveContent contexts={mockClientContexts} />);

        // Finds the dedicated lab dashboard container
        expect(screen.getByTestId("home-responsive-dashboard")).toBeDefined();
        // Renders organization name from contexts
        expect(screen.getByText("Acme Client Corp")).toBeDefined();
    });

    it("B2. Establishes intended container-query boundaries on dashboard and organisation cards", () => {
        render(<HomeResponsiveContent contexts={mockClientContexts} />);

        const dashboardRoot = screen.getByTestId("home-responsive-dashboard");
        expect(dashboardRoot.className).toContain("@container/dashboard");

        const orgCard = screen.getByTestId("responsive-org-card");
        expect(orgCard.className).toContain("@container/org-card");
    });

    it("C. Renders representative Client data: organisation, LE, Common Questionnaires, and metrics", () => {
        render(<HomeResponsiveContent contexts={mockClientContexts} />);

        // Organisation name & role
        expect(screen.getByText("Acme Client Corp")).toBeDefined();
        expect(screen.getByText("CLIENT_ADMIN")).toBeDefined();

        // Legal entity name
        expect(screen.getByText("Acme Operating Ltd")).toBeDefined();

        // Common Questionnaires group label (without exposing individual CQ names)
        expect(screen.getByText("Common Questionnaires")).toBeDefined();
        expect(screen.queryByText("KYC Master Profile")).toBeNull();

        // Metric values
        expect(screen.getAllByText("147").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("83").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("41").length).toBeGreaterThanOrEqual(1);

        // Semantic test hooks
        expect(screen.getAllByTestId("responsive-tree-row").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByTestId("responsive-metrics").length).toBeGreaterThanOrEqual(1);
    });

    it("D. Renders representative Supplier data safely", () => {
        render(<HomeResponsiveContent contexts={mockSupplierContexts} />);

        expect(screen.getByText("Riskbridge Bank")).toBeDefined();
        expect(screen.getByText("SUPPLIER_ADMIN")).toBeDefined();
        expect(screen.getByText("Global Trade Corp")).toBeDefined();
        expect(screen.getByText("Global Trade UK Ltd")).toBeDefined();
    });

    describe("E. Navigation and Security Rules Preservation", () => {
        it("Supplier-side Client grouping must not render unauthorised /app/clients/... links", () => {
            render(<HomeResponsiveContent contexts={mockSupplierContexts} />);

            // Client group node under supplier org must be static text, not a link to /app/clients/[id]
            expect(screen.queryByRole("link", { name: "Global Trade Corp" })).toBeNull();
            expect(screen.getByText("Global Trade Corp")).toBeDefined();
        });

        it("Structural/non-operational Client LEs must not gain operational links", () => {
            const structuralLEContexts: DashboardContexts = {
                clients: [{ id: "c1", name: "Alpha Holding", role: "ORG_ADMIN", source: "DIRECT", metrics: { total: 0, noData: 0, mapped: 0, answered: 0, approved: 0, released: 0 } }],
                financialInstitutions: [],
                lawFirms: [],
                legalEntities: [{
                    id: "le-structural",
                    name: "Alpha Subs Ltd",
                    clientName: "Alpha Holding",
                    role: "ADMIN_VISIBILITY", // Structural only
                    metrics: { total: 0, noData: 0, mapped: 0, answered: 0, approved: 0, released: 0 },
                }],
                relationships: [],
            };

            render(<HomeResponsiveContent contexts={structuralLEContexts} />);

            // Structural LE has role ADMIN_VISIBILITY and href='#' so it shouldn't have an active operational href
            const leElement = screen.getByText("Alpha Subs Ltd");
            expect(leElement).toBeDefined();
            expect(screen.queryByRole("link", { name: "Alpha Subs Ltd" })).toBeNull();
        });

        it("Client organization name in section header links to /app/clients/[id]", () => {
            render(<HomeResponsiveContent contexts={mockClientContexts} />);

            const orgLink = screen.getByRole("link", { name: "Acme Client Corp" });
            expect(orgLink).toBeDefined();
            expect(orgLink.getAttribute("href")).toBe("/app/clients/client-1");
        });

        it("Supplier organization name in section header links to /app/s/[id]", () => {
            render(<HomeResponsiveContent contexts={mockSupplierContexts} />);

            const supplierLink = screen.getByRole("link", { name: "Riskbridge Bank" });
            expect(supplierLink).toBeDefined();
            expect(supplierLink.getAttribute("href")).toBe("/app/s/fi-1");
        });
    });

    describe("Architectural Constraints & Container Query Architecture", () => {
        it("F-contract: Confirms no JS/device detection (window.innerWidth, matchMedia, resize listener, isMobile) exists in lab components", () => {
            const contentPath = path.resolve(__dirname, "../home-responsive-content.tsx");
            const contentFile = fs.readFileSync(contentPath, "utf-8");

            const summaryPath = path.resolve(__dirname, "../home-responsive-metric-summary.tsx");
            const summaryFile = fs.readFileSync(summaryPath, "utf-8");

            for (const fileContent of [contentFile, summaryFile]) {
                expect(fileContent).not.toContain("window.innerWidth");
                expect(fileContent).not.toContain("window.matchMedia");
                expect(fileContent).not.toContain("addEventListener('resize'");
                expect(fileContent).not.toContain('addEventListener("resize"');
                expect(fileContent).not.toContain("isMobile");
                expect(fileContent).not.toContain("useMediaQuery");
            }
        });

        it("F2-contract: Confirms container query classes govern wide, medium, and narrow responsive compositions", () => {
            render(<HomeResponsiveMetricSummary metrics={mockV2Metrics} />);

            const wideBlock = screen.getByTestId("responsive-metrics-wide");
            expect(wideBlock.className).toContain("hidden");
            expect(wideBlock.className).toContain("@[820px]:grid");

            const mediumBlock = screen.getByTestId("responsive-metrics-medium");
            expect(mediumBlock.className).toContain("hidden");
            expect(mediumBlock.className).toContain("@[600px]:flex");
            expect(mediumBlock.className).toContain("@[820px]:hidden");

            const narrowBlock = screen.getByTestId("responsive-metrics-narrow");
            expect(narrowBlock.className).toContain("flex");
            expect(narrowBlock.className).toContain("@[600px]:hidden");
        });

        it("D-contract: Confirms no horizontal-scroll wrapper has been introduced around metrics", () => {
            render(<HomeResponsiveContent contexts={mockClientContexts} />);

            const metricsBlocks = screen.getAllByTestId("responsive-metrics");
            expect(metricsBlocks.length).toBeGreaterThanOrEqual(1);

            for (const mb of metricsBlocks) {
                // Ensure neither the metric container nor its immediate parent uses horizontal scroll classes
                expect(mb.className).not.toContain("overflow-x-auto");
                expect(mb.className).not.toContain("overflow-x-scroll");
                const parent = mb.parentElement;
                if (parent) {
                    expect(parent.className).not.toContain("overflow-x-auto");
                    expect(parent.className).not.toContain("overflow-x-scroll");
                }
            }
        });
    });

    describe("HomeResponsiveMetricSummary Component: Wide, Medium, and Narrow Compositions", () => {
        it("A. Wide metric renderer preserves the five canonical metric values and header labels", () => {
            render(<HomeResponsiveContent contexts={mockClientContexts} />);

            // Verify desktop 2-tier header has container query classes and canonical column titles
            const headerMetrics = screen.getByTestId("responsive-org-header-metrics");
            expect(headerMetrics.className).toContain("hidden");
            expect(headerMetrics.className).toContain("@[820px]:flex");
            expect(within(headerMetrics).getByText("Questions")).toBeDefined();
            expect(within(headerMetrics).getByText("Answers")).toBeDefined();
            expect(within(headerMetrics).getByText("Total")).toBeDefined();
            expect(within(headerMetrics).getByText("External")).toBeDefined();
            expect(within(headerMetrics).getByText("User Input")).toBeDefined();
            expect(within(headerMetrics).getByText("Default")).toBeDefined();
            expect(within(headerMetrics).getByText("Unanswered")).toBeDefined();

            // Verify wide metric summary block retains the 5-column grid layout and all 5 values
            const wideBlocks = screen.getAllByTestId("responsive-metrics-wide");
            expect(wideBlocks.length).toBeGreaterThanOrEqual(1);
            const firstWideBlock = wideBlocks[0];
            expect(firstWideBlock.className).toContain("grid-cols-[80px_80px_80px_75px_85px]");
            expect(within(firstWideBlock).getByText("147")).toBeDefined();
            expect(within(firstWideBlock).getByText("83")).toBeDefined();
            expect(within(firstWideBlock).getByText("41")).toBeDefined();
            expect(within(firstWideBlock).getByText("23")).toBeDefined();
        });

        it("B. Medium metric renderer exposes Total Questions, Unanswered, External, User Input, and Default with self-labelling", () => {
            render(<HomeResponsiveMetricSummary metrics={mockV2Metrics} />);

            const mediumBlock = screen.getByTestId("responsive-metrics-medium");
            expect(mediumBlock).toBeDefined();

            // Primary Level: Total Questions & Unanswered
            expect(within(mediumBlock).getByText("147")).toBeDefined();
            expect(within(mediumBlock).getByText("questions")).toBeDefined();
            expect(within(mediumBlock).getByText("total questions")).toBeDefined();

            expect(within(mediumBlock).getByText("23")).toBeDefined();
            expect(within(mediumBlock).getByText("unanswered")).toBeDefined();

            // Secondary Level: External · User Input · Default
            expect(within(mediumBlock).getByText("83")).toBeDefined();
            expect(within(mediumBlock).getByText("external")).toBeDefined();

            expect(within(mediumBlock).getByText("41")).toBeDefined();
            expect(within(mediumBlock).getByText("user")).toBeDefined();
            expect(within(mediumBlock).getByText("user input")).toBeDefined();

            expect(within(mediumBlock).getByText("0")).toBeDefined();
            expect(within(mediumBlock).getByText("default")).toBeDefined();
        });

        it("B2. Narrow metric renderer exposes all five semantic metrics with stacked self-labelling", () => {
            render(<HomeResponsiveMetricSummary metrics={mockV2Metrics} />);

            const narrowBlock = screen.getByTestId("responsive-metrics-narrow");
            expect(narrowBlock).toBeDefined();

            // Primary Level: Total Questions · Unanswered
            expect(within(narrowBlock).getByText("147")).toBeDefined();
            expect(within(narrowBlock).getByText("questions")).toBeDefined();
            expect(within(narrowBlock).getByText("total questions")).toBeDefined();

            expect(within(narrowBlock).getByText("23")).toBeDefined();
            expect(within(narrowBlock).getByText("unanswered")).toBeDefined();

            // Secondary Level: External · User Input · Default
            expect(within(narrowBlock).getByText("83")).toBeDefined();
            expect(within(narrowBlock).getByText("external")).toBeDefined();

            expect(within(narrowBlock).getByText("41")).toBeDefined();
            expect(within(narrowBlock).getByText("user")).toBeDefined();
            expect(within(narrowBlock).getByText("user input")).toBeDefined();

            expect(within(narrowBlock).getByText("0")).toBeDefined();
            expect(within(narrowBlock).getByText("default")).toBeDefined();
        });

        it("C. Exact drill-down hrefs remain correct in wide, medium, and narrow renderers", () => {
            render(
                <HomeResponsiveMetricSummary
                    metrics={mockV2Metrics}
                    linkContext={{ leId: "le-123", scope: "common" }}
                />
            );

            // Wide links
            const wideExternal = screen.getByTestId("metric-link-external");
            expect(wideExternal.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(wideExternal.getAttribute("href")).toContain("scope=common");
            expect(wideExternal.getAttribute("href")).toContain("answerState=external");

            // Medium links
            const mediumTotal = screen.getByTestId("metric-medium-link-total");
            expect(mediumTotal.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(mediumTotal.getAttribute("href")).toContain("scope=common");

            const mediumExternal = screen.getByTestId("metric-medium-link-external");
            expect(mediumExternal.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(mediumExternal.getAttribute("href")).toContain("scope=common");
            expect(mediumExternal.getAttribute("href")).toContain("answerState=external");

            const mediumUserInput = screen.getByTestId("metric-medium-link-user_input");
            expect(mediumUserInput.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(mediumUserInput.getAttribute("href")).toContain("scope=common");
            expect(mediumUserInput.getAttribute("href")).toContain("answerState=user_input");

            const mediumDefault = screen.getByTestId("metric-medium-link-default_response");
            expect(mediumDefault.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(mediumDefault.getAttribute("href")).toContain("scope=common");
            expect(mediumDefault.getAttribute("href")).toContain("answerState=default_response");

            const mediumUnanswered = screen.getByTestId("metric-medium-link-unanswered");
            expect(mediumUnanswered.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(mediumUnanswered.getAttribute("href")).toContain("scope=common");
            expect(mediumUnanswered.getAttribute("href")).toContain("answerState=unanswered");

            // Narrow links
            const narrowTotal = screen.getByTestId("metric-narrow-link-total");
            expect(narrowTotal.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(narrowTotal.getAttribute("href")).toContain("scope=common");

            const narrowExternal = screen.getByTestId("metric-narrow-link-external");
            expect(narrowExternal.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(narrowExternal.getAttribute("href")).toContain("scope=common");
            expect(narrowExternal.getAttribute("href")).toContain("answerState=external");

            const narrowUserInput = screen.getByTestId("metric-narrow-link-user_input");
            expect(narrowUserInput.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(narrowUserInput.getAttribute("href")).toContain("scope=common");
            expect(narrowUserInput.getAttribute("href")).toContain("answerState=user_input");

            const narrowDefault = screen.getByTestId("metric-narrow-link-default_response");
            expect(narrowDefault.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(narrowDefault.getAttribute("href")).toContain("scope=common");
            expect(narrowDefault.getAttribute("href")).toContain("answerState=default_response");

            const narrowUnanswered = screen.getByTestId("metric-narrow-link-unanswered");
            expect(narrowUnanswered.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(narrowUnanswered.getAttribute("href")).toContain("scope=common");
            expect(narrowUnanswered.getAttribute("href")).toContain("answerState=unanswered");
        });

        it("C2. Supplier drill-down links remain correct across wide, medium, and narrow renderers", () => {
            render(
                <HomeResponsiveMetricSummary
                    metrics={mockV2Metrics}
                    linkContext={{ supplierOrgId: "fi-123", supplierRelName: "Acme", questionnaireId: "q-1" }}
                />
            );

            const wideUnanswered = screen.getByTestId("metric-link-unanswered");
            expect(wideUnanswered.getAttribute("href")).toContain("/app/s/fi-123/questions");
            expect(wideUnanswered.getAttribute("href")).toContain("status=UNANSWERED");
            expect(wideUnanswered.getAttribute("href")).toContain("rel=Acme");
            expect(wideUnanswered.getAttribute("href")).toContain("q=q-1");

            const mediumUnanswered = screen.getByTestId("metric-medium-link-unanswered");
            expect(mediumUnanswered.getAttribute("href")).toContain("/app/s/fi-123/questions");
            expect(mediumUnanswered.getAttribute("href")).toContain("status=UNANSWERED");
            expect(mediumUnanswered.getAttribute("href")).toContain("rel=Acme");
            expect(mediumUnanswered.getAttribute("href")).toContain("q=q-1");

            const narrowUnanswered = screen.getByTestId("metric-narrow-link-unanswered");
            expect(narrowUnanswered.getAttribute("href")).toContain("/app/s/fi-123/questions");
            expect(narrowUnanswered.getAttribute("href")).toContain("status=UNANSWERED");
            expect(narrowUnanswered.getAttribute("href")).toContain("rel=Acme");
            expect(narrowUnanswered.getAttribute("href")).toContain("q=q-1");
        });

        it("D. Zero-population behaviour: renders blank '-' in wide (5 columns), medium (1 dash), and narrow (1 dash)", () => {
            render(<HomeResponsiveMetricSummary metrics={emptyQuestionStateMetrics()} />);

            const wideContainer = screen.getByTestId("responsive-metrics-wide");
            const mediumContainer = screen.getByTestId("responsive-metrics-medium");
            const narrowContainer = screen.getByTestId("responsive-metrics-narrow");

            const wideDashes = within(wideContainer).getAllByText("-");
            expect(wideDashes.length).toBe(5);

            const mediumDashes = within(mediumContainer).getAllByText("-");
            expect(mediumDashes.length).toBe(1);

            const narrowDashes = within(narrowContainer).getAllByText("-");
            expect(narrowDashes.length).toBe(1);

            // Confirms neither medium nor narrow invents misleading "0 questions" or "0 unanswered"
            expect(within(narrowContainer).queryByText(/0 questions/i)).toBeNull();
            expect(within(narrowContainer).queryByText(/0 unanswered/i)).toBeNull();
        });

        it("F. Narrow row structure places metrics after/beneath the identity in the DOM", () => {
            render(<HomeResponsiveContent contexts={mockClientContexts} />);

            const rows = screen.getAllByTestId("responsive-tree-row");
            expect(rows.length).toBeGreaterThanOrEqual(1);

            const firstRow = rows[0];
            // Row has flex-col for narrow and @[600px]:flex-row for medium/wide
            expect(firstRow.className).toContain("flex-col");
            expect(firstRow.className).toContain("@[600px]:flex-row");

            // First child is the identity container, second child is the metric container
            const children = Array.from(firstRow.children);
            expect(children.length).toBe(2);
            expect(children[0].textContent).toContain("Acme Operating Ltd");
            expect(within(children[1] as HTMLElement).getByTestId("responsive-metrics-narrow")).toBeDefined();
        });

        it("G. Narrow hierarchy has a bounded/capped indentation rule (max 16px)", () => {
            render(<HomeResponsiveContent contexts={mockClientContexts} />);

            const rows = screen.getAllByTestId("responsive-tree-row");
            // Find a level 2 or level 3 child row (e.g. Common Questionnaires)
            const cqRow = rows.find(r => r.textContent?.includes("Common Questionnaires"));
            expect(cqRow).toBeDefined();

            if (cqRow) {
                const identityContainer = cqRow.children[0] as HTMLElement;
                const styleObj = identityContainer.style;
                // Check CSS variables for responsive indentation
                const narrowIndentVal = styleObj.getPropertyValue("--indent-narrow");
                const desktopIndentVal = styleObj.getPropertyValue("--indent-desktop");

                expect(narrowIndentVal).toBeDefined();
                // Narrow indent must be <= 16px
                const narrowPx = parseInt(narrowIndentVal, 10);
                expect(narrowPx).toBeLessThanOrEqual(16);

                // Desktop indent for level 2 is 20px
                const desktopPx = parseInt(desktopIndentVal, 10);
                expect(desktopPx).toBe(20);
            }
        });

        it("H. Touch targets: expand/collapse triggers have at least 40px hit area on narrow", () => {
            render(<HomeResponsiveContent contexts={mockClientContexts} />);

            const triggers = screen.getAllByLabelText(/collapse|expand/i);
            expect(triggers.length).toBeGreaterThanOrEqual(1);

            for (const trigger of triggers) {
                expect(trigger.className).toContain("min-h-[40px]");
                expect(trigger.className).toContain("min-w-[40px]");
            }
        });
    });
});
