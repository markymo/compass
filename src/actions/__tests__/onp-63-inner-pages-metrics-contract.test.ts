import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getEngagementDetails } from '../client-le';
import { getClientLEData } from '../client';
import { getIdentity } from '@/lib/auth';
import { QuestionStateMetrics } from '@/lib/metrics/question-state-types';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        fIEngagement: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        clientLE: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        clientLEOwner: {
            findMany: vi.fn(),
        },
        clientLERecord: {
            findFirst: vi.fn(),
        },
        questionnaire: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        question: {
            findMany: vi.fn(),
        },
        invitation: {
            findMany: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
        },
        user: {
            findMany: vi.fn(),
        },
        masterSchema: {
            findFirst: vi.fn(),
        },
        fieldClaim: {
            findMany: vi.fn(),
        },
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('@/lib/auth/permissions', () => ({
    Action: {
        ENG_VIEW: 'eng:view',
        ENG_VIEW_RELEASED_DATA: 'eng:view_released_data',
        ENG_EDIT_DRAFT_RESPONSES: 'eng:edit_draft_responses',
        QUESTIONNAIRE_DELETE: 'questionnaire:delete',
    },
    can: vi.fn().mockResolvedValue(true),
    ensureAuthorization: vi.fn().mockResolvedValue({ userId: 'user-onp63', user: { id: 'user-onp63', memberships: [] } }),
}));

vi.mock('@/lib/metrics-calc', () => ({
    calculateCommonQuestionnaireMetrics: vi.fn().mockResolvedValue({ total: 10, mapped: 8, answered: 5, approved: 2, released: 1, noData: 0 }),
    calculateEngagementMetrics: vi.fn().mockResolvedValue({ total: 20, mapped: 15, answered: 10, approved: 3, released: 2, noData: 0 }),
    calculateQuestionnaireMetrics: vi.fn().mockResolvedValue({ total: 10, mapped: 8, answered: 5, approved: 2, released: 1, noData: 0 }),
}));

vi.mock('@/lib/metrics/question-state-metrics', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/metrics/question-state-metrics')>();
    return {
        ...actual,
        calculateCQQuestionStateMetrics: vi.fn(),
        calculateEngagementQuestionStateMetrics: vi.fn(),
        calculateQuestionStateMetricsForQuestions: vi.fn(),
    };
});

import {
    calculateCQQuestionStateMetrics,
    calculateEngagementQuestionStateMetrics,
    calculateQuestionStateMetricsForQuestions,
} from '@/lib/metrics/question-state-metrics';

const prismaMock = prisma as any;

describe('ONP-63 — Inner Page Metrics Contract & CQ Isolation', () => {
    const USER_ID = 'user-onp63';
    const CLIENT_LE_ID = 'le-alpha-id';
    const ENGAGEMENT_ID = 'eng-barclays-id';
    const Q1_ID = 'q-barclays-security';
    const Q2_ID = 'q-barclays-ops';
    const CQ1_ID = 'cq-standard-kyc';

    const q1Metrics: QuestionStateMetrics = {
        questionnairesCount: 1,
        total: 5,
        external: 2,
        userInput: 1,
        defaultResponse: 1,
        unanswered: 1,
    };

    const q2Metrics: QuestionStateMetrics = {
        questionnairesCount: 1,
        total: 4,
        external: 1,
        userInput: 2,
        defaultResponse: 0,
        unanswered: 1,
    };

    const engagementOwnMetrics: QuestionStateMetrics = {
        questionnairesCount: 2,
        total: 9,
        external: 3,
        userInput: 3,
        defaultResponse: 1,
        unanswered: 2,
    };

    const cq1Metrics: QuestionStateMetrics = {
        questionnairesCount: 1,
        total: 7,
        external: 4,
        userInput: 1,
        defaultResponse: 1,
        unanswered: 1,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({
            userId: USER_ID,
            email: 'tester@onpro.tech',
        } as any);

        prismaMock.membership.findMany.mockResolvedValue([
            {
                id: 'mem-1',
                userId: USER_ID,
                clientLEId: CLIENT_LE_ID,
                role: 'LE_ADMIN',
                organizationId: null,
                fiEngagementId: null,
            },
        ]);

        prismaMock.invitation.findMany.mockResolvedValue([]);
        prismaMock.user.findMany.mockResolvedValue([]);
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
        prismaMock.clientLERecord.findFirst.mockResolvedValue(null);
        prismaMock.masterSchema.findFirst.mockResolvedValue({ id: 'schema-1', isActive: true });
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);

        // Mock QuestionState metrics helpers
        vi.mocked(calculateEngagementQuestionStateMetrics).mockResolvedValue(engagementOwnMetrics);
        vi.mocked(calculateCQQuestionStateMetrics).mockResolvedValue(cq1Metrics);
        vi.mocked(calculateQuestionStateMetricsForQuestions).mockImplementation(async (questions: any) => {
            const qId = questions?.[0]?.questionnaireId;
            if (qId === Q1_ID) return q1Metrics;
            if (qId === Q2_ID) return q2Metrics;
            if (qId === CQ1_ID) return cq1Metrics;
            return {
                questionnairesCount: 1,
                total: questions.length,
                external: 0,
                userInput: 0,
                defaultResponse: 0,
                unanswered: questions.length,
            };
        });
    });

    describe('1. getEngagementDetails Contract', () => {
        it('returns v2Metrics on engagement and each questionnaire satisfying the canonical sum invariant', async () => {
            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                org: { id: 'fi-barclays', name: 'Barclays' },
                questionnaires: [],
                questionnaireInstances: [
                    { id: Q1_ID, name: 'Security Review', status: 'ACTIVE', mappings: null, dueDate: null, createdAt: new Date(), updatedAt: new Date() },
                    { id: Q2_ID, name: 'Operational Due Diligence', status: 'ACTIVE', mappings: null, dueDate: null, createdAt: new Date(), updatedAt: new Date() },
                ],
                sharedDocuments: [],
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Corp',
                    legalEntityId: 'le-entity-1',
                    customData: {},
                    commonQuestionnaires: [
                        { id: CQ1_ID, name: 'Global Common KYC', isDeleted: false },
                    ],
                },
            });

            prismaMock.question.findMany.mockImplementation(async ({ where }: any) => {
                const qId = where?.questionnaireId;
                if (qId === Q1_ID) {
                    return Array.from({ length: 5 }, (_, i) => ({ id: `q1-${i}`, questionnaireId: Q1_ID, answer: 'x' }));
                }
                if (qId === Q2_ID) {
                    return Array.from({ length: 4 }, (_, i) => ({ id: `q2-${i}`, questionnaireId: Q2_ID, answer: 'y' }));
                }
                return [];
            });

            const res = await getEngagementDetails(ENGAGEMENT_ID);
            expect(res.success).toBe(true);
            expect((res as any).v2Metrics).toBeDefined();
            expect(res.questionnaires).toHaveLength(2);
            expect((res.questionnaires[0] as any).v2Metrics).toBeDefined();
            expect((res.questionnaires[1] as any).v2Metrics).toBeDefined();

            // Part Invariant: total = external + userInput + defaultResponse + unanswered
            const engV2 = (res as any).v2Metrics!;
            expect(engV2.total).toBe(engV2.external + engV2.userInput + engV2.defaultResponse + engV2.unanswered);

            for (const q of res.questionnaires) {
                const qV2 = (q as any).v2Metrics!;
                expect(qV2.total).toBe(qV2.external + qV2.userInput + qV2.defaultResponse + qV2.unanswered);
            }

            // Relationship Child-Sum Invariant
            const childExternalSum = res.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.external, 0);
            const childUserInputSum = res.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.userInput, 0);
            const childDefaultSum = res.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.defaultResponse, 0);
            const childUnansweredSum = res.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.unanswered, 0);
            const childTotalSum = res.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.total, 0);

            expect(engV2.external).toBe(childExternalSum);
            expect(engV2.userInput).toBe(childUserInputSum);
            expect(engV2.defaultResponse).toBe(childDefaultSum);
            expect(engV2.unanswered).toBe(childUnansweredSum);
            expect(engV2.total).toBe(childTotalSum);
        });

        it('strictly enforces Common Questionnaire isolation on relationship question metrics', async () => {
            // Scenario A: Client LE has ZERO Common Questionnaires
            prismaMock.fIEngagement.findUnique.mockResolvedValueOnce({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                org: { id: 'fi-barclays', name: 'Barclays' },
                questionnaires: [],
                questionnaireInstances: [
                    { id: Q1_ID, name: 'Security Review', status: 'ACTIVE', mappings: null, dueDate: null, createdAt: new Date(), updatedAt: new Date() },
                ],
                sharedDocuments: [],
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Corp',
                    legalEntityId: 'le-entity-1',
                    customData: {},
                    commonQuestionnaires: [],
                },
            });

            prismaMock.question.findMany.mockImplementation(async ({ where }: any) => {
                if (where?.questionnaireId === Q1_ID) {
                    return Array.from({ length: 5 }, (_, i) => ({ id: `q1-${i}`, questionnaireId: Q1_ID }));
                }
                return [];
            });

            const resWithoutCQ = await getEngagementDetails(ENGAGEMENT_ID);

            // Scenario B: Client LE has 3 active Common Questionnaires with 50 questions
            prismaMock.fIEngagement.findUnique.mockResolvedValueOnce({
                id: ENGAGEMENT_ID,
                clientLEId: CLIENT_LE_ID,
                org: { id: 'fi-barclays', name: 'Barclays' },
                questionnaires: [],
                questionnaireInstances: [
                    { id: Q1_ID, name: 'Security Review', status: 'ACTIVE', mappings: null, dueDate: null, createdAt: new Date(), updatedAt: new Date() },
                ],
                sharedDocuments: [],
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Corp',
                    legalEntityId: 'le-entity-1',
                    customData: {},
                    commonQuestionnaires: [
                        { id: 'cq-1', name: 'CQ 1', isDeleted: false },
                        { id: 'cq-2', name: 'CQ 2', isDeleted: false },
                        { id: 'cq-3', name: 'CQ 3', isDeleted: false },
                    ],
                },
            });

            const resWithCQ = await getEngagementDetails(ENGAGEMENT_ID);

            // Adding/removing Common Questionnaires must NOT change the relationship's own metrics
            expect((resWithoutCQ as any).v2Metrics).toEqual((resWithCQ as any).v2Metrics);
            expect((resWithoutCQ.questionnaires[0] as any).v2Metrics).toEqual((resWithCQ.questionnaires[0] as any).v2Metrics);
        });
    });

    describe('2. getClientLEData Contract', () => {
        it('returns v2Metrics on commonQuestionnaires, fiEngagements, and child questionnaires', async () => {
            prismaMock.clientLE.findUnique.mockResolvedValue({
                id: CLIENT_LE_ID,
                name: 'Alpha Corp',
                legalEntityId: 'le-entity-1',
                customData: {},
                commonQuestionnaires: [
                    { id: CQ1_ID, name: 'Global Common KYC', isDeleted: false },
                ],
                fiEngagements: [
                    {
                        id: ENGAGEMENT_ID,
                        clientLEId: CLIENT_LE_ID,
                        org: { id: 'fi-barclays', name: 'Barclays' },
                        questionnaires: [],
                        questionnaireInstances: [
                            { id: Q1_ID, name: 'Security Review', isDeleted: false },
                            { id: Q2_ID, name: 'Operational Due Diligence', isDeleted: false },
                        ],
                    },
                ],
            });

            prismaMock.question.findMany.mockImplementation(async ({ where }: any) => {
                const qId = where?.questionnaireId;
                if (qId === Q1_ID) return Array.from({ length: 5 }, (_, i) => ({ id: `q1-${i}`, questionnaireId: Q1_ID }));
                if (qId === Q2_ID) return Array.from({ length: 4 }, (_, i) => ({ id: `q2-${i}`, questionnaireId: Q2_ID }));
                if (qId === CQ1_ID) return Array.from({ length: 7 }, (_, i) => ({ id: `cq1-${i}`, questionnaireId: CQ1_ID }));
                return [];
            });

            const data = await getClientLEData(CLIENT_LE_ID);
            expect(data).not.toBeNull();
            const { le } = data!;

            // Common Questionnaire v2Metrics
            expect(le.commonQuestionnaires).toHaveLength(1);
            const cq = le.commonQuestionnaires[0] as any;
            expect(cq.v2Metrics).toBeDefined();
            expect(cq.v2Metrics.total).toBe(
                cq.v2Metrics.external + cq.v2Metrics.userInput + cq.v2Metrics.defaultResponse + cq.v2Metrics.unanswered
            );

            // Relationship v2Metrics
            expect(le.fiEngagements).toHaveLength(1);
            const eng = le.fiEngagements[0] as any;
            expect(eng.v2Metrics).toBeDefined();
            expect(eng.v2Metrics.total).toBe(
                eng.v2Metrics.external + eng.v2Metrics.userInput + eng.v2Metrics.defaultResponse + eng.v2Metrics.unanswered
            );

            // Child questionnaires v2Metrics
            expect(eng.questionnaires).toHaveLength(2);
            for (const q of eng.questionnaires) {
                expect(q.v2Metrics).toBeDefined();
                expect(q.v2Metrics.total).toBe(
                    q.v2Metrics.external + q.v2Metrics.userInput + q.v2Metrics.defaultResponse + q.v2Metrics.unanswered
                );
            }

            // Relationship child-sum invariant
            expect(eng.v2Metrics.external).toBe(
                eng.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.external, 0)
            );
            expect(eng.v2Metrics.total).toBe(
                eng.questionnaires.reduce((sum: number, q: any) => sum + q.v2Metrics.total, 0)
            );
        });
    });
});
