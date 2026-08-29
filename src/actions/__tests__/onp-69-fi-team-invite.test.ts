import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { inviteSupplier } from '../supplier-invitations';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        fIEngagement: { findUnique: vi.fn(), update: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
        invitation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        user: { findUnique: vi.fn(), create: vi.fn() },
        engagementActivity: { create: vi.fn() },
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
        LE_MANAGE_USERS: 'LE_MANAGE_USERS',
        ENG_MANAGE_USERS: 'ENG_MANAGE_USERS',
    },
    can: vi.fn().mockResolvedValue(true),
}));

const prismaMock = prisma as any;

describe('INV-04 / ONP-69 — FI Team Invite Baseline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'client-admin-1', email: 'admin@client.com' } as any);
        prismaMock.membership.findMany.mockResolvedValue([
            { id: 'm-client-admin', userId: 'client-admin-1', clientLEId: 'le-1', role: 'LE_ADMIN' }
        ]);
    });

    it('1. inviteSupplier creates invitation with SUPPLIER_CONTACT role and token', async () => {
        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: 'eng-1',
            clientLEId: 'le-1',
            clientLE: { id: 'le-1', name: 'Alpha Client LE' },
            org: { id: 'fi-org-1', name: 'Barclays Supplier' }
        });
        prismaMock.invitation.findFirst.mockResolvedValue(null);
        prismaMock.invitation.create.mockResolvedValue({
            id: 'inv-supp-1',
            sentToEmail: 'supplier.rep@bank.com',
            role: 'SUPPLIER_CONTACT',
            fiEngagementId: 'eng-1'
        });

        const res = await inviteSupplier('eng-1', 'supplier.rep@bank.com');

        expect(res.success).toBe(true);
        expect(prismaMock.invitation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                sentToEmail: 'supplier.rep@bank.com',
                role: 'SUPPLIER_CONTACT',
                fiEngagementId: 'eng-1',
                createdByUserId: 'client-admin-1',
                tokenHash: expect.any(String),
                expiresAt: expect.any(Date)
            })
        });
    });

    it('2. inviteSupplier rejects duplicate pending invitation', async () => {
        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: 'eng-1',
            clientLEId: 'le-1',
            clientLE: { id: 'le-1', name: 'Alpha Client LE' },
            org: { id: 'fi-org-1', name: 'Barclays Supplier' }
        });
        prismaMock.invitation.findFirst.mockResolvedValue({
            id: 'inv-existing',
            sentToEmail: 'supplier.rep@bank.com'
        });

        const res = await inviteSupplier('eng-1', 'supplier.rep@bank.com');

        expect(res.success).toBe(false);
        expect(res.error).toBe('Active invitation already exists for this email.');
        expect(prismaMock.invitation.create).not.toHaveBeenCalled();
    });
});
