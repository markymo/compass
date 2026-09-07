import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserContexts } from '@/actions/dashboard';
import { reshapeContexts } from '@/components/dashboard/dashboard-tree';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { calculateEngagementOwnMetrics, calculateCommonQuestionnaireMetrics } from '@/lib/metrics-calc';
import { calculateCQQuestionStateMetrics, calculateEngagementQuestionStateMetrics } from '@/lib/metrics/question-state-metrics';

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

describe('Dashboard Authorization & Structural vs Operational Visibility Suite', () => {
    const USER_ID = 'user-test-auth-1';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: 'tester@coparity.com' } as any);

        vi.mocked(calculateEngagementOwnMetrics).mockResolvedValue({
            total: 10,
            mapped: 8,
            answered: 6,
            approved: 4,
            released: 2,
            noData: 0,
        });

        vi.mocked(calculateCommonQuestionnaireMetrics).mockResolvedValue({
            total: 20,
            mapped: 15,
            answered: 12,
            approved: 10,
            released: 5,
            noData: 0,
        });

        vi.mocked(calculateCQQuestionStateMetrics).mockResolvedValue({
            questionnairesCount: 1,
            total: 20,
            external: 5,
            userInput: 10,
            defaultResponse: 3,
            unanswered: 2,
        });

        vi.mocked(calculateEngagementQuestionStateMetrics).mockResolvedValue({
            questionnairesCount: 1,
            total: 10,
            external: 2,
            userInput: 5,
            defaultResponse: 2,
            unanswered: 1,
        });
    });

    describe('1. Client ORG_ADMIN only (Structural Visibility)', () => {
        it('sees Client organisation and names of owned LEs with structural role, but NO CQs, NO relationships, and ZERO metrics', async () => {
            const CLIENT_ORG_ID = 'client-org-1';
            const LE_A_ID = 'le-alpha';
            const LE_B_ID = 'le-beta';

            // User has ONLY Client ORG_ADMIN
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-org-admin',
                    userId: USER_ID,
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: {
                        id: CLIENT_ORG_ID,
                        name: 'Acme Holdings Ltd',
                        types: ['CLIENT'],
                    },
                    clientLE: null,
                    fiEngagement: null,
                }
            ] as any);

            // Client LEs owned by Acme Holdings
            vi.mocked(prisma.clientLE.findMany).mockResolvedValue([
                {
                    id: LE_A_ID,
                    name: 'Acme Operations UK',
                    gleifData: null,
                    owners: [{ party: { name: 'Acme Holdings Ltd' } }],
                },
                {
                    id: LE_B_ID,
                    name: 'Acme Europe BV',
                    gleifData: null,
                    owners: [{ party: { name: 'Acme Holdings Ltd' } }],
                }
            ] as any);

            const ctx = await getUserContexts();

            // 1. Client org is returned with DIRECT source and empty metrics
            expect(ctx.clients).toHaveLength(1);
            expect(ctx.clients[0].id).toBe(CLIENT_ORG_ID);
            expect(ctx.clients[0].role).toBe('ORG_ADMIN');
            expect(ctx.clients[0].metrics.total).toBe(0);
            expect(ctx.clients[0].v2Metrics?.total).toBe(0);

            // 2. Both owned LEs appear for structural management with role ADMIN_VISIBILITY
            expect(ctx.legalEntities).toHaveLength(2);
            expect(ctx.legalEntities.map(l => l.name)).toEqual(['Acme Operations UK', 'Acme Europe BV']);
            expect(ctx.legalEntities.every(l => l.role === 'ADMIN_VISIBILITY')).toBe(true);

            // 3. Operational isolation: NO Common Questionnaires, NO relationships, and ZERO metrics
            expect(ctx.legalEntities[0].commonQuestionnaires).toEqual([]);
            expect(ctx.legalEntities[0].metrics.total).toBe(0);
            expect(ctx.legalEntities[0].v2Metrics?.total).toBe(0);

            expect(ctx.legalEntities[1].commonQuestionnaires).toEqual([]);
            expect(ctx.legalEntities[1].metrics.total).toBe(0);
            expect(ctx.legalEntities[1].v2Metrics?.total).toBe(0);

            expect(ctx.relationships).toEqual([]);

            // 4. Metric calculators were NEVER called for non-operational scopes
            expect(calculateCommonQuestionnaireMetrics).not.toHaveBeenCalled();
            expect(calculateEngagementOwnMetrics).not.toHaveBeenCalled();

            // 5. Tree reshaping gives href="#" for structural-only LEs and no children
            const nodes = reshapeContexts(ctx);
            expect(nodes).toHaveLength(1);
            expect(nodes[0].children).toHaveLength(2);
            expect(nodes[0].children[0].href).toBe('#');
            expect(nodes[0].children[0].children).toHaveLength(0);
        });
    });

    describe('2. Client ORG_MEMBER only', () => {
        it('sees only basic organization association, with NO LEs, NO relationships, and NO metrics', async () => {
            const CLIENT_ORG_ID = 'client-org-1';

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-org-member',
                    userId: USER_ID,
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_MEMBER',
                    organization: {
                        id: CLIENT_ORG_ID,
                        name: 'Acme Holdings Ltd',
                        types: ['CLIENT'],
                    },
                    clientLE: null,
                    fiEngagement: null,
                }
            ] as any);

            const ctx = await getUserContexts();

            expect(ctx.clients).toHaveLength(1);
            expect(ctx.clients[0].role).toBe('ORG_MEMBER');
            expect(ctx.legalEntities).toHaveLength(0);
            expect(ctx.relationships).toHaveLength(0);
            expect(ctx.clients[0].metrics.total).toBe(0);

            const nodes = reshapeContexts(ctx);
            expect(nodes[0].children).toHaveLength(0);
        });
    });

    describe('3. LE_ADMIN on LE A only', () => {
        it('sees LE A with operational metrics, CQs, and relationships, but does NOT see unrelated LE B', async () => {
            const CLIENT_ORG_ID = 'client-org-1';
            const LE_A_ID = 'le-alpha';
            const ENG_1_ID = 'eng-1';

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-le-admin-a',
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: LE_A_ID,
                    fiEngagementId: null,
                    role: 'LE_ADMIN',
                    organization: null,
                    clientLE: {
                        id: LE_A_ID,
                        name: 'Acme Operations UK',
                        isDeleted: false,
                        status: 'ACTIVE',
                        owners: [{ partyId: CLIENT_ORG_ID, party: { id: CLIENT_ORG_ID, name: 'Acme Holdings Ltd' } }],
                    },
                    fiEngagement: null,
                }
            ] as any);

            // CQ for LE A
            vi.mocked(prisma.clientLE.findMany).mockResolvedValue([
                {
                    id: LE_A_ID,
                    commonQuestionnaires: [
                        { id: 'cq-1', name: 'Global KYC Template', status: 'IN_PROGRESS', updatedAt: new Date() }
                    ]
                }
            ] as any);

            // Engagement for LE A
            vi.mocked(prisma.fIEngagement.findMany).mockResolvedValue([
                {
                    id: ENG_1_ID,
                    clientLEId: LE_A_ID,
                    fiOrgId: 'fi-barclays',
                    status: 'ACTIVE',
                    isDeleted: false,
                    org: { id: 'fi-barclays', name: 'Barclays Corporate' },
                    clientLE: {
                        id: LE_A_ID,
                        name: 'Acme Operations UK',
                        owners: [{ partyId: CLIENT_ORG_ID, party: { id: CLIENT_ORG_ID, name: 'Acme Holdings Ltd' } }]
                    },
                    questionnaireInstances: []
                }
            ] as any);

            const ctx = await getUserContexts();

            // Only LE A is present
            expect(ctx.legalEntities).toHaveLength(1);
            expect(ctx.legalEntities[0].id).toBe(LE_A_ID);
            expect(ctx.legalEntities[0].role).toBe('LE_ADMIN');
            expect(ctx.legalEntities[0].commonQuestionnaires).toHaveLength(1);
            expect(ctx.legalEntities[0].metrics.total).toBe(30); // 20 from CQ + 10 from engagement

            // Relationships returned for LE A
            expect(ctx.relationships).toHaveLength(1);
            expect(ctx.relationships[0].id).toBe(ENG_1_ID);
            expect(ctx.relationships[0].userIsClient).toBe(true);

            // Parent org metrics rolled up from LE A
            expect(ctx.clients).toHaveLength(1);
            expect(ctx.clients[0].source).toBe('DERIVED');
            expect(ctx.clients[0].metrics.total).toBe(30);

            // Tree reshaping gives operational href
            const nodes = reshapeContexts(ctx);
            expect(nodes[0].children[0].href).toBe(`/app/le/${LE_A_ID}`);
            expect(nodes[0].children[0].children).toHaveLength(2); // 1 CQ group + 1 engagement
        });
    });

    describe('4. Mixed Role: ORG_ADMIN on Client Org + LE_ADMIN on LE A', () => {
        it('shows all owned LEs structurally, but operational details and metrics only for LE A (not LE B)', async () => {
            const CLIENT_ORG_ID = 'client-org-1';
            const LE_A_ID = 'le-alpha';
            const LE_B_ID = 'le-beta';
            const ENG_A_ID = 'eng-a';

            // User has ORG_ADMIN on Client Org AND LE_ADMIN on LE A
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-org-admin',
                    userId: USER_ID,
                    organizationId: CLIENT_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: {
                        id: CLIENT_ORG_ID,
                        name: 'Acme Holdings Ltd',
                        types: ['CLIENT'],
                    },
                    clientLE: null,
                    fiEngagement: null,
                },
                {
                    id: 'mem-le-admin-a',
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: LE_A_ID,
                    fiEngagementId: null,
                    role: 'LE_ADMIN',
                    organization: null,
                    clientLE: {
                        id: LE_A_ID,
                        name: 'Acme Operations UK',
                        isDeleted: false,
                        status: 'ACTIVE',
                        owners: [{ partyId: CLIENT_ORG_ID, party: { id: CLIENT_ORG_ID, name: 'Acme Holdings Ltd' } }],
                    },
                    fiEngagement: null,
                }
            ] as any);

            // Structural query for Client ORG_ADMIN returns both LE A and LE B
            vi.mocked(prisma.clientLE.findMany)
                .mockImplementation(async (args: any) => {
                    if (args?.where?.owners) {
                        return [
                            {
                                id: LE_A_ID,
                                name: 'Acme Operations UK',
                                gleifData: null,
                                owners: [{ party: { name: 'Acme Holdings Ltd' } }],
                            },
                            {
                                id: LE_B_ID,
                                name: 'Acme Europe BV',
                                gleifData: null,
                                owners: [{ party: { name: 'Acme Holdings Ltd' } }],
                            }
                        ] as any;
                    }
                    if (args?.where?.id?.in) {
                        // Operational CQs query: should ONLY be called for LE_A_ID!
                        expect(args.where.id.in).toEqual([LE_A_ID]);
                        expect(args.where.id.in).not.toContain(LE_B_ID);
                        return [
                            {
                                id: LE_A_ID,
                                commonQuestionnaires: [
                                    { id: 'cq-1', name: 'Global KYC Template', status: 'IN_PROGRESS', updatedAt: new Date() }
                                ]
                            }
                        ] as any;
                    }
                    return [];
                });

            // Engagements query: should ONLY be called for LE A!
            vi.mocked(prisma.fIEngagement.findMany).mockImplementation(async (args: any) => {
                const orConds = args.where.OR;
                const clientLECond = orConds.find((c: any) => c.clientLEId);
                expect(clientLECond.clientLEId.in).toEqual([LE_A_ID]);
                expect(clientLECond.clientLEId.in).not.toContain(LE_B_ID);

                return [
                    {
                        id: ENG_A_ID,
                        clientLEId: LE_A_ID,
                        fiOrgId: 'fi-barclays',
                        status: 'ACTIVE',
                        isDeleted: false,
                        org: { id: 'fi-barclays', name: 'Barclays Corporate' },
                        clientLE: {
                            id: LE_A_ID,
                            name: 'Acme Operations UK',
                            owners: [{ partyId: CLIENT_ORG_ID, party: { id: CLIENT_ORG_ID, name: 'Acme Holdings Ltd' } }]
                        },
                        questionnaireInstances: []
                    }
                ] as any;
            });

            const ctx = await getUserContexts();

            // 1. Both LEs are present in legalEntities
            expect(ctx.legalEntities).toHaveLength(2);

            const leA = ctx.legalEntities.find(l => l.id === LE_A_ID)!;
            const leB = ctx.legalEntities.find(l => l.id === LE_B_ID)!;

            // LE A has operational role, metrics, CQs
            expect(leA.role).toBe('LE_ADMIN');
            expect(leA.metrics.total).toBe(30);
            expect(leA.commonQuestionnaires).toHaveLength(1);

            // LE B is structural only (ADMIN_VISIBILITY) with NO CQs, NO metrics
            expect(leB.role).toBe('ADMIN_VISIBILITY');
            expect(leB.metrics.total).toBe(0);
            expect(leB.commonQuestionnaires).toEqual([]);

            // 2. Client Org totals include operational metrics ONLY from LE A (total = 30, not 60)
            expect(ctx.clients[0].metrics.total).toBe(30);

            // 3. Reshape tree: LE A is clickable, LE B is non-clickable
            const nodes = reshapeContexts(ctx);
            const childA = nodes[0].children.find(c => c.id === LE_A_ID)!;
            const childB = nodes[0].children.find(c => c.id === LE_B_ID)!;

            expect(childA.href).toBe(`/app/le/${LE_A_ID}`);
            expect(childA.children).toHaveLength(2); // CQs + relationship

            expect(childB.href).toBe('#');
            expect(childB.children).toHaveLength(0);
        });
    });

    describe('5. Supplier ORG_ADMIN only', () => {
        it('sees Supplier organisation structurally, but NO relationships, NO relationship counts, and ZERO metrics', async () => {
            const SUPPLIER_ORG_ID = 'fi-barclays';

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-supplier-org-admin',
                    userId: USER_ID,
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                    organization: {
                        id: SUPPLIER_ORG_ID,
                        name: 'Barclays Corporate',
                        types: ['FI'],
                    },
                    clientLE: null,
                    fiEngagement: null,
                }
            ] as any);

            const ctx = await getUserContexts();

            expect(ctx.financialInstitutions).toHaveLength(1);
            expect(ctx.financialInstitutions[0].id).toBe(SUPPLIER_ORG_ID);
            expect(ctx.financialInstitutions[0].role).toBe('ORG_ADMIN');
            expect(ctx.financialInstitutions[0].metrics.total).toBe(0);
            expect(ctx.financialInstitutions[0].v2Metrics?.total).toBe(0);

            // Crucial: NO customer relationships returned
            expect(ctx.relationships).toEqual([]);
            expect(prisma.fIEngagement.findMany).not.toHaveBeenCalled();

            const nodes = reshapeContexts(ctx);
            expect(nodes).toHaveLength(1);
            expect(nodes[0].children).toHaveLength(0);
            expect(nodes[0].metrics.total).toBe(0);
        });
    });

    describe('6. Supplier ORG_MEMBER only', () => {
        it('sees Supplier organisation association only and NO operational relationships', async () => {
            const SUPPLIER_ORG_ID = 'fi-barclays';

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-supplier-org-member',
                    userId: USER_ID,
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: null,
                    role: 'ORG_MEMBER',
                    organization: {
                        id: SUPPLIER_ORG_ID,
                        name: 'Barclays Corporate',
                        types: ['FI'],
                    },
                    clientLE: null,
                    fiEngagement: null,
                }
            ] as any);

            const ctx = await getUserContexts();

            expect(ctx.financialInstitutions).toHaveLength(1);
            expect(ctx.financialInstitutions[0].role).toBe('ORG_MEMBER');
            expect(ctx.relationships).toEqual([]);
            expect(prisma.fIEngagement.findMany).not.toHaveBeenCalled();

            const nodes = reshapeContexts(ctx);
            expect(nodes[0].children).toHaveLength(0);
        });
    });

    describe('7. RELATIONSHIP_ADMIN and RELATIONSHIP_USER explicit isolation', () => {
        it('RELATIONSHIP_ADMIN on Engagement X sees X, but does NOT see Engagement Y', async () => {
            const SUPPLIER_ORG_ID = 'fi-barclays';
            const ENG_X_ID = 'eng-x';

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-rel-admin-x',
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: null,
                    fiEngagementId: ENG_X_ID,
                    role: 'RELATIONSHIP_ADMIN',
                    organization: null,
                    clientLE: null,
                    fiEngagement: {
                        id: ENG_X_ID,
                        isDeleted: false,
                        org: { id: SUPPLIER_ORG_ID, name: 'Barclays Corporate' },
                    },
                }
            ] as any);

            vi.mocked(prisma.fIEngagement.findMany).mockImplementation(async (args: any) => {
                // Must query ONLY engagement X
                const orConds = args.where.OR;
                const idCond = orConds.find((c: any) => c.id);
                expect(idCond.id.in).toEqual([ENG_X_ID]);

                return [
                    {
                        id: ENG_X_ID,
                        clientLEId: 'le-alpha',
                        fiOrgId: SUPPLIER_ORG_ID,
                        status: 'ACTIVE',
                        isDeleted: false,
                        org: { id: SUPPLIER_ORG_ID, name: 'Barclays Corporate' },
                        clientLE: {
                            id: 'le-alpha',
                            name: 'Acme Operations UK',
                            owners: [{ partyId: 'client-org-1', party: { id: 'client-org-1', name: 'Acme Holdings Ltd' } }]
                        },
                        questionnaireInstances: [
                            { id: 'q-inst-1', name: 'Supplier Questionnaire', status: 'SHARED', updatedAt: new Date() }
                        ]
                    }
                ] as any;
            });

            const ctx = await getUserContexts();

            expect(ctx.financialInstitutions).toHaveLength(1);
            expect(ctx.financialInstitutions[0].id).toBe(SUPPLIER_ORG_ID);
            expect(ctx.financialInstitutions[0].metrics.total).toBe(10);

            expect(ctx.relationships).toHaveLength(1);
            expect(ctx.relationships[0].id).toBe(ENG_X_ID);
            expect(ctx.relationships[0].userIsSupplier).toBe(true);

            const nodes = reshapeContexts(ctx);
            expect(nodes[0].children).toHaveLength(1); // 1 client node
            expect(nodes[0].children[0].children).toHaveLength(1); // 1 engagement (X)
            expect(nodes[0].children[0].children[0].id).toBe(ENG_X_ID);
        });

        it('RELATIONSHIP_USER on Engagement X sees X, but does NOT see Engagement Y', async () => {
            const SUPPLIER_ORG_ID = 'fi-barclays';
            const ENG_X_ID = 'eng-x';

            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-rel-user-x',
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: null,
                    fiEngagementId: ENG_X_ID,
                    role: 'RELATIONSHIP_USER',
                    organization: null,
                    clientLE: null,
                    fiEngagement: {
                        id: ENG_X_ID,
                        isDeleted: false,
                        org: { id: SUPPLIER_ORG_ID, name: 'Barclays Corporate' },
                    },
                }
            ] as any);

            vi.mocked(prisma.fIEngagement.findMany).mockResolvedValue([
                {
                    id: ENG_X_ID,
                    clientLEId: 'le-alpha',
                    fiOrgId: SUPPLIER_ORG_ID,
                    status: 'ACTIVE',
                    isDeleted: false,
                    org: { id: SUPPLIER_ORG_ID, name: 'Barclays Corporate' },
                    clientLE: {
                        id: 'le-alpha',
                        name: 'Acme Operations UK',
                        owners: [{ partyId: 'client-org-1', party: { id: 'client-org-1', name: 'Acme Holdings Ltd' } }]
                    },
                    questionnaireInstances: []
                }
            ] as any);

            const ctx = await getUserContexts();
            expect(ctx.relationships).toHaveLength(1);
            expect(ctx.relationships[0].id).toBe(ENG_X_ID);
            expect(ctx.relationships[0].userIsSupplier).toBe(true);
        });
    });

    describe('8. Regression Check: Relationship membership carrying Supplier organizationId', () => {
        it('does NOT allow relationship membership organizationId to leak other engagements under Supplier A', async () => {
            const SUPPLIER_ORG_ID = 'fi-supplier-a';
            const ENG_X_ID = 'eng-assigned-x';
            const ENG_Y_ID = 'eng-unassigned-y';

            // Membership has BOTH organizationId = Supplier A AND fiEngagementId = X
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-rel-user-with-orgid',
                    userId: USER_ID,
                    organizationId: SUPPLIER_ORG_ID,
                    clientLEId: null,
                    fiEngagementId: ENG_X_ID,
                    role: 'RELATIONSHIP_USER',
                    organization: {
                        id: SUPPLIER_ORG_ID,
                        name: 'Supplier Alpha Financial',
                        types: ['FI'],
                    },
                    clientLE: null,
                    fiEngagement: {
                        id: ENG_X_ID,
                        isDeleted: false,
                        org: { id: SUPPLIER_ORG_ID, name: 'Supplier Alpha Financial' },
                    },
                }
            ] as any);

            vi.mocked(prisma.fIEngagement.findMany).mockImplementation(async (args: any) => {
                // Must NOT query by { fiOrgId: in [SUPPLIER_ORG_ID] }
                const orConds = args.where.OR;
                const fiOrgCond = orConds.find((c: any) => c.fiOrgId);
                expect(fiOrgCond).toBeUndefined(); // fiOrgId query must not exist!

                const idCond = orConds.find((c: any) => c.id);
                expect(idCond.id.in).toEqual([ENG_X_ID]);
                expect(idCond.id.in).not.toContain(ENG_Y_ID);

                return [
                    {
                        id: ENG_X_ID,
                        clientLEId: 'le-alpha',
                        fiOrgId: SUPPLIER_ORG_ID,
                        status: 'ACTIVE',
                        isDeleted: false,
                        org: { id: SUPPLIER_ORG_ID, name: 'Supplier Alpha Financial' },
                        clientLE: {
                            id: 'le-alpha',
                            name: 'Acme Operations UK',
                            owners: [{ partyId: 'client-org-1', party: { id: 'client-org-1', name: 'Acme Holdings Ltd' } }]
                        },
                        questionnaireInstances: []
                    }
                ] as any;
            });

            const ctx = await getUserContexts();

            // Returns ONLY Engagement X
            expect(ctx.relationships).toHaveLength(1);
            expect(ctx.relationships[0].id).toBe(ENG_X_ID);
            expect(ctx.relationships.map(r => r.id)).not.toContain(ENG_Y_ID);
        });
    });
});
