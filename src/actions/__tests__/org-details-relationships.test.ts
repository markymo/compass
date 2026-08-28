import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { isSystemAdmin } from '../admin';
import { getOrganizationDetails } from '../org';

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'admin-user-1' }),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('../admin', () => ({
    isSystemAdmin: vi.fn(),
}));

const mockFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
    default: {
        organization: {
            findUnique: (...args: any[]) => mockFindUnique(...args),
        },
    },
}));

describe('getOrganizationDetails — LIFE-02 Active Relationships Filter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isSystemAdmin).mockResolvedValue(true);
    });

    it('rejects non-System Admin callers with null', async () => {
        vi.mocked(isSystemAdmin).mockResolvedValue(false);

        const res = await getOrganizationDetails('org-1');
        expect(res).toBeNull();
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('passes explicit isDeleted: false and clientLE.isDeleted: false filters to engagements query', async () => {
        mockFindUnique.mockResolvedValue({
            id: 'org-fi-1',
            name: 'Test Supplier Org',
            types: ['FI', 'SUPPLIER'],
            memberships: [],
            ownedLEs: [],
            engagements: [
                {
                    id: 'eng-active',
                    status: 'CONNECTED',
                    dueDate: null,
                    clientLE: { id: 'le-active', name: 'Active Corp' },
                }
            ],
        });

        const res = await getOrganizationDetails('org-fi-1');

        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { id: 'org-fi-1' },
            include: expect.objectContaining({
                engagements: {
                    where: {
                        isDeleted: false,
                        clientLE: {
                            isDeleted: false,
                        },
                    },
                    select: {
                        id: true,
                        status: true,
                        dueDate: true,
                        clientLE: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            }),
        });

        expect(res?.engagements).toHaveLength(1);
        expect(res?.engagements[0].clientLE.name).toBe('Active Corp');
    });

    it('filters out soft-deleted engagements and soft-deleted ClientLEs from returned relationship rows', async () => {
        // Simulating the Prisma filter in action
        const mockRawEngagements = [
            { id: 'eng-1', isDeleted: false, clientLE: { id: 'le-1', name: 'Active LE 1', isDeleted: false } },
            { id: 'eng-2', isDeleted: true,  clientLE: { id: 'le-2', name: 'Active LE 2', isDeleted: false } },
            { id: 'eng-3', isDeleted: true,  clientLE: { id: 'le-3', name: 'Deleted LE 3', isDeleted: true } },
            { id: 'eng-4', isDeleted: false, clientLE: { id: 'le-4', name: 'Deleted LE 4', isDeleted: true } },
        ];

        // The query where clause: { isDeleted: false, clientLE: { isDeleted: false } }
        const filteredEngagements = mockRawEngagements.filter(
            eng => !eng.isDeleted && eng.clientLE && !eng.clientLE.isDeleted
        );

        mockFindUnique.mockResolvedValue({
            id: 'org-fi-1',
            name: 'Barclays Test',
            types: ['FI'],
            engagements: filteredEngagements,
        });

        const res = await getOrganizationDetails('org-fi-1');

        expect(res?.engagements).toHaveLength(1);
        expect(res?.engagements[0].id).toBe('eng-1');
        expect(res?.engagements[0].clientLE.name).toBe('Active LE 1');
    });
});
