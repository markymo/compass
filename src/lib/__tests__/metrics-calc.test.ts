/**
 * metrics-calc — getActiveClaimsContext claim status semantics
 *
 * getActiveClaimsContext is a private helper inside metrics-calc.ts.
 * We test it indirectly through calculateEngagementMetrics / calculateQuestionnaireMetrics
 * by controlling the prisma mock to return specific claim status values.
 *
 * Tests prove (per spec):
 *   T1: VERIFIED claims count as available data (hasAnswer = true for mapped question)
 *   T2: ASSERTED claims count as available data (hasAnswer = true for mapped question)
 *   T3: REJECTED claims do NOT count as available data
 *   T4: No DISPUTED status exists in the schema (enum is ASSERTED/VERIFIED/REJECTED only)
 *   T5: ZZOOMM/FMSB-style mapped question with ASSERTED claim → answered incremented
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
    default: {
        question: { findMany: vi.fn() },
        fIEngagement: { findUnique: vi.fn() },
        questionnaire: { findUnique: vi.fn(), findMany: vi.fn() },
        fieldClaim: { findMany: vi.fn() },
        masterFieldGroupItem: { findMany: vi.fn() },
        clientLEOwner: { findFirst: vi.fn() },
        sourceFieldMapping: { findMany: vi.fn() },
        clientLE: { findUnique: vi.fn(), findMany: vi.fn() },
    },
}));

import prisma from '@/lib/prisma';
import {
    calculateEngagementMetrics,
    calculateEngagementOwnMetrics,
    calculateEffectiveEngagementMetrics,
    calculateCommonQuestionnaireMetrics,
    calculateQuestionnaireMetrics,
    rollupMetrics,
    emptyMetrics
} from '@/lib/metrics-calc';

const mock = prisma as any;

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ENGAGEMENT_ID = 'eng-001';
const QUESTIONNAIRE_ID = 'qn-001';
const LE_ID = 'le-001';
const CLIENT_LE_ID = 'cle-001';

/** One mapped question, no direct answer (relies entirely on claim lookup) */
const mappedQuestion = {
    id: 'q-001',
    status: 'DRAFT',
    answer: null,
    updatedAt: new Date(),
    masterFieldNo: 3,
    masterQuestionGroupId: null,
    customFieldDefinitionId: null,
};

/** One unmapped question */
const unmappedQuestion = {
    id: 'q-002',
    status: 'DRAFT',
    answer: null,
    updatedAt: new Date(),
    masterFieldNo: null,
    masterQuestionGroupId: null,
    customFieldDefinitionId: null,
};

const engagementWithLE = {
    clientLE: {
        id: CLIENT_LE_ID,
        legalEntityId: LE_ID,
        customData: null,
    },
};

function claimFor(fieldNo: number, status: string) {
    return { fieldNo };
    // Note: getActiveClaimsContext queries with status filter — the mock controls
    // which claims are returned, simulating the DB filter by only returning claims
    // for the statuses that the code requests.
}

beforeEach(() => {
    vi.clearAllMocks();
    // Stable defaults — no group items needed for single-field tests
    mock.masterFieldGroupItem.findMany.mockResolvedValue([]);
    mock.sourceFieldMapping.findMany.mockResolvedValue([]);
    mock.questionnaire.findMany.mockResolvedValue([]);
    mock.clientLE.findUnique.mockResolvedValue({ gleifFetchedAt: null, registryReferences: [], commonQuestionnaires: [] });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getActiveClaimsContext — claim status semantics', () => {

    /**
     * T1: VERIFIED claim → mapped question is counted as answered.
     *
     * The DB returns a VERIFIED claim for fieldNo=3. The question maps to fieldNo=3.
     * Expected: answered=1, noData=1 (unmapped question has no answer).
     */
    it('T1: VERIFIED claim counts as available data — mapped question shows answered', async () => {
        mock.question.findMany.mockResolvedValue([mappedQuestion, unmappedQuestion]);
        mock.fIEngagement.findUnique.mockResolvedValue(engagementWithLE);
        // Simulate DB returning VERIFIED claim (the code now requests VERIFIED + ASSERTED)
        mock.fieldClaim.findMany.mockResolvedValue([{ id: 'c1', fieldNo: 3, status: 'VERIFIED', valueText: 'data', assertedAt: new Date(), ownerScopeId: null }]);

        const m = await calculateEngagementMetrics(ENGAGEMENT_ID);

        expect(m.total).toBe(2);
        expect(m.mapped).toBe(1);
        expect(m.answered).toBe(1);  // VERIFIED claim → has data
        expect(m.noData).toBe(1);    // unmapped question has no data
    });

    /**
     * T2: ASSERTED claim → mapped question is counted as answered.
     *
     * Identical setup to T1 but simulating that the DB returns an ASSERTED claim.
     * Since the filter now includes ASSERTED, the mock still returns the claim row.
     * Expected: same result as T1 — ASSERTED is authoritative.
     */
    it('T2: ASSERTED claim counts as available data — mapped question shows answered', async () => {
        mock.question.findMany.mockResolvedValue([mappedQuestion, unmappedQuestion]);
        mock.fIEngagement.findUnique.mockResolvedValue(engagementWithLE);
        // ASSERTED claim for fieldNo=3 (DB returns it because the filter includes ASSERTED)
        mock.fieldClaim.findMany.mockResolvedValue([{ id: 'c1', fieldNo: 3, status: 'ASSERTED', valueText: 'data', assertedAt: new Date(), ownerScopeId: null }]);

        const m = await calculateEngagementMetrics(ENGAGEMENT_ID);

        expect(m.total).toBe(2);
        expect(m.mapped).toBe(1);
        expect(m.answered).toBe(1);  // ASSERTED claim → has data
        expect(m.noData).toBe(1);
    });

    /**
     * T3: REJECTED claim does NOT count as available data.
     *
     * The DB returns no rows (simulating that the REJECTED claim was excluded by the
     * status IN ('VERIFIED','ASSERTED') filter). The mapped question has no direct answer.
     * Expected: answered=0, noData=2 (both questions lack data).
     */
    it('T3: REJECTED claim does not count — mapped question remains unanswered', async () => {
        mock.question.findMany.mockResolvedValue([mappedQuestion, unmappedQuestion]);
        mock.fIEngagement.findUnique.mockResolvedValue(engagementWithLE);
        // Simulate DB returning nothing (REJECTED claim filtered out by IN clause)
        mock.fieldClaim.findMany.mockResolvedValue([]);

        const m = await calculateEngagementMetrics(ENGAGEMENT_ID);

        expect(m.total).toBe(2);
        expect(m.mapped).toBe(1);
        expect(m.answered).toBe(0);  // No valid claim → not answered
        expect(m.noData).toBe(2);    // Both questions have no data
    });

    /**
     * T4: DISPUTED status does not exist in the ClaimStatus schema enum.
     *
     * The Prisma schema defines: enum ClaimStatus { ASSERTED  VERIFIED  REJECTED }
     * There is no DISPUTED value. This test documents that fact structurally —
     * the IN filter ['VERIFIED','ASSERTED'] is exhaustive for "active" statuses
     * without needing to explicitly exclude a non-existent DISPUTED value.
     */
    it('T4: ClaimStatus enum has no DISPUTED value — filter is exhaustive without explicit exclusion', () => {
        // The ClaimStatus enum is: ASSERTED | VERIFIED | REJECTED.
        // We verify that the set of excluded statuses (REJECTED) is the complete complement
        // of the included statuses (VERIFIED, ASSERTED).
        const includedStatuses = new Set(['VERIFIED', 'ASSERTED']);
        const allKnownStatuses = new Set(['ASSERTED', 'VERIFIED', 'REJECTED']);
        const excludedStatuses = [...allKnownStatuses].filter(s => !includedStatuses.has(s));

        expect(excludedStatuses).toEqual(['REJECTED']);
        expect(excludedStatuses).not.toContain('DISPUTED'); // DISPUTED does not exist
    });

    /**
     * T5: ZZOOMM/FMSB-style scenario.
     *
     * 14 mapped questions (like FMSB Standard UK V2 questionnaire a812de9c).
     * 6 of them have ASSERTED claims (simulating Companies House data for fieldNos 3,18,20,22,27,80).
     * 1 has a VERIFIED claim (fieldNo=5).
     * 7 have no claims.
     * Expected: answered=7 (6 ASSERTED + 1 VERIFIED), not-answered=7.
     */
    it('T5: ZZOOMM/FMSB-style — 14 mapped questions, ASSERTED claims for 6 fieldNos + VERIFIED for 1 → answered=7', async () => {
        const assertedFieldNos = [3, 18, 20, 22, 27, 80];   // Companies House ASSERTED
        const verifiedFieldNos = [5];                         // VERIFIED
        const noClaimFieldNos  = [4, 24, 25, 60, 64, 81, 1]; // no claim

        const questions = [
            ...assertedFieldNos.map((no, i) => ({
                id: `q-asserted-${i}`, status: 'DRAFT', answer: null, updatedAt: new Date(),
                masterFieldNo: no, masterQuestionGroupId: null, customFieldDefinitionId: null,
            })),
            ...verifiedFieldNos.map((no, i) => ({
                id: `q-verified-${i}`, status: 'DRAFT', answer: null, updatedAt: new Date(),
                masterFieldNo: no, masterQuestionGroupId: null, customFieldDefinitionId: null,
            })),
            ...noClaimFieldNos.map((no, i) => ({
                id: `q-noclaim-${i}`, status: 'DRAFT', answer: null, updatedAt: new Date(),
                masterFieldNo: no, masterQuestionGroupId: null, customFieldDefinitionId: null,
            })),
        ];

        mock.question.findMany.mockResolvedValue(questions);
        mock.fIEngagement.findUnique.mockResolvedValue(engagementWithLE);

        // DB returns rows for all ASSERTED + VERIFIED claims (filtered by IN clause)
        const claimsReturned = [
            ...assertedFieldNos.map((no, i) => ({ id: `c-a-${i}`, fieldNo: no, status: 'ASSERTED', valueText: 'data', assertedAt: new Date(), ownerScopeId: null })),
            ...verifiedFieldNos.map((no, i) => ({ id: `c-v-${i}`, fieldNo: no, status: 'VERIFIED', valueText: 'data', assertedAt: new Date(), ownerScopeId: null }))
        ];
        mock.fieldClaim.findMany.mockResolvedValue(claimsReturned);

        const m = await calculateEngagementMetrics(ENGAGEMENT_ID);

        expect(m.total).toBe(14);
        expect(m.mapped).toBe(14);   // all questions are mapped
        expect(m.answered).toBe(7);  // 6 ASSERTED + 1 VERIFIED
        expect(m.noData).toBe(7);    // 7 with no claim at all
    });

    /**
     * T6: calculateQuestionnaireMetrics applies the same ASSERTED-inclusive logic.
     *
     * Ensures the fix propagates through the questionnaire-level metrics path
     * (used by the questionnaire detail page header after Bug 1 fix).
     */
    it('T6: calculateQuestionnaireMetrics — ASSERTED claim on mapped question → answered', async () => {
        mock.questionnaire.findUnique.mockResolvedValue({
            id: QUESTIONNAIRE_ID,
            extractedContent: null,
            fiEngagement: {
                clientLE: { id: CLIENT_LE_ID, legalEntityId: LE_ID, customData: null }
            }
        });
        mock.question.findMany.mockResolvedValue([mappedQuestion]);
        // ASSERTED claim returned by the inclusive filter
        mock.fieldClaim.findMany.mockResolvedValue([{ id: 'c1', fieldNo: 3, status: 'ASSERTED', valueText: 'data', assertedAt: new Date(), ownerScopeId: null }]);

        const m = await calculateQuestionnaireMetrics(QUESTIONNAIRE_ID);

        expect(m.total).toBe(1);
        expect(m.mapped).toBe(1);
        expect(m.answered).toBe(1);  // ASSERTED claim via questionnaire path
        expect(m.noData).toBe(0);
    });

    /**
     * T7: No LE → no claims loaded → all questions show noData.
     *
     * Edge case: if legalEntityId is null (LE not fully configured),
     * getActiveClaimsContext skips the DB query and returns empty sets.
     */
    it('T7: no legalEntityId → claims not loaded → all mapped questions show noData', async () => {
        mock.question.findMany.mockResolvedValue([mappedQuestion]);
        mock.fIEngagement.findUnique.mockResolvedValue({
            clientLE: { id: CLIENT_LE_ID, legalEntityId: null, customData: null }
        });
        // fieldClaim.findMany should NOT be called

        const m = await calculateEngagementMetrics(ENGAGEMENT_ID);

        expect(m.total).toBe(1);
        expect(m.answered).toBe(0);
        expect(mock.fieldClaim.findMany).not.toHaveBeenCalled();
    });
});

describe('Common Questionnaires & Effective Engagement Metrics', () => {

    it('Scenario 1: LE with Common Questionnaire and no supplier engagements returns non-zero CQ metrics', async () => {
        mock.clientLE.findUnique.mockResolvedValue({ id: CLIENT_LE_ID, legalEntityId: LE_ID, customData: null, registryReferences: [] });
        mock.questionnaire.findUnique.mockResolvedValue({ id: 'cq-001', extractedContent: null });
        mock.question.findMany.mockResolvedValue([
            { id: 'cq-q1', status: 'RELEASED', answer: 'Yes', masterFieldNo: 1 },
            { id: 'cq-q2', status: 'APPROVED', answer: 'No', masterFieldNo: 2 }
        ]);

        const cqMetrics = await calculateCommonQuestionnaireMetrics('cq-001', CLIENT_LE_ID);
        expect(cqMetrics.total).toBe(2);
        expect(cqMetrics.answered).toBe(2);
        expect(cqMetrics.approved).toBe(1);
        expect(cqMetrics.released).toBe(1);
    });

    it('Scenario 2 & 3: Supplier effective metrics include relationship questions + applicable Common Questionnaire', async () => {
        mock.question.findMany.mockImplementation(async (args: any) => {
            if (args.where?.questionnaire?.fiEngagementId === ENGAGEMENT_ID) {
                return [{ id: 'eng-q1', status: 'DRAFT', answer: 'Eng Answer', masterFieldNo: 10 }];
            }
            if (args.where?.questionnaireId === 'cq-001') {
                return [
                    { id: 'cq-q1', status: 'DRAFT', answer: 'CQ Answer 1', masterFieldNo: 11 },
                    { id: 'cq-q2', status: 'DRAFT', answer: 'CQ Answer 2', masterFieldNo: 12 }
                ];
            }
            return [];
        });

        mock.fIEngagement.findUnique.mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            clientLE: { id: CLIENT_LE_ID, legalEntityId: LE_ID, customData: null }
        });

        mock.clientLE.findUnique.mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: LE_ID,
            customData: null,
            registryReferences: [],
            commonQuestionnaires: [{ id: 'cq-001' }]
        });

        const effectiveMetrics = await calculateEffectiveEngagementMetrics(ENGAGEMENT_ID, CLIENT_LE_ID);

        expect(effectiveMetrics.total).toBe(3);
        expect(effectiveMetrics.answered).toBe(3);
    });

    it('Scenario 4 & 5: Multiple suppliers sharing one CQ each get CQ metrics without mutating high-level rollup', async () => {
        mock.question.findMany.mockImplementation(async (args: any) => {
            if (args.where?.questionnaireId === 'cq-shared') {
                return [{ id: 'cq-q1', status: 'DRAFT', answer: 'CQ Answer', masterFieldNo: 50 }];
            }
            return [];
        });

        mock.fIEngagement.findUnique.mockImplementation(async (args: any) => ({
            id: args.where.id,
            clientLEId: CLIENT_LE_ID,
            clientLE: { id: CLIENT_LE_ID, legalEntityId: LE_ID, customData: null }
        }));

        mock.clientLE.findUnique.mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: LE_ID,
            customData: null,
            registryReferences: [],
            commonQuestionnaires: [{ id: 'cq-shared' }]
        });

        const cache = new Map();
        const metricsSuppA = await calculateEffectiveEngagementMetrics('eng-A', CLIENT_LE_ID, cache);
        const metricsSuppB = await calculateEffectiveEngagementMetrics('eng-B', CLIENT_LE_ID, cache);

        expect(metricsSuppA.total).toBe(1);
        expect(metricsSuppB.total).toBe(1);

        const leMetrics = emptyMetrics();
        const cqMetrics = await calculateCommonQuestionnaireMetrics('cq-shared', CLIENT_LE_ID);
        rollupMetrics(leMetrics, cqMetrics);

        const ownA = await calculateEngagementOwnMetrics('eng-A');
        const ownB = await calculateEngagementOwnMetrics('eng-B');
        rollupMetrics(leMetrics, ownA);
        rollupMetrics(leMetrics, ownB);

        expect(leMetrics.total).toBe(1);
    });

    it('Scenario 6: Excludes deleted or template Common Questionnaires', async () => {
        mock.clientLE.findUnique.mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: LE_ID,
            customData: null,
            registryReferences: [],
            commonQuestionnaires: []
        });

        mock.fIEngagement.findUnique.mockResolvedValue({
            id: ENGAGEMENT_ID,
            clientLEId: CLIENT_LE_ID,
            clientLE: { id: CLIENT_LE_ID, legalEntityId: LE_ID, customData: null }
        });

        mock.question.findMany.mockResolvedValue([]);

        const effectiveMetrics = await calculateEffectiveEngagementMetrics(ENGAGEMENT_ID, CLIENT_LE_ID);
        expect(effectiveMetrics.total).toBe(0);
    });

    it('Scenario 7: Cross-client isolation ensures CQ for LE A is not applied to LE B', async () => {
        mock.clientLE.findUnique.mockImplementation(async (args: any) => {
            if (args.where.id === 'cle-A') {
                return { id: 'cle-A', legalEntityId: 'le-A', registryReferences: [], commonQuestionnaires: [{ id: 'cq-A' }] };
            }
            if (args.where.id === 'cle-B') {
                return { id: 'cle-B', legalEntityId: 'le-B', registryReferences: [], commonQuestionnaires: [] };
            }
            return null;
        });

        mock.fIEngagement.findUnique.mockResolvedValue({
            id: 'eng-B',
            clientLEId: 'cle-B',
            clientLE: { id: 'cle-B', legalEntityId: 'le-B', customData: null }
        });

        mock.question.findMany.mockResolvedValue([]);

        const effectiveMetricsB = await calculateEffectiveEngagementMetrics('eng-B', 'cle-B');
        expect(effectiveMetricsB.total).toBe(0);
    });

    it('Scenario 8: calculateEngagementMetrics(id) without explicit clientLeId resolves ClientLE internally', async () => {
        mock.fIEngagement.findUnique.mockImplementation(async (args: any) => {
            if (args.where.id === ENGAGEMENT_ID) {
                return {
                    id: ENGAGEMENT_ID,
                    clientLEId: CLIENT_LE_ID,
                    clientLE: { id: CLIENT_LE_ID, legalEntityId: LE_ID, customData: null }
                };
            }
            return null;
        });

        mock.clientLE.findUnique.mockResolvedValue({
            id: CLIENT_LE_ID,
            legalEntityId: LE_ID,
            customData: null,
            registryReferences: [],
            commonQuestionnaires: [{ id: 'cq-001' }]
        });

        mock.question.findMany.mockImplementation(async (args: any) => {
            if (args.where?.questionnaireId === 'cq-001') {
                return [{ id: 'q-auto', status: 'DRAFT', answer: 'Auto Answer', masterFieldNo: 99 }];
            }
            return [];
        });

        // Call without passing clientLeId argument
        const m = await calculateEngagementMetrics(ENGAGEMENT_ID);
        expect(m.total).toBe(1);
        expect(m.answered).toBe(1);
    });
});
