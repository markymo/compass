/**
 * @vitest-environment happy-dom
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
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

    describe("HomeResponsiveMetricSummary Component", () => {
        it("renders blank '-' for 0 questionnaire / 0 total population rows", () => {
            render(<HomeResponsiveMetricSummary metrics={emptyQuestionStateMetrics()} />);

            const dashes = screen.getAllByText("-");
            expect(dashes.length).toBe(5);
        });

        it("generates correct Workbench4 drill-down links for Client LE metrics", () => {
            render(
                <HomeResponsiveMetricSummary
                    metrics={mockV2Metrics}
                    linkContext={{ leId: "le-123", scope: "common" }}
                />
            );

            const externalLink = screen.getByTestId("metric-link-external");
            expect(externalLink.getAttribute("href")).toContain("/app/le/le-123/workbench4");
            expect(externalLink.getAttribute("href")).toContain("scope=common");
            expect(externalLink.getAttribute("href")).toContain("answerState=external");
        });

        it("generates correct Questions drill-down links for Supplier metrics", () => {
            render(
                <HomeResponsiveMetricSummary
                    metrics={mockV2Metrics}
                    linkContext={{ supplierOrgId: "fi-123", supplierRelName: "Acme", questionnaireId: "q-1" }}
                />
            );

            const unansweredLink = screen.getByTestId("metric-link-unanswered");
            expect(unansweredLink.getAttribute("href")).toContain("/app/s/fi-123/questions");
            expect(unansweredLink.getAttribute("href")).toContain("status=UNANSWERED");
            expect(unansweredLink.getAttribute("href")).toContain("rel=Acme");
            expect(unansweredLink.getAttribute("href")).toContain("q=q-1");
        });
    });
});
