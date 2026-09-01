import { describe, it, expect, vi } from 'vitest';
vi.mock('next-auth', () => ({ default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })), getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getAllUsers } from '../admin';
import prisma from '@/lib/prisma';
import * as permissions from '@/lib/auth/permissions';

vi.mock('@/lib/auth/permissions', () => ({
    ensureAuthorization: vi.fn().mockResolvedValue(true),
    Action: { SYSTEM_MANAGE_TENANTS: 'system:manage_tenants' }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        user: { findMany: vi.fn() }
    }
}));

describe('getAllUsers - ClientLE identity with owning Client Organisation', () => {
    it('formats WORKSPACE memberships with owning Client Organisation name', async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
            {
                id: 'u-1',
                email: 'user@example.com',
                memberships: [
                    {
                        role: 'LE_ADMIN',
                        clientLE: {
                            id: 'cle-1',
                            name: 'HORNSEA 1 LIMITED',
                            isDeleted: false,
                            owners: [{ party: { id: 'org-1', name: 'Example Capital', shortCode: 'EXCAP' } }]
                        }
                    }
                ]
            }
        ] as any);

        const users = await getAllUsers();
        expect(users).toHaveLength(1);
        expect(users[0].memberships).toHaveLength(1);
        const m = users[0].memberships[0];
        expect(m.orgType).toBe('WORKSPACE');
        expect(m.orgName).toBe('HORNSEA 1 LIMITED (Example Capital)');
        expect(m.clientOrgName).toBe('Example Capital');
        expect(m.rawLEName).toBe('HORNSEA 1 LIMITED');
    });

    it('filters out soft-deleted ClientLE memberships', async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
            {
                id: 'u-2',
                email: 'deleted@example.com',
                memberships: [
                    {
                        role: 'LE_ADMIN',
                        clientLE: {
                            id: 'cle-deleted',
                            name: 'Deleted LE',
                            isDeleted: true,
                            owners: [{ party: { name: 'Some Org' } }]
                        }
                    }
                ]
            }
        ] as any);

        const users = await getAllUsers();
        expect(users).toHaveLength(1);
        expect(users[0].memberships).toHaveLength(0);
    });
});
