import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getAvailableQuestionnaires } from '../requirements';
import { deleteQuestionnaire } from '../questionnaire';
import { getIdentity } from '@/lib/auth';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        questionnaire: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        usageLog: {
            create: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
        }
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
        ENG_EDIT_DRAFT_RESPONSES: 'ENG_EDIT_DRAFT_RESPONSES',
        QUESTIONNAIRE_DELETE: 'QUESTIONNAIRE_DELETE',
    },
    can: vi.fn().mockResolvedValue(true),
}));

const prismaMock = prisma as any;

describe('LIFE-03 / QUEST-01 / ONP-70 — Deleted Questionnaire Remains Visible Baseline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-1' } as any);
        prismaMock.membership.findMany.mockResolvedValue([
            { id: 'm-1', userId: 'user-1', organizationId: 'org-1', role: 'ORG_ADMIN' },
        ]);
    });

    it('1. getAvailableQuestionnaires explicitly excludes soft-deleted questionnaires (isDeleted: false)', async () => {
        prismaMock.questionnaire.findMany.mockResolvedValue([
            { id: 'q-active', name: 'Active Questionnaire', updatedAt: new Date() }
        ]);

        const result = await getAvailableQuestionnaires('org-1');

        expect(prismaMock.questionnaire.findMany).toHaveBeenCalledWith({
            where: {
                fiOrgId: 'org-1',
                isDeleted: false,
                status: 'ACTIVE'
            },
            select: {
                id: true,
                name: true,
                updatedAt: true
            }
        });
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('q-active');
    });

    it('2. deleteQuestionnaire updates isDeleted: true on Questionnaire record', async () => {
        prismaMock.questionnaire.findUnique.mockResolvedValue({
            id: 'q-to-delete',
            name: 'Old Questionnaire',
            fiOrgId: 'org-1',
            clientLEId: 'le-1',
            fiEngagementId: 'eng-1'
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
    });
});
