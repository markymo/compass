import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { getFIWorkbenchData, getSupplierRelationshipsSummary, getFIDashboardStats } from '../fi';
import { can, Action, Role, UserWithMemberships } from '@/lib/auth/permissions';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        organization: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
        clientLE: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
        clientLEOwner: { findMany: vi.fn() },
        fIEngagement: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        invitation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
        questionnaire: { findMany: vi.fn(), count: vi.fn() },
        question: { findMany: vi.fn() },
        query: { count: vi.fn() },
        user: { findUnique: vi.fn() },
        usageLog: { create: vi.fn() },
        clientLERecord: { findFirst: vi.fn() },
        document: { findMany: vi.fn() },
        questionnaireSubmission: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGroup: { findMany: vi.fn().mockResolvedValue([]) },
        masterField: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldDefinition: { findMany: vi.fn().mockResolvedValue([]) },
        $transaction: vi.fn((fn: any) => (typeof fn === 'function' ? fn(mockPrisma) : Promise.all(fn))),
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

const prismaMock = prisma as any;

describe('ONP-170 — Supplier Org Admin Permissions & Relationship Boundary', () => {
    const SUPPLIER_ORG_ID = 'supplier-org-1';
    const FOREIGN_SUPPLIER_ORG_ID = 'supplier-org-foreign';
    const CLIENT_ORG_ID = 'client-org-1';
    const CLIENT_LE_ID = 'client-le-1';
    const ENGAGEMENT_ID = 'eng-1';
    const FOREIGN_ENGAGEMENT_ID = 'eng-foreign-1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. FR-07 Security Defect — Pure Supplier ORG_ADMIN Data Denial in getFIWorkbenchData', () => {
        it('should return EMPTY questions (0 operational data) for pure Supplier ORG_ADMIN with no relationship membership', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'pure-supplier-admin' } as any);

            // User is ORG_ADMIN of SUPPLIER_ORG_ID, but has NO fiEngagement membership
            prismaMock.membership.findFirst.mockResolvedValue({
                id: 'mem-1',
                userId: 'pure-supplier-admin',
                organizationId: SUPPLIER_ORG_ID,
                role: 'ORG_ADMIN',
                organization: { id: SUPPLIER_ORG_ID, types: ['SUPPLIER', 'FI'] },
            });

            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-1',
                    userId: 'pure-supplier-admin',
                    organizationId: SUPPLIER_ORG_ID,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                },
            ]);

            const result = await getFIWorkbenchData(SUPPLIER_ORG_ID);

            // Operational data MUST be strictly empty
            expect(result.questions).toEqual([]);
            expect(result.counts.total).toBe(0);
            expect(result.counts.shared).toBe(0);
            expect(result.counts.released).toBe(0);
            expect(result.counts.notShared).toBe(0);
        });

        it('should allow operational relationship questions for assigned RELATIONSHIP_ADMIN / RELATIONSHIP_USER', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-worker-1' } as any);

            // User has explicit fiEngagementId membership
            prismaMock.membership.findFirst.mockResolvedValue(null);
            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-rel',
                    userId: 'rel-worker-1',
                    organizationId: null,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: 'RELATIONSHIP_ADMIN',
                },
            ]);

            prismaMock.question.findMany.mockResolvedValue([
                {
                    id: 'quest-1',
                    text: 'What is your compliance policy?',
                    guidance: 'Provide policy doc',
                    isRequired: true,
                    category: 'Compliance',
                    status: 'RELEASED',
                    releasedAt: new Date(),
                    sharedAt: new Date(),
                    documents: [],
                    questionnaire: {
                        id: 'q-inst-1',
                        name: 'Operational Questionnaire',
                        version: '1.0',
                        fiEngagement: {
                            id: ENGAGEMENT_ID,
                            clientLEId: CLIENT_LE_ID,
                            clientLE: {
                                id: CLIENT_LE_ID,
                                name: 'Alpha LE',
                                owners: [{ party: { name: 'Alpha Client Org' } }],
                            },
                        },
                    },
                },
            ]);

            prismaMock.clientLE.findMany.mockResolvedValue([]);
            prismaMock.clientLERecord.findFirst.mockResolvedValue(null);
            prismaMock.document.findMany.mockResolvedValue([]);
            if (prismaMock.questionnaireSubmission?.findMany) {
                prismaMock.questionnaireSubmission.findMany.mockResolvedValue([]);
            }

            const result = await getFIWorkbenchData(SUPPLIER_ORG_ID);

            expect(result.questions.length).toBe(1);
            expect(result.questions[0].questionText).toBe('What is your compliance policy?');
            expect(result.counts.total).toBe(1);
            expect(result.counts.released).toBe(1);
        });
    });

    describe('2. Administrative Relationship Visibility in getSupplierRelationshipsSummary', () => {
        it('should return minimal administrative metadata (identity, status, client org/LE) and NO operational question counters for pure Supplier ORG_ADMIN', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'pure-supplier-admin' } as any);

            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-1',
                    userId: 'pure-supplier-admin',
                    organizationId: SUPPLIER_ORG_ID,
                    fiEngagementId: null,
                    role: 'ORG_ADMIN',
                },
            ]);

            prismaMock.fIEngagement.findMany.mockResolvedValue([
                {
                    id: ENGAGEMENT_ID,
                    fiOrgId: SUPPLIER_ORG_ID,
                    clientLEId: CLIENT_LE_ID,
                    status: 'CONNECTED',
                    isDeleted: false,
                    clientLE: {
                        id: CLIENT_LE_ID,
                        name: 'Alpha LE',
                        isDeleted: false,
                        owners: [{ party: { id: CLIENT_ORG_ID, name: 'Alpha Client Org' } }],
                    },
                },
            ]);

            const summary = await getSupplierRelationshipsSummary(SUPPLIER_ORG_ID);

            // Authoritative query check: pure ORG_ADMIN query MUST NOT request questionnaireInstances or questions
            const findManyArgs = prismaMock.fIEngagement.findMany.mock.calls[0][0];
            expect(findManyArgs.include).toBeDefined();
            expect(findManyArgs.include.questionnaireInstances).toBeUndefined();
            expect(prismaMock.questionnaire.findMany).not.toHaveBeenCalled();
            expect(prismaMock.question.findMany).not.toHaveBeenCalled();

            expect(summary.length).toBe(1);
            expect(summary[0].clientOrganizationName).toBe('Alpha Client Org');
            expect(summary[0].legalEntities.length).toBe(1);

            const leSummary = summary[0].legalEntities[0];
            expect(leSummary.relationshipId).toBe(ENGAGEMENT_ID);
            expect(leSummary.clientLEName).toBe('Alpha LE');
            expect(leSummary.status).toBe('CONNECTED');

            // Pure ORG_ADMIN without operational engagement membership MUST receive empty questionnaires and zero progress counters
            expect(leSummary.questionnaires).toEqual([]);
            expect(leSummary.questionCounts).toEqual({ total: 0, notShared: 0, shared: 0, released: 0 });
            expect(summary[0].questionnaireCount).toBe(0);
            expect(summary[0].questionCounts).toEqual({ total: 0, notShared: 0, shared: 0, released: 0 });
        });

        it('should query questionnaireInstances ONLY for assigned relationships when user has operational membership', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-worker-1' } as any);

            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-rel',
                    userId: 'rel-worker-1',
                    organizationId: null,
                    fiEngagementId: ENGAGEMENT_ID,
                    role: 'RELATIONSHIP_ADMIN',
                },
            ]);

            prismaMock.fIEngagement.findMany.mockResolvedValue([
                {
                    id: ENGAGEMENT_ID,
                    fiOrgId: SUPPLIER_ORG_ID,
                    clientLEId: CLIENT_LE_ID,
                    status: 'CONNECTED',
                    isDeleted: false,
                    clientLE: {
                        id: CLIENT_LE_ID,
                        name: 'Alpha LE',
                        isDeleted: false,
                        owners: [{ party: { id: CLIENT_ORG_ID, name: 'Alpha Client Org' } }],
                    },
                    questionnaireInstances: [
                        {
                            id: 'q-1',
                            name: 'Alpha KYC Questionnaire',
                            questions: [
                                { id: 'q1', status: 'RELEASED', releasedAt: new Date() },
                            ],
                        },
                    ],
                },
            ]);

            const summary = await getSupplierRelationshipsSummary(SUPPLIER_ORG_ID);

            const findManyArgs = prismaMock.fIEngagement.findMany.mock.calls[0][0];
            expect(findManyArgs.include.questionnaireInstances).toBeDefined();
            expect(findManyArgs.include.questionnaireInstances.where.fiEngagementId).toEqual({ in: [ENGAGEMENT_ID] });
            expect(summary[0].questionCounts.released).toBe(1);
        });
    });

    describe('3. Plain Supplier ORG_MEMBER Relationship Visibility and Data Denial', () => {
        it('should strictly return EMPTY array (0 relationships) for pure Supplier ORG_MEMBER without relationship membership in getSupplierRelationshipsSummary', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'pure-supplier-member' } as any);

            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-member-1',
                    userId: 'pure-supplier-member',
                    organizationId: SUPPLIER_ORG_ID,
                    fiEngagementId: null,
                    role: 'ORG_MEMBER',
                },
            ]);

            const summary = await getSupplierRelationshipsSummary(SUPPLIER_ORG_ID);

            expect(summary).toEqual([]);
            expect(prismaMock.fIEngagement.findMany).not.toHaveBeenCalled();
        });

        it('should strictly return EMPTY questions and zero data for pure Supplier ORG_MEMBER in getFIWorkbenchData', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'pure-supplier-member' } as any);

            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-member-1',
                    userId: 'pure-supplier-member',
                    organizationId: SUPPLIER_ORG_ID,
                    fiEngagementId: null,
                    role: 'ORG_MEMBER',
                },
            ]);

            const result = await getFIWorkbenchData(SUPPLIER_ORG_ID);

            expect(result.questions).toEqual([]);
            expect(result.counts).toEqual({ total: 0, notShared: 0, shared: 0, released: 0 });
            expect(prismaMock.question.findMany).not.toHaveBeenCalled();
        });

        it('should return null and perform zero count queries for pure Supplier ORG_MEMBER in getFIDashboardStats', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'pure-supplier-member' } as any);

            prismaMock.membership.findMany.mockResolvedValue([
                {
                    id: 'mem-member-1',
                    userId: 'pure-supplier-member',
                    organizationId: SUPPLIER_ORG_ID,
                    fiEngagementId: null,
                    role: 'ORG_MEMBER',
                },
            ]);

            const stats = await getFIDashboardStats(SUPPLIER_ORG_ID);

            expect(stats).toBeNull();
            expect(prismaMock.questionnaire.count).not.toHaveBeenCalled();
            expect(prismaMock.fIEngagement.count).not.toHaveBeenCalled();
        });
    });

    describe('4. Permission Engine — Supplier ORG_ADMIN Team Management vs Operational Denial', () => {
        const supplierOrgAdminUser: UserWithMemberships = {
            id: 'user-supplier-admin',
            memberships: [
                {
                    organizationId: SUPPLIER_ORG_ID,
                    role: Role.ORG_ADMIN,
                    organization: { types: ['SUPPLIER', 'FI'] },
                },
            ],
        };

        it('should ALLOW Supplier ORG_ADMIN to execute Action.ENG_MANAGE_USERS on relationships owned by its Supplier Org', async () => {
            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: ENGAGEMENT_ID,
                fiOrgId: SUPPLIER_ORG_ID,
                clientLEId: CLIENT_LE_ID,
            });

            const allowed = await can(
                supplierOrgAdminUser,
                Action.ENG_MANAGE_USERS,
                { engagementId: ENGAGEMENT_ID },
                prismaMock
            );

            expect(allowed).toBe(true);
        });

        it('should DENY Supplier ORG_ADMIN from executing Action.ENG_MANAGE_USERS on relationships owned by a FOREIGN Supplier Org', async () => {
            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: FOREIGN_ENGAGEMENT_ID,
                fiOrgId: FOREIGN_SUPPLIER_ORG_ID,
                clientLEId: CLIENT_LE_ID,
            });

            const allowed = await can(
                supplierOrgAdminUser,
                Action.ENG_MANAGE_USERS,
                { engagementId: FOREIGN_ENGAGEMENT_ID },
                prismaMock
            );

            expect(allowed).toBe(false);
        });

        it('should strictly DENY Supplier ORG_ADMIN all operational relationship actions without explicit membership', async () => {
            prismaMock.fIEngagement.findUnique.mockResolvedValue({
                id: ENGAGEMENT_ID,
                fiOrgId: SUPPLIER_ORG_ID,
                clientLEId: CLIENT_LE_ID,
            });

            const operationalActions = [
                Action.ENG_VIEW,
                Action.ENG_VIEW_RELEASED_DATA,
                Action.ENG_EDIT_DRAFT_RESPONSES,
                Action.ENG_SIGNOFF_RESPONSES,
                Action.ENG_UPDATE,
                Action.ENG_DELETE,
            ];

            for (const action of operationalActions) {
                const allowed = await can(
                    supplierOrgAdminUser,
                    action,
                    { engagementId: ENGAGEMENT_ID },
                    prismaMock
                );
                expect(allowed).toBe(false);
            }
        });
    });
});
