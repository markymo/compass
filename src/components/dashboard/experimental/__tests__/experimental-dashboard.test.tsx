/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardContexts } from "@/actions/dashboard";
import {
    QuestionStateMetrics,
    emptyQuestionStateMetrics,
    rollupQuestionStateMetrics,
    classifyQuestionAnswerState,
} from "@/lib/metrics/question-state-types";
import { ExperimentalMetricSummary } from "../experimental-metric-summary";
import { ExperimentalDashboardContent } from "../experimental-dashboard-content";
import { HomeVariantSwitcher } from "../../home-variant-switcher";

// Mock next/navigation for HomeVariantSwitcher
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({ push: mockPush }),
    usePathname: () => "/app",
}));

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

const mockContexts: DashboardContexts = {
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

describe("Experimental Homepage V2 Tweaks and Metric Parity", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe("Question Answer Classification & Invariant Rules", () => {
        it("1. Classifies externally resolved answers as EXTERNAL", () => {
            const cat = classifyQuestionAnswerState(true, "COMPANIES_HOUSE", false, "COMPANIES_HOUSE");
            expect(cat).toBe("EXTERNAL");
        });

        it("2. Classifies user-entered answers as USER_INPUT", () => {
            const cat = classifyQuestionAnswerState(true, "USER_INPUT", true, null);
            expect(cat).toBe("USER_INPUT");
        });

        it("3. Classifies DEFAULT_RESPONSE as DEFAULT_RESPONSE", () => {
            const cat = classifyQuestionAnswerState(false, null, false, null, "DEFAULT_RESPONSE");
            expect(cat).toBe("DEFAULT_RESPONSE");
        });

        it("4. Classifies missing/unanswered questions as UNANSWERED", () => {
            const cat = classifyQuestionAnswerState(false, null, false, null);
            expect(cat).toBe("UNANSWERED");
        });

        it("5. User input override beats external source -> USER_INPUT", () => {
            const cat = classifyQuestionAnswerState(true, "USER_INPUT", true, "COMPANIES_HOUSE");
            expect(cat).toBe("USER_INPUT");
        });

        it("6. Precedence: Default response winning claim is classified as DEFAULT_RESPONSE", () => {
            const cat = classifyQuestionAnswerState(true, "DEFAULT_RESPONSE", false, null, "DEFAULT_RESPONSE");
            expect(cat).toBe("DEFAULT_RESPONSE");
        });

        it("7. Invariant check: total === external + userInput + defaultResponse + unanswered across all test metrics", () => {
            const testCases: QuestionStateMetrics[] = [
                mockV2Metrics,
                { questionnairesCount: 1, total: 50, external: 30, userInput: 15, defaultResponse: 0, unanswered: 5 },
                emptyQuestionStateMetrics(),
            ];

            for (const m of testCases) {
                expect(m.total).toBe(m.external + m.userInput + m.defaultResponse + m.unanswered);
            }
        });

        it("8. Rollup preserves invariant mathematically", () => {
            const dest = { questionnairesCount: 1, total: 10, external: 6, userInput: 3, defaultResponse: 0, unanswered: 1 };
            const src = { questionnairesCount: 2, total: 15, external: 10, userInput: 2, defaultResponse: 0, unanswered: 3 };

            rollupQuestionStateMetrics(dest, src);

            expect(dest.questionnairesCount).toBe(3);
            expect(dest.total).toBe(25);
            expect(dest.external).toBe(16);
            expect(dest.userInput).toBe(5);
            expect(dest.defaultResponse).toBe(0);
            expect(dest.unanswered).toBe(4);
            expect(dest.total).toBe(dest.external + dest.userInput + dest.defaultResponse + dest.unanswered);
        });
    });

    describe("ExperimentalMetricSummary Presentation & Zero Blanking", () => {
        it("renders metric columns with Questionnaires count and Total Questions as anchor", () => {
            render(<ExperimentalMetricSummary metrics={mockV2Metrics} />);

            expect(screen.getByText("4")).toBeDefined();
            expect(screen.getByText("147")).toBeDefined();
            expect(screen.getByText("83")).toBeDefined();
            expect(screen.getByText("41")).toBeDefined();
            expect(screen.getByText("23")).toBeDefined();

            // Total Questions anchor container has border-r separation
            const anchor = screen.getByText("147").closest("div");
            expect(anchor?.className).toContain("border-r");
        });

        it("renders blank '-' for 0 questionnaire / 0 total question population rows", () => {
            render(<ExperimentalMetricSummary metrics={emptyQuestionStateMetrics()} />);

            const dashes = screen.getAllByText("-");
            expect(dashes.length).toBe(6);
        });

        it("does NOT render progress bars or percentages", () => {
            const { container } = render(<ExperimentalMetricSummary metrics={mockV2Metrics} />);

            expect(container.querySelector(".bg-sky-500")).toBeNull();
            expect(container.querySelector(".bg-amber-500")).toBeNull();
            expect(screen.queryByText(/%/)).toBeNull();
        });
    });

    describe("ExperimentalDashboardContent Header & Row Rendering", () => {
        it("renders section column headers ONCE per organization section", () => {
            render(<ExperimentalDashboardContent contexts={mockContexts} />);

            expect(screen.getByText("Questionnaires")).toBeDefined();
            expect(screen.getByText("Total Questions")).toBeDefined();
            expect(screen.getByText("External Answers")).toBeDefined();
            expect(screen.getByText("User Input")).toBeDefined();
            expect(screen.getByText("Default Answers")).toBeDefined();
            expect(screen.getByText("Unanswered")).toBeDefined();

            expect(screen.getAllByText("147").length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText("83").length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("HomeVariantSwitcher", () => {
        it("switches to v2 variant while preserving existing search parameters", () => {
            mockSearchParams = new URLSearchParams("filter=active&tab=overview");
            render(<HomeVariantSwitcher currentVariant="v1" />);

            const expButton = screen.getByText("Experimental");
            expButton.click();

            expect(mockPush).toHaveBeenCalledWith("/app?filter=active&tab=overview&home=v2");
        });
    });
});
