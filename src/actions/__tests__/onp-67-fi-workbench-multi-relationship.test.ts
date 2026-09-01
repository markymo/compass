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

// Contract: REL-01
// Linear: ONP-67

describe('REL-01 / ONP-67 — FI Workbench lists all authorised active relationships', () => {
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

    it('1. getFIWorkbenchData discovers all active relationships across multiple engagements even if only one has questions', async () => {
        // Two active engagements for fi-org-1
        prismaMock.fIEngagement.findMany.mockResolvedValue([
            { clientLE: { name: 'Alpha Client LE', owners: [{ party: { name: 'Alpha Client Org' } }] } },
            { clientLE: { name: 'Beta Client LE', owners: [{ party: { name: 'Beta Client Org' } }] } },
        ]);

        // Only Alpha Client LE contributes a question record
        prismaMock.question.findMany.mockResolvedValue([
            {
                id: 'q-1',
                text: 'Company Name',
                status: 'RELEASED',
                releasedAt: new Date(),
                expectedDataType: 'TEXT',
                answer: 'Alpha Client LE',
                questionnaire: {
                    id: 'qnr-1',
                    name: 'Alpha Onboarding Questionnaire',
                    fiEngagement: {
                        id: 'eng-1',
                        clientLE: {
                            id: 'le-alpha',
                            name: 'Alpha Client LE',
                            owners: [{ party: { name: 'Alpha Client Org' } }]
                        }
                    }
                }
            }
        ]);
        prismaMock.questionnaireSubmission.findMany.mockResolvedValue([]);

        const result = await getFIWorkbenchData('fi-org-1');

        // Both active LEs must be available in workbench LE options with their owning client org
        expect(result.les).toContain('Alpha Client LE (Alpha Client Org)');
        expect(result.les).toContain('Beta Client LE (Beta Client Org)');
        expect(result.les).toHaveLength(2);

        // Questions array contains the question for Alpha, while Beta has 0 questions
        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].clientLEName).toBe('Alpha Client LE (Alpha Client Org)');
    });
});
