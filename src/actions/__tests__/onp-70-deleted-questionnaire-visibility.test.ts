import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getAvailableQuestionnaires } from '../requirements';
import { deleteQuestionnaire } from '../questionnaire';
import { getClientLEData } from '../client';
import { getFIEngagementById, getSupplierRelationshipsSummary } from '../fi';
import { getIdentity } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Contract: QNR-04
// Linear: ONP-70 — deleted questionnaire lifecycle across active relationship surfaces

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        clientLE: {
            findUnique: vi.fn(),
        },
        clientLEOwner: {
            findMany: vi.fn(),
        },
        clientLERecord: {
            findFirst: vi.fn(),
        },
        fIEngagement: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        questionnaire: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
        },
        masterSchema: {
            findFirst: vi.fn(),
        },
        fieldClaim: {
            findMany: vi.fn(),
        },
        usageLog: {
            create: vi.fn(),
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

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/permissions', () => ({
    Action: {
        ENG_VIEW: 'eng:view',
        ENG_VIEW_RELEASED_DATA: 'eng:view_released_data',
        ENG_EDIT_DRAFT_RESPONSES: 'eng:edit_draft_responses',
        QUESTIONNAIRE_DELETE: 'questionnaire:delete',
    },
    can: vi.fn().mockResolvedValue(true),
    ensureAuthorization: vi.fn().mockResolvedValue({ userId: 'user-1', user: { id: 'user-1', memberships: [] } }),
}));

vi.mock('@/lib/metrics-calc', () => ({
    calculateCommonQuestionnaireMetrics: vi.fn().mockResolvedValue({ total: 1, completed: 1 }),
    calculateEngagementMetrics: vi.fn().mockResolvedValue({ total: 1, completed: 1 }),
    calculateQuestionnaireMetrics: vi.fn().mockResolvedValue({ total: 1, completed: 1 }),
}));

const prismaMock = prisma as any;

describe('QNR-04 / ONP-70 — Deleted Questionnaire Lifecycle & Visibility Across Surfaces', () => {
    const supplierOrgId = 'org-supp-1';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-1' } as any);
        prismaMock.membership.findMany.mockResolvedValue([
            { id: 'm-1', userId: 'user-1', organizationId: supplierOrgId, role: 'ORG_ADMIN', fiEngagementId: null },
        ]);
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
        prismaMock.masterSchema.findFirst.mockResolvedValue({ id: 'schema-1', isActive: true });
        prismaMock.clientLERecord.findFirst.mockResolvedValue(null);
        prismaMock.fieldClaim.findMany.mockResolvedValue([]);
    });

    describe('1. Active Client Surfaces Filter Soft-Deleted Questionnaires', () => {
        it('getClientLEData excludes soft-deleted questionnaires and questionnaireInstances from active relationship data', async () => {
            prismaMock.clientLE.findUnique.mockResolvedValue({
                id: 'le-alpha',
                name: 'UAT Alpha Limited',
                isDeleted: false,
                owners: [],
                fiEngagements: [
                    {
                        id: 'eng-1',
                        org: { id: supplierOrgId, name: 'Supplier Org' },
                        questionnaires: [
                            { id: 'q-active-1', name: 'Active Q1', isDeleted: false }
                        ],
                        questionnaireInstances: [
                            { id: 'qi-active-2', name: 'Active QI 2', isDeleted: false }
                        ],
                        _count: { sharedDocuments: 0, invitations: 0, memberships: 1 }
                    }
                ],
                registryReferences: [],
                commonQuestionnaires: []
            });

            const data = await getClientLEData('le-alpha');

            expect(prismaMock.clientLE.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'le-alpha' },
                    include: expect.objectContaining({
                        fiEngagements: expect.objectContaining({
                            where: { isDeleted: false },
                            include: expect.objectContaining({
                                questionnaires: { where: { isDeleted: false } },
                                questionnaireInstances: { where: { isDeleted: false } }
                            })
                        }),
                        commonQuestionnaires: { where: { isDeleted: false } }
                    })
                })
            );
            expect(data).not.toBeNull();
            expect(data?.le.fiEngagements[0].questionnaires).toHaveLength(2);
        });

        it('getFIEngagementById excludes soft-deleted questionnaires from engagement detail view', async () => {
            prismaMock.fIEngagement.findFirst.mockResolvedValue({
                id: 'eng-1',
                clientLEId: 'le-alpha',
                clientLE: { id: 'le-alpha', name: 'UAT Alpha Limited', isDeleted: false, owners: [] },
                org: { id: supplierOrgId, name: 'Supplier Org' },
                questionnaires: [{ id: 'q-active', name: 'Active Q', isDeleted: false }],
                questionnaireInstances: [{ id: 'qi-active', name: 'Active QI', isDeleted: false, questions: [] }],
                sharedDocuments: []
            });

            const res = await getFIEngagementById('eng-1');

            expect(prismaMock.fIEngagement.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'eng-1' },
                    include: expect.objectContaining({
                        questionnaireInstances: expect.objectContaining({ where: { isDeleted: false } })
                    })
                })
            );
            expect(res).not.toBeNull();
            expect(res?.questionnaires).toHaveLength(1);
        });
    });

    describe('2. Active Supplier Surfaces Filter Soft-Deleted Questionnaires', () => {
        it('getSupplierRelationshipsSummary excludes soft-deleted questionnaireInstances', async () => {
            prismaMock.fIEngagement.findMany.mockResolvedValue([
                {
                    id: 'eng-1',
                    clientLEId: 'le-alpha',
                    clientLE: { id: 'le-alpha', name: 'UAT Alpha Limited', owners: [{ party: { id: 'client-org-1', name: 'Client Org' } }] },
                    questionnaireInstances: [
                        {
                            id: 'qi-active',
                            name: 'Active QI',
                            isDeleted: false,
                            questions: [{ id: 'qu-1', status: 'SHARED', sharedAt: new Date() }]
                        }
                    ]
                }
            ]);

            const summary = await getSupplierRelationshipsSummary(supplierOrgId);

            expect(prismaMock.fIEngagement.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ fiOrgId: supplierOrgId, isDeleted: false }),
                    include: expect.objectContaining({
                        questionnaireInstances: expect.objectContaining({
                            where: { isDeleted: false }
                        })
                    })
                })
            );
            expect(summary).toHaveLength(1);
            expect(summary[0].legalEntities[0].questionnaires).toHaveLength(1);
        });
    });

    describe('3. Questionnaire Deletion & Revalidation Lifecycle', () => {
        it('deleteQuestionnaire soft deletes and revalidates client LE and engagement paths', async () => {
            prismaMock.questionnaire.findUnique.mockResolvedValue({
                id: 'q-to-delete',
                name: 'Alpha Due Diligence',
                fiOrgId: supplierOrgId,
                fiEngagementId: 'eng-alpha-1',
                fiEngagement: { clientLEId: 'le-alpha-1' }
            });
            prismaMock.questionnaire.update.mockResolvedValue({
                id: 'q-to-delete',
                isDeleted: true
            });

            const res = await deleteQuestionnaire('q-to-delete');

            expect(res.success).toBe(true);
            expect(prismaMock.questionnaire.update).toHaveBeenCalledWith({
                where: { id: 'q-to-delete' },
                data: { isDeleted: true }
            });
            // Asserts proper revalidation of client LE relationship paths
            expect(revalidatePath).toHaveBeenCalledWith('/app/le/le-alpha-1/relationships');
            expect(revalidatePath).toHaveBeenCalledWith('/app/le/le-alpha-1/workbench4');
            expect(revalidatePath).toHaveBeenCalledWith(`/app/s/${supplierOrgId}`);
        });
    });

    describe('4. Requirement Picker Excludes Soft-Deleted Templates', () => {
        it('getAvailableQuestionnaires queries with isDeleted: false', async () => {
            prismaMock.questionnaire.findMany.mockResolvedValue([
                { id: 'q-template-1', name: 'Active Template', updatedAt: new Date() }
            ]);

            const available = await getAvailableQuestionnaires(supplierOrgId);

            expect(prismaMock.questionnaire.findMany).toHaveBeenCalledWith({
                where: {
                    fiOrgId: supplierOrgId,
                    isDeleted: false,
                    status: 'ACTIVE'
                },
                select: {
                    id: true,
                    name: true,
                    updatedAt: true
                }
            });
            expect(available).toHaveLength(1);
            expect(available[0].id).toBe('q-template-1');
        });
    });
});
