/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { CommonQuestionnaires } from "../common-questionnaires";
import { EngagementManager } from "../engagement-manager";
import { QuestionStateMetrics } from "@/lib/metrics/question-state-types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/app/le/le-1/relationships",
}));

vi.mock("@/actions/client", () => ({
    searchFIs: vi.fn().mockResolvedValue([]),
    deleteEngagementByClient: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/actions/client-le", () => ({
    getAvailableCommonQuestionnaires: vi.fn().mockResolvedValue({ success: true, snapshots: [] }),
    addCommonQuestionnaire: vi.fn(),
    removeCommonQuestionnaire: vi.fn(),
    createFIEngagement: vi.fn(),
}));

vi.mock("@/actions/questionnaire", () => ({
    assignQuestionnaireToEngagement: vi.fn(),
    deleteQuestionnaire: vi.fn(),
}));

vi.mock("@/actions/questionnaires-v2", () => ({
    getDiscoverableReferenceSnapshotsForOrg: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/providers/user-preferences-provider", () => ({
    usePreferences: () => ({
        preferences: {},
        isLoading: false,
        updatePreference: vi.fn(),
    }),
}));

describe("ONP-63 — Surface 3 (Relationships & Common Questionnaires) Metric Presentation", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    const mockV2Metrics: QuestionStateMetrics = {
        questionnairesCount: 1,
        total: 25,
        external: 10,
        userInput: 8,
        defaultResponse: 2,
        unanswered: 5,
    };

    describe("CommonQuestionnaires table", () => {
        const mockCQ = {
            id: "cq-1",
            name: "Standard Due Diligence",
            referenceCode: "SDD-2026",
            v2Metrics: mockV2Metrics,
            metrics: { total: 25, mapped: 18, answered: 20, approved: 1, released: 0, noData: 0 },
        };

        it("renders canonical Home 5-metric headers and values, and suppresses legacy Mapped/Gap/Blank", () => {
            render(
                <CommonQuestionnaires
                    leId="le-1"
                    initialQuestionnaires={[mockCQ]}
                />
            );

            // Table headers
            expect(screen.getAllByText(/Total/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/External/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/User Input/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Default/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Unanswered/i).length).toBeGreaterThan(0);

            // Metric values from v2Metrics
            expect(screen.getAllByText("25").length).toBeGreaterThan(0);
            expect(screen.getAllByText("10").length).toBeGreaterThan(0);
            expect(screen.getAllByText("8").length).toBeGreaterThan(0);
            expect(screen.getAllByText("2").length).toBeGreaterThan(0);
            expect(screen.getAllByText("5").length).toBeGreaterThan(0);

            // Legacy labels are absent
            expect(screen.queryByText(/Data Sourcing/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Mapped/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Gap/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Blank/i)).not.toBeInTheDocument();

            // Actions remain intact
            expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
        });
    });

    describe("EngagementManager supplier relationships", () => {
        const mockEngagement = {
            id: "eng-1",
            status: "ACTIVE",
            org: { id: "org-1", name: "Barclays Bank PLC" },
            v2Metrics: mockV2Metrics,
            metrics: { total: 25, mapped: 18, answered: 20, approved: 1, released: 0, noData: 0 },
            questionnaireInstances: [
                {
                    id: "q-inst-1",
                    name: "Security Questionnaire",
                    referenceCode: "SEC-01",
                    status: "ACTIVE",
                    v2Metrics: mockV2Metrics,
                    metrics: { total: 25, mapped: 18, answered: 20, approved: 1, released: 0, noData: 0 },
                }
            ],
            _count: { sharedDocuments: 2, memberships: 1, invitations: 0 },
        };

        it("renders canonical Home 5-metric terminology on relationship accordion header and child questionnaires", () => {
            render(
                <EngagementManager
                    leId="le-1"
                    initialEngagements={[mockEngagement]}
                />
            );

            // Canonical terminology present
            expect(screen.getAllByText(/Total/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/External/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/User Input/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Default/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Unanswered/i).length).toBeGreaterThan(0);

            // Legacy confusing labels are absent from table and rows
            expect(screen.queryByText(/Data Sourcing/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Mapped/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Gap/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Blank/i)).not.toBeInTheDocument();
        });
    });
});
