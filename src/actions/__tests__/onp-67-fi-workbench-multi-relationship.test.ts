import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { getFIWorkbenchData } from '../fi';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        membership: { findFirst: vi.fn(), findMany: vi.fn() },
        fIEngagement: { findMany: vi.fn() },
        question: { findMany: vi.fn() },
        questionnaireSubmission: { findMany: vi.fn() },
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('@/services/masterData/definitionService', () => ({
    listAllMasterFields: vi.fn().mockResolvedValue([]),
    listAllMasterGroups: vi.fn().mockResolvedValue([]),
}));

const prismaMock = prisma as any;

describe('WORK-01 / ONP-67 — FI Workbench Multi-Relationship Visibility Contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'fi-admin-1' } as any);
        prismaMock.membership.findFirst.mockResolvedValue({
            id: 'm-fi',
            userId: 'fi-admin-1',
            organizationId: 'fi-org-1',
            role: 'ORG_ADMIN',
        });
        prismaMock.membership.findMany.mockResolvedValue([]);
    });

    it('1. getFIWorkbenchData discovers all active relationships across multiple engagements', async () => {
        // Two active engagements for fi-org-1
        prismaMock.fIEngagement.findMany.mockResolvedValue([
            { clientLE: { name: 'Alpha Client LE' } },
            { clientLE: { name: 'Beta Client LE' } },
        ]);

        prismaMock.question.findMany.mockResolvedValue([]);
        prismaMock.questionnaireSubmission.findMany.mockResolvedValue([]);

        const result = await getFIWorkbenchData('fi-org-1');

        expect(result.les).toContain('Alpha Client LE');
        expect(result.les).toContain('Beta Client LE');
        expect(result.les).toHaveLength(2);
    });
});
