import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserContexts } from '@/actions/dashboard';
import { reshapeContexts } from '@/components/dashboard/dashboard-tree';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { calculateEngagementOwnMetrics, calculateCommonQuestionnaireMetrics } from '@/lib/metrics-calc';
import {
    calculateCQQuestionStateMetrics,
    calculateEngagementQuestionStateMetrics,
} from '@/lib/metrics/question-state-metrics';

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: {
            findMany: vi.fn(),
        },
        clientLE: {
            findMany: vi.fn(),
        },
        fIEngagement: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('@/lib/metrics-calc', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/metrics-calc')>();
    return {
        ...actual,
        calculateEngagementOwnMetrics: vi.fn(),
        calculateCommonQuestionnaireMetrics: vi.fn(),
    };
});

vi.mock('@/lib/metrics/question-state-metrics', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/metrics/question-state-metrics')>();
    return {
        ...actual,
        calculateCQQuestionStateMetrics: vi.fn(),
        calculateEngagementQuestionStateMetrics: vi.fn(),
    };
});

describe('ONP-63 — Homepage Questionnaire Counting Contract', () => {
    const USER_ID = 'user-onp63-test';
    const CLIENT_ORG_ID = 'client-org-acme';
    const CLIENT_LE_ID = 'le-alpha-id';
    const REL_BARCLAYS_ID = 'rel-barclays-id';
    const REL_RISKBRIDGE_ID = 'rel-riskbridge-id';

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(getIdentity).mockResolvedValue({
            userId: USER_ID,
            email: 'tester@onpro.tech',
        } as any);

        // Legacy metric calculators mocked cleanly
        vi.mocked(calculateCommonQuestionnaireMetrics).mockResolvedValue({
            total: 4,
            mapped: 3,
            answered: 2,
            approved: 1,
            released: 1,
            noData: 0,
        });

        vi.mocked(calculateEngagementOwnMetrics).mockImplementation(async (engagementId: string) => {
            if (engagementId === REL_BARCLAYS_ID) {
                return { total: 2, mapped: 2, answered: 2, approved: 1, released: 1, noData: 0 };
            }
            if (engagementId === REL_RISKBRIDGE_ID) {
                return { total: 3, mapped: 1, answered: 1, approved: 0, released: 0, noData: 0 };
            }
            return { total: 0, mapped: 0, answered: 0, approved: 0, released: 0, noData: 0 };
        });

        // Deterministic V2 QuestionStateMetrics fixture:
        // Common Questionnaire: total = 4 (1 external + 1 userInput + 1 defaultResponse + 1 unanswered)
        vi.mocked(calculateCQQuestionStateMetrics).mockResolvedValue({
            questionnairesCount: 1,
            total: 4,
            external: 1,
            userInput: 1,
            defaultResponse: 1,
            unanswered: 1,
        });

        // Relationship A (Barclays): total = 2 (1 external + 1 userInput + 0 defaultResponse + 0 unanswered)
        // Relationship B (Riskbridge): total = 3 (0 external + 0 userInput + 1 defaultResponse + 2 unanswered)
        vi.mocked(calculateEngagementQuestionStateMetrics).mockImplementation(async (engagementId: string) => {
            if (engagementId === REL_BARCLAYS_ID) {
                return {
                    questionnairesCount: 1,
                    total: 2,
                    external: 1,
                    userInput: 1,
                    defaultResponse: 0,
                    unanswered: 0,
                };
            }
            if (engagementId === REL_RISKBRIDGE_ID) {
                return {
                    questionnairesCount: 1,
                    total: 3,
                    external: 0,
                    userInput: 0,
                    defaultResponse: 1,
                    unanswered: 2,
                };
            }
            return {
                questionnairesCount: 0,
                total: 0,
                external: 0,
                userInput: 0,
                defaultResponse: 0,
                unanswered: 0,
            };
        });

        // Database mocks: 1 ClientLE with operational access (LE_ADMIN)
        vi.mocked(prisma.membership.findMany).mockResolvedValue([
            {
                id: 'mem-le-admin-alpha',
                userId: USER_ID,
                organizationId: null,
                clientLEId: CLIENT_LE_ID,
                fiEngagementId: null,
                role: 'LE_ADMIN',
                organization: null,
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Operations UK',
                    isDeleted: false,
                    status: 'ACTIVE',
                    owners: [
                        {
                            partyId: CLIENT_ORG_ID,
                            party: { id: CLIENT_ORG_ID, name: 'Acme Holdings' },
                        },
                    ],
                },
                fiEngagement: null,
            },
        ] as any);

        // Common Questionnaires for ClientLE Alpha (1 CQ)
        vi.mocked(prisma.clientLE.findMany).mockResolvedValue([
            {
                id: CLIENT_LE_ID,
                commonQuestionnaires: [
                    {
                        id: 'cq-global-diligence',
                        name: 'Global KYC Template',
                        status: 'IN_PROGRESS',
                        updatedAt: new Date('2026-09-01'),
                    },
                ],
            },
        ] as any);

        // Engagements for ClientLE Alpha (Barclays + Riskbridge)
        vi.mocked(prisma.fIEngagement.findMany).mockResolvedValue([
            {
                id: REL_BARCLAYS_ID,
                clientLEId: CLIENT_LE_ID,
                fiOrgId: 'fi-barclays-org',
                status: 'ACTIVE',
                isDeleted: false,
                org: { id: 'fi-barclays-org', name: 'Barclays' },
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Operations UK',
                    owners: [
                        {
                            partyId: CLIENT_ORG_ID,
                            party: { id: CLIENT_ORG_ID, name: 'Acme Holdings' },
                        },
                    ],
                },
                questionnaireInstances: [],
            },
            {
                id: REL_RISKBRIDGE_ID,
                clientLEId: CLIENT_LE_ID,
                fiOrgId: 'fi-riskbridge-org',
                status: 'ACTIVE',
                isDeleted: false,
                org: { id: 'fi-riskbridge-org', name: 'Riskbridge' },
                clientLE: {
                    id: CLIENT_LE_ID,
                    name: 'Alpha Operations UK',
                    owners: [
                        {
                            partyId: CLIENT_ORG_ID,
                            party: { id: CLIENT_ORG_ID, name: 'Acme Holdings' },
                        },
                    ],
                },
                questionnaireInstances: [],
            },
        ] as any);
    });

    it('asserts Client Home counting contract and hierarchy invariants', async () => {
        // Execute real Home pipeline: getUserContexts() -> reshapeContexts()
        const ctx = await getUserContexts();
        const nodes = reshapeContexts(ctx);

        // Find the ClientLE node and its children in the reshaped tree
        expect(nodes).toHaveLength(1);
        const clientOrgNode = nodes[0];
        const leNode = clientOrgNode.children.find((c) => c.id === CLIENT_LE_ID);
        expect(leNode).toBeDefined();
        if (!leNode) return;

        const leChildren = leNode.children || [];
        const cqRow = leChildren.find((c) => c.type === 'questionnaire');
        const barclaysRow = leChildren.find((c) => c.id === REL_BARCLAYS_ID);
        const riskbridgeRow = leChildren.find((c) => c.id === REL_RISKBRIDGE_ID);

        expect(cqRow).toBeDefined();
        expect(barclaysRow).toBeDefined();
        expect(riskbridgeRow).toBeDefined();

        const leMetrics = leNode.v2Metrics!;
        const cqMetrics = cqRow!.v2Metrics!;
        const barclaysMetrics = barclaysRow!.v2Metrics!;
        const riskbridgeMetrics = riskbridgeRow!.v2Metrics!;

        expect(leMetrics).toBeDefined();
        expect(cqMetrics).toBeDefined();
        expect(barclaysMetrics).toBeDefined();
        expect(riskbridgeMetrics).toBeDefined();

        // Print debug diagnostics for inspection
        console.log('ACTUAL CLIENT_LE METRICS:', leMetrics);
        console.log('ACTUAL CQ METRICS:', cqMetrics);
        console.log('ACTUAL BARCLAYS METRICS:', barclaysMetrics);
        console.log('ACTUAL RISKBRIDGE METRICS:', riskbridgeMetrics);

        // --- 1. ClientLE row contract ---
        expect(leMetrics).toEqual({
            questionnairesCount: 3,
            total: 9,
            external: 2,
            userInput: 2,
            defaultResponse: 2,
            unanswered: 3,
        });

        // --- 2. Common Questionnaires row contract ---
        expect(cqMetrics).toEqual({
            questionnairesCount: 1,
            total: 4,
            external: 1,
            userInput: 1,
            defaultResponse: 1,
            unanswered: 1,
        });

        // --- 3. Barclays Relationship row: must contain RELATIONSHIP-OWN metrics only ---
        expect(barclaysMetrics).toEqual({
            questionnairesCount: 1,
            total: 2,
            external: 1,
            userInput: 1,
            defaultResponse: 0,
            unanswered: 0,
        });

        // --- 4. Riskbridge Relationship row: must contain RELATIONSHIP-OWN metrics only ---
        expect(riskbridgeMetrics).toEqual({
            questionnairesCount: 1,
            total: 3,
            external: 0,
            userInput: 0,
            defaultResponse: 1,
            unanswered: 2,
        });

        // --- 5. Strong hierarchy invariant: ClientLE metric = CQ metric + Barclays metric + Riskbridge metric ---
        const metricKeys = [
            'questionnairesCount',
            'total',
            'external',
            'userInput',
            'defaultResponse',
            'unanswered',
        ] as const;

        for (const key of metricKeys) {
            const expectedSum = cqMetrics[key] + barclaysMetrics[key] + riskbridgeMetrics[key];
            expect(leMetrics[key], `Child-sum hierarchy invariant violated for metric "${key}"`).toBe(expectedSum);
        }

        // --- 6. Per-row answer invariant: total = external + userInput + defaultResponse + unanswered ---
        const rows = [
            { name: 'ClientLE', m: leMetrics },
            { name: 'Common Questionnaires', m: cqMetrics },
            { name: 'Barclays', m: barclaysMetrics },
            { name: 'Riskbridge', m: riskbridgeMetrics },
        ];

        for (const { name, m } of rows) {
            const sumParts = m.external + m.userInput + m.defaultResponse + m.unanswered;
            expect(m.total, `Per-row answer invariant violated for "${name}" (total != sum of parts)`).toBe(sumParts);
        }
    });
});
