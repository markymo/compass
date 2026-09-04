/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { EngagementDetailView } from "../engagement-detail-view";
import { QuestionStateMetrics } from "@/lib/metrics/question-state-types";

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
    usePathname: () => "/app/le/le-1/engagement-new/eng-1",
}));

vi.mock("@/context/breadcrumb-context", () => ({
    SetPageBreadcrumbs: () => null,
}));

describe("ONP-63 — EngagementDetailView Metric Presentation & Terminology", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    const mockV2Metrics: QuestionStateMetrics = {
        questionnairesCount: 1,
        total: 10,
        external: 4,
        userInput: 3,
        defaultResponse: 1,
        unanswered: 2,
    };

    const mockLE = {
        id: "le-1",
        name: "Alpha Corp",
    };

    const mockEngagement = {
        id: "eng-1",
        clientLEId: "le-1",
        clientLE: mockLE,
        org: { id: "fi-1", name: "Barclays" },
        v2Metrics: mockV2Metrics,
    };

    const mockQuestionnaire = {
        id: "q-1",
        name: "Security Assessment",
        status: "ACTIVE",
        v2Metrics: mockV2Metrics,
        metrics: { total: 10, mapped: 8, answered: 7, approved: 2, released: 1, noData: 0 },
    };

    it("renders canonical Home-style completion terminology (Total, External, User Input, Default, Unanswered) and suppresses legacy Mapped/Gap/Blank labels", () => {
        render(
            <EngagementDetailView
                le={mockLE}
                engagement={mockEngagement}
                questionnaires={[mockQuestionnaire]}
                sharedDocuments={[]}
                invitations={[]}
                members={[]}
                v2Metrics={mockV2Metrics}
                metrics={mockQuestionnaire.metrics}
            />
        );

        // Verify Home canonical metric terminology is present
        expect(screen.getAllByText(/Total/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/External/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/User Input/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Default/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Unanswered/i).length).toBeGreaterThan(0);

        // Verify legacy confusing labels are ABSENT
        expect(screen.queryByText(/Data Sourcing/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Mapped/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Gap/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Blank/i)).not.toBeInTheDocument();

        // Verify action button intact
        expect(screen.getByText(/Invite User/i)).toBeInTheDocument();
    });
});
