import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { assignQuestionnaireToEngagement } from '../questionnaire';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        questionnaire: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            findMany: vi.fn(),
        },
        question: {
            createMany: vi.fn(),
        },
        membership: {
            findMany: vi.fn(),
        },
        fIEngagement: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        financialInstitution: {
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
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
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1', orgId: 'org-1' }),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/permissions', () => ({
    Action: {
        ENG_VIEW: 'eng:view',
        ENG_EDIT_DRAFT_RESPONSES: 'eng:edit_draft_responses',
    },
    can: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/metrics-calc', () => ({
    calculateCommonQuestionnaireMetrics: vi.fn().mockResolvedValue({ total: 1, completed: 1 }),
    calculateEngagementMetrics: vi.fn().mockResolvedValue({ total: 1, completed: 1 }),
    calculateQuestionnaireMetrics: vi.fn().mockResolvedValue({ total: 1, completed: 1 }),
}));

describe('QNR-05 / ONP-18 — Questionnaire Assignment & Relationship Projection Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('assignQuestionnaireToEngagement clones template into relationship questionnaire instance', async () => {
        const mockTemplate = {
            id: 'tpl-100',
            name: 'Vendor Due Diligence',
            description: 'Standard VDD',
            isTemplate: true,
            status: 'ACTIVE',
            isGlobal: true,
            questions: [
                {
                    id: 'q-1',
                    text: 'Legal Name',
                    order: 1,
                    masterFieldNo: 2,
                    status: 'DRAFT',
                    mappings: []
                }
            ]
        };

        const mockEngagement = {
            id: 'eng-200',
            clientLEId: 'le-300',
            financialInstitutionId: 'fi-400',
            clientLE: { name: 'Acme Corp' },
            org: { name: 'Bank Alpha' }
        };

        mockPrisma.membership.findMany.mockResolvedValue([
            { organizationId: 'org-1', clientLEId: 'le-300', role: 'ADMIN' }
        ]);
        mockPrisma.questionnaire.findUnique.mockResolvedValue(mockTemplate);
        mockPrisma.fIEngagement.findUnique.mockResolvedValue(mockEngagement);
        mockPrisma.questionnaire.findFirst.mockResolvedValue(null);
        mockPrisma.questionnaire.create.mockResolvedValue({
            id: 'inst-500',
            name: 'Vendor Due Diligence',
            fiEngagementId: 'eng-200',
            status: 'ACTIVE',
            isTemplate: false,
            questions: [
                {
                    id: 'inst-q-1',
                    text: 'Legal Name',
                    order: 1,
                    masterFieldNo: 2,
                    status: 'SHARED'
                }
            ]
        });
        mockPrisma.question.createMany.mockResolvedValue({ count: 1 });

        const result = await assignQuestionnaireToEngagement('tpl-100', 'eng-200');
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(mockPrisma.questionnaire.create).toHaveBeenCalled();
        expect(mockPrisma.question.createMany).toHaveBeenCalled();
    });
});
