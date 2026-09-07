/**
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QuestionStateMetricStrip } from '@/components/shared/question-state-metric-strip';
import { isQuestionInPopulationScope, QuestionScope } from '@/lib/metrics/question-scope';
import { CrossQuestionnaireMapper } from '../cross-questionnaire-mapper';
import * as kycWorkbench from '@/actions/kyc-workbench';

// Mock dependencies of CrossQuestionnaireMapper
vi.mock('@/components/providers/user-preferences-provider', () => ({
    usePreferences: () => ({
        preferences: { workbenchViewMode: 'flat' },
        updatePreference: vi.fn(),
        isLoading: false
    })
}));

vi.mock('@/actions/kyc-workbench', () => ({
    mapQuestionToField: vi.fn(),
    getAIFieldNameSuggestion: vi.fn()
}));

vi.mock('@/actions/kyc-manual-update', () => ({
    applyManualOverride: vi.fn(),
    updateFieldManually: vi.fn().mockResolvedValue({ success: true }),
    addMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    removeMultiValueEntry: vi.fn().mockResolvedValue({ success: true }),
    applyCandidate: vi.fn().mockResolvedValue({ success: true }),
    restoreSourceValue: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/actions/kyc-query', () => ({
    getFieldDetail: vi.fn(),
    getPartyDisplayAudit: vi.fn().mockResolvedValue({ success: true, changes: [] }),
    searchUnboundGraphNodes: vi.fn().mockResolvedValue({ success: true, nodes: [] })
}));

vi.mock('@/actions/client-le', () => ({
    getFieldUsageDetails: vi.fn().mockResolvedValue({
        totalQuestions: 0,
        totalQuestionnaires: 0,
        totalSuppliers: 0,
        relationships: [],
        questions: [],
        questionnaires: [],
        suppliers: []
    })
}));

vi.mock('@/actions/system', () => ({
    getRegistryAuthorityNamesMap: vi.fn().mockResolvedValue({})
}));

vi.mock('@/actions/kanban-actions', () => ({
    approveQuestionMapping: vi.fn().mockResolvedValue({ success: true }),
    shareQuestion: vi.fn().mockResolvedValue({ success: true }),
    releaseQuestion: vi.fn().mockResolvedValue({ success: true }),
    getLETeamMembers: vi.fn().mockResolvedValue({ success: true, members: [] })
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-admin', role: 'LE_ADMIN', orgId: 'org-test' })
}));

let currentSearchString = '';
const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        prefetch: vi.fn(),
        refresh: vi.fn(),
    }),
    usePathname: () => '/app/le/le-123/workbench4',
    useSearchParams: () => new URLSearchParams(currentSearchString),
}));

vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: { user: { id: 'user-admin', role: 'LE_ADMIN', orgId: 'org-test' } },
        status: 'authenticated'
    })
}));

describe('ONP-63: Authoritative Workbench4 Drill-Down Parity & Scope Isolation', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        currentSearchString = '';
    });

    // Authoritative Test Dataset:
    // Barclays (7 questions total):
    //   External: 2, User Input: 1, Default: 1, Unanswered: 3
    // Common Questionnaires (4 questions total):
    //   External: 0, User Input: 0, Default: 0, Unanswered: 4
    const mockBarclaysQuestions = [
        // 2 External
        { id: 'b-ext-1', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: true, sourceType: 'COMPANIES_HOUSE', evidenceProvider: 'COMPANIES_HOUSE', isScoped: false },
        { id: 'b-ext-2', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: true, sourceType: 'GLEIF', evidenceProvider: 'GLEIF', isScoped: false },
        // 1 User Input
        { id: 'b-usr-1', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: true, sourceType: 'USER_INPUT', evidenceProvider: null, isScoped: true },
        // 1 Default
        { id: 'b-def-1', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: true, sourceType: 'SYSTEM_FALLBACK', displayState: 'DEFAULT', evidenceProvider: null, isScoped: false },
        // 3 Unanswered
        { id: 'b-una-1', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
        { id: 'b-una-2', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
        { id: 'b-una-3', fiEngagementId: 'eng-barclays', engagementOrgName: 'Barclays', questionnaireId: 'q-barclays-1', questionnaireName: 'Barclays QN', isCommon: false, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
    ];

    const mockCommonQuestions = [
        // 4 Unanswered Common Questions
        { id: 'cq-una-1', fiEngagementId: undefined, engagementOrgName: 'Common', questionnaireId: 'cq-kyc-1', questionnaireName: 'KYC Master Common', isCommon: true, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
        { id: 'cq-una-2', fiEngagementId: undefined, engagementOrgName: 'Common', questionnaireId: 'cq-kyc-1', questionnaireName: 'KYC Master Common', isCommon: true, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
        { id: 'cq-una-3', fiEngagementId: undefined, engagementOrgName: 'Common', questionnaireId: 'cq-kyc-1', questionnaireName: 'KYC Master Common', isCommon: true, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
        { id: 'cq-una-4', fiEngagementId: undefined, engagementOrgName: 'Common', questionnaireId: 'cq-kyc-1', questionnaireName: 'KYC Master Common', isCommon: true, hasAnswer: false, sourceType: null, evidenceProvider: null, isScoped: false },
    ];

    const allQuestions = [...mockBarclaysQuestions, ...mockCommonQuestions];

    const mockInitialData: kycWorkbench.Workbench4Data = {
        questions: allQuestions as any,
        masterFields: [],
        masterGroups: [],
        customFields: [],
        relationships: ['Barclays'],
        questionnaires: ['Barclays QN', 'KYC Master Common'],
        raNameLookup: {}
    };

    describe('1. Full Click-Through Journey: Barclays Metric Click -> Workbench4 Filtering', () => {
        it('Barclays Unanswered (3): metric click generates canonical URL and Workbench4 shows exactly 3 questions (0 CQ)', () => {
            // Step A: Metric strip on Relationships/Home renders Barclays counts
            const barclaysMetrics = {
                questionnairesCount: 1,
                total: 7,
                external: 2,
                userInput: 1,
                defaultResponse: 1,
                unanswered: 3
            };
            const { unmount } = render(
                <QuestionStateMetricStrip
                    metrics={barclaysMetrics}
                    linkContext={{
                        leId: 'le-123',
                        relationshipId: 'eng-barclays',
                        relationshipName: 'Barclays'
                    }}
                />
            );

            // Step B: Verify generated href for Unanswered
            const unansweredLink = screen.getByTestId('metric-link-unanswered');
            expect(unansweredLink).toHaveAttribute(
                'href',
                '/app/le/le-123/workbench4?relationshipId=eng-barclays&answerState=unanswered'
            );
            const targetHref = unansweredLink.getAttribute('href')!;
            unmount();

            // Step C: Simulate navigating to the generated URL in Workbench4
            const url = new URL(`http://localhost${targetHref}`);
            currentSearchString = url.search;

            render(
                <CrossQuestionnaireMapper
                    leId="le-123"
                    initialData={mockInitialData}
                />
            );

            // Step D: Invariant check - Workbench4 question count must equal 3 (strictly Barclays-own)
            // Under existing code with scope leak, 3 Barclays + 4 Common = 7 questions are shown.
            // This MUST be strictly 3.
            expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 3 questions');
        });

        it('Barclays Total (7): metric click generates canonical URL and Workbench4 shows exactly 7 questions (0 CQ)', () => {
            const barclaysMetrics = {
                questionnairesCount: 1,
                total: 7,
                external: 2,
                userInput: 1,
                defaultResponse: 1,
                unanswered: 3
            };
            const { unmount } = render(
                <QuestionStateMetricStrip
                    metrics={barclaysMetrics}
                    linkContext={{
                        leId: 'le-123',
                        relationshipId: 'eng-barclays',
                        relationshipName: 'Barclays'
                    }}
                />
            );

            const totalLink = screen.getByTestId('metric-link-total');
            expect(totalLink).toHaveAttribute('href', '/app/le/le-123/workbench4?relationshipId=eng-barclays');
            unmount();

            currentSearchString = '?relationshipId=eng-barclays';
            render(
                <CrossQuestionnaireMapper
                    leId="le-123"
                    initialData={mockInitialData}
                />
            );

            // 7 Barclays questions, strictly 0 CQ
            expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 7 questions');
        });

        it('Common Questionnaire Unanswered (4): generates scope=common URL and Workbench4 shows exactly 4 questions (0 Barclays)', () => {
            const cqMetrics = {
                questionnairesCount: 1,
                total: 4,
                external: 0,
                userInput: 0,
                defaultResponse: 0,
                unanswered: 4
            };
            const { unmount } = render(
                <QuestionStateMetricStrip
                    metrics={cqMetrics}
                    linkContext={{
                        leId: 'le-123',
                        scope: 'common' as any,
                        questionnaireId: 'cq-kyc-1',
                    }}
                />
            );

            const unansweredLink = screen.getByTestId('metric-link-unanswered');
            // Canonical URL shape for specific CQ
            expect(unansweredLink).toHaveAttribute(
                'href',
                '/app/le/le-123/workbench4?scope=common&questionnaireId=cq-kyc-1&answerState=unanswered'
            );
            unmount();

            currentSearchString = '?scope=common&questionnaireId=cq-kyc-1&answerState=unanswered';
            render(
                <CrossQuestionnaireMapper
                    leId="le-123"
                    initialData={mockInitialData}
                />
            );

            expect(screen.getByText(/Showing/i)).toHaveTextContent('Showing 4 questions');
        });
    });

    describe('2. Domain Scoping Contract: relationship-own vs relationship-effective', () => {
        it('when scopeMode is "relationship-own", relationship scope strictly excludes Common Questionnaires', () => {
            const scope: QuestionScope = {
                relationshipId: 'eng-barclays',
                scopeMode: 'relationship-own'
            };
            const visible = allQuestions.filter(q => isQuestionInPopulationScope(q, scope));
            expect(visible.length).toBe(7); // strictly 7 Barclays
            expect(visible.some(q => q.isCommon)).toBe(false);
        });

        it('when scopeMode is "relationship-effective", relationship scope includes relationship-own PLUS applicable CQ', () => {
            const scope: QuestionScope = {
                relationshipId: 'eng-barclays',
                scopeMode: 'relationship-effective'
            };
            const visible = allQuestions.filter(q => isQuestionInPopulationScope(q, scope));
            expect(visible.length).toBe(11); // 7 Barclays + 4 Common
            expect(visible.filter(q => q.isCommon).length).toBe(4);
        });
    });
});
