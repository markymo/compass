import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { getLEUsers } from '../client';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        membership: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: { LE_VIEW_MASTER_DATA: 'LE_VIEW_MASTER_DATA' }
}));

const prismaMock = prisma as any;

describe('Team Demo Actor Filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getLEUsers filters out demo actors with user: { isDemoActor: false }', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-admin' } as any);

        // 1st findMany call inside ensureAuthorization
        prismaMock.membership.findMany.mockResolvedValueOnce([
            { organizationId: 'org-1', clientLEId: 'le-123', role: 'LE_ADMIN', clientLE: { isDeleted: false, status: 'ACTIVE' } }
        ]);

        // 2nd findMany call inside getLEUsers
        prismaMock.membership.findMany.mockResolvedValueOnce([
            {
                id: 'm-1',
                userId: 'user-real',
                role: 'LE_ADMIN',
                user: { name: 'Real User', email: 'real@acme.com', isDemoActor: false }
            }
        ]);

        const users = await getLEUsers('le-123');

        expect(prismaMock.membership.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                clientLEId: 'le-123',
                role: { in: ['LE_ADMIN', 'LE_USER'] },
                user: { isDemoActor: false }
            },
            include: { user: true }
        });

        expect(users).toEqual([
            {
                membershipId: 'm-1',
                userId: 'user-real',
                name: 'Real User',
                email: 'real@acme.com',
                role: 'LE_ADMIN'
            }
        ]);
    });
});
