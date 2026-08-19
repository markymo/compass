/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import {
    QuestionStateMetrics,
    classifyQuestionAnswerState,
} from "@/lib/metrics/question-state-types";
import {
    isQuestionInPopulationScope,
    QuestionScopeTarget,
    QuestionScope,
} from "@/lib/metrics/question-scope";
import { ExperimentalMetricSummary, MetricLinkContext } from "../experimental-metric-summary";

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({ push: mockPush }),
    usePathname: () => "/app",
}));

describe("Workbench4 Drill-Down & Count Parity Invariant", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    const mockQuestions: (QuestionScopeTarget & { hasAnswer: boolean; sourceType?: string | null; isScoped?: boolean | null; evidenceProvider?: string | null; displayState?: string | null })[] = [
        // Relationship 1 own questions (20 questions: 10 external, 6 user_input, 4 unanswered)
        ...Array.from({ length: 10 }, (_, i) => ({
            id: `r1-ext-${i}`,
            fiEngagementId: "eng-1",
            questionnaireId: "q-eng-1",
            engagementOrgName: "Barclays",
            questionnaireName: "Barclays Questionnaire",
            isCommon: false,
            hasAnswer: true,
            sourceType: "COMPANIES_HOUSE",
            isScoped: false,
            evidenceProvider: "COMPANIES_HOUSE",
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
            id: `r1-usr-${i}`,
            fiEngagementId: "eng-1",
            questionnaireId: "q-eng-1",
            engagementOrgName: "Barclays",
            questionnaireName: "Barclays Questionnaire",
            isCommon: false,
            hasAnswer: true,
            sourceType: "USER_INPUT",
            isScoped: true,
            evidenceProvider: null,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
            id: `r1-unans-${i}`,
            fiEngagementId: "eng-1",
            questionnaireId: "q-eng-1",
            engagementOrgName: "Barclays",
            questionnaireName: "Barclays Questionnaire",
            isCommon: false,
            hasAnswer: false,
            sourceType: null,
            isScoped: false,
            evidenceProvider: null,
        })),

        // Common Questionnaire questions for LE (8 questions: 4 external, 3 user_input, 1 unanswered)
        ...Array.from({ length: 4 }, (_, i) => ({
            id: `cq-ext-${i}`,
            fiEngagementId: undefined,
            questionnaireId: "cq-1",
            engagementOrgName: "Common",
            questionnaireName: "KYC Master Profile",
            isCommon: true,
            hasAnswer: true,
            sourceType: "GLEIF",
            isScoped: false,
            evidenceProvider: "GLEIF",
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
            id: `cq-usr-${i}`,
            fiEngagementId: undefined,
            questionnaireId: "cq-1",
            engagementOrgName: "Common",
            questionnaireName: "KYC Master Profile",
            isCommon: true,
            hasAnswer: true,
            sourceType: "USER_INPUT",
            isScoped: true,
            evidenceProvider: null,
        })),
        ...Array.from({ length: 1 }, (_, i) => ({
            id: `cq-unans-${i}`,
            fiEngagementId: undefined,
            questionnaireId: "cq-1",
            engagementOrgName: "Common",
            questionnaireName: "KYC Master Profile",
            isCommon: true,
            hasAnswer: false,
            sourceType: null,
            isScoped: false,
            evidenceProvider: null,
        })),
    ];

    function workbenchVisibleQuestions(
        questions: any[],
        scope: QuestionScope,
        answerState: "ALL" | "external" | "user_input" | "default_response" | "unanswered" = "ALL"
    ) {
        return questions.filter((q) => {
            const matchesScope = isQuestionInPopulationScope(q, scope);
            if (!matchesScope) return false;

            if (answerState !== "ALL") {
                const category = classifyQuestionAnswerState(
                    q.hasAnswer,
                    q.sourceType,
                    q.isScoped,
                    q.evidenceProvider,
                    q.displayState
                );
                if (category !== answerState.toUpperCase()) return false;
            }

            return true;
        });
    }

    describe("1. Relationship Scope & Common Questionnaire Invariant", () => {
        it("includes relationship-own (20) + applicable CQ (8) = 28 total questions for relationship scope", () => {
            const scope: QuestionScope = { relationshipId: "eng-1" };
            const visible = workbenchVisibleQuestions(mockQuestions, scope, "ALL");
            expect(visible.length).toBe(28);
        });

        it("exact count parity for relationship metric counts: External=14, User Input=9, Default=0, Unanswered=5", () => {
            const scope: QuestionScope = { relationshipId: "eng-1" };

            const ext = workbenchVisibleQuestions(mockQuestions, scope, "external");
            const usr = workbenchVisibleQuestions(mockQuestions, scope, "user_input");
            const def = workbenchVisibleQuestions(mockQuestions, scope, "default_response");
            const unans = workbenchVisibleQuestions(mockQuestions, scope, "unanswered");

            expect(ext.length).toBe(14); // 10 r1 + 4 cq
            expect(usr.length).toBe(9);  // 6 r1 + 3 cq
            expect(def.length).toBe(0);
            expect(unans.length).toBe(5); // 4 r1 + 1 cq

            // Sum equals Total
            expect(ext.length + usr.length + def.length + unans.length).toBe(28);
        });
    });

    describe("2. CQ Scope Parity", () => {
        it("scopes exact CQ questions (8 total) when questionnaireId is supplied", () => {
            const scope: QuestionScope = { questionnaireId: "cq-1" };
            const visible = workbenchVisibleQuestions(mockQuestions, scope, "ALL");
            expect(visible.length).toBe(8);
        });
    });

    describe("3. Precedence Rules: Stable IDs vs Legacy Names", () => {
        it("stable relationshipId takes precedence over legacy rel name", () => {
            const scope: QuestionScope = { relationshipId: "eng-1", rel: "NonExistentSupplier" };
            const visible = workbenchVisibleQuestions(mockQuestions, scope, "ALL");
            expect(visible.length).toBe(28);
        });

        it("legacy rel name works as fallback when relationshipId is omitted", () => {
            const scope: QuestionScope = { rel: "Barclays" };
            const visible = workbenchVisibleQuestions(mockQuestions, scope, "ALL");
            expect(visible.length).toBe(28); // 20 Barclays + 8 Common
        });

        it("stable questionnaireId takes precedence over legacy q name", () => {
            const scope: QuestionScope = { questionnaireId: "cq-1", q: "Wrong Questionnaire Name" };
            const visible = workbenchVisibleQuestions(mockQuestions, scope, "ALL");
            expect(visible.length).toBe(8);
        });

        it("legacy q name works as fallback when questionnaireId is omitted", () => {
            const scope: QuestionScope = { q: "KYC Master Profile" };
            const visible = workbenchVisibleQuestions(mockQuestions, scope, "ALL");
            expect(visible.length).toBe(8);
        });
    });

    describe("4. Metric Cell Links Generation", () => {
        const metrics: QuestionStateMetrics = {
            questionnairesCount: 2,
            total: 28,
            external: 14,
            userInput: 9,
            defaultResponse: 0,
            unanswered: 5,
        };

        it("generates correct deep-link URLs for Legal Entity scope", () => {
            const linkContext: MetricLinkContext = { leId: "le-123" };
            render(<ExperimentalMetricSummary metrics={metrics} linkContext={linkContext} />);

            const totalLink = screen.getByTestId("metric-link-total");
            const extLink = screen.getByTestId("metric-link-external");
            const usrLink = screen.getByTestId("metric-link-user_input");
            const defLink = screen.getByTestId("metric-link-default_response");
            const unansLink = screen.getByTestId("metric-link-unanswered");

            expect(totalLink.getAttribute("href")).toBe("/app/le/le-123/workbench4");
            expect(extLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?answerState=external");
            expect(usrLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?answerState=user_input");
            expect(defLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?answerState=default_response");
            expect(unansLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?answerState=unanswered");
        });

        it("generates correct deep-link URLs for Relationship scope with stable relationshipId", () => {
            const linkContext: MetricLinkContext = { leId: "le-123", relationshipId: "eng-789" };
            render(<ExperimentalMetricSummary metrics={metrics} linkContext={linkContext} />);

            const totalLink = screen.getByTestId("metric-link-total");
            const extLink = screen.getByTestId("metric-link-external");

            expect(totalLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?relationshipId=eng-789");
            expect(extLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?relationshipId=eng-789&answerState=external");
        });

        it("generates correct deep-link URLs for Questionnaire scope with stable questionnaireId", () => {
            const linkContext: MetricLinkContext = { leId: "le-123", questionnaireId: "cq-456" };
            render(<ExperimentalMetricSummary metrics={metrics} linkContext={linkContext} />);

            const totalLink = screen.getByTestId("metric-link-total");
            const usrLink = screen.getByTestId("metric-link-user_input");

            expect(totalLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?questionnaireId=cq-456");
            expect(usrLink.getAttribute("href")).toBe("/app/le/le-123/workbench4?questionnaireId=cq-456&answerState=user_input");
        });
    });
});
