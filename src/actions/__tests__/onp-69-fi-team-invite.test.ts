// Contract: INV-02
// Linear: ONP-69

import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { inviteSupplier } from '../supplier-invitations';
import { registerAndAcceptInvitation } from '../accept-invitation';
import crypto from 'crypto';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        fIEngagement: { findUnique: vi.fn(), update: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
        invitation: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        user: { findUnique: vi.fn(), create: vi.fn() },
        engagementActivity: { create: vi.fn() },
        question: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        clientLEOwner: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(),
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

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed_pwd'),
        compare: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock('@/lib/auth/permissions', () => ({
    Action: {
        LE_MANAGE_USERS: 'LE_MANAGE_USERS',
        ENG_MANAGE_USERS: 'ENG_MANAGE_USERS',
    },
    can: vi.fn().mockResolvedValue(true),
}));

const prismaMock = prisma as any;

describe('INV-02 / ONP-69 — FI Team Invite Contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'client-admin-1', email: 'admin@client.com' } as any);
        prismaMock.membership.findMany.mockResolvedValue([
            { id: 'm-client-admin', userId: 'client-admin-1', clientLEId: 'le-1', role: 'LE_ADMIN' }
        ]);
        prismaMock.$transaction.mockImplementation(async (cb: any) => {
            return await cb(prismaMock);
        });
    });

    it('1. inviteSupplier creates invitation with canonical SUPPLIER_CONTACT role, hashed token, and fiEngagementId scope', async () => {
        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: 'eng-1',
            clientLEId: 'le-1',
            status: 'CONNECTED',
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
        expect(res.token).toBeDefined();
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
        // 2. Assert no membership is created during invite phase
        expect(prismaMock.membership.create).not.toHaveBeenCalled();
    });

    it('2. inviteSupplier handles email delivery failure truthfully without breaking invitation creation', async () => {
        prismaMock.fIEngagement.findUnique.mockResolvedValue({
            id: 'eng-1',
            clientLEId: 'le-1',
            status: 'CONNECTED',
            clientLE: { id: 'le-1', name: 'Alpha Client LE' },
            org: { id: 'fi-org-1', name: 'Barclays Supplier' }
        });
        prismaMock.invitation.findFirst.mockResolvedValue(null);
        prismaMock.invitation.create.mockResolvedValue({
            id: 'inv-supp-2',
            sentToEmail: 'supplier.rep@bank.com',
            role: 'SUPPLIER_CONTACT',
            fiEngagementId: 'eng-1'
        });

        const res = await inviteSupplier('eng-1', 'supplier.rep@bank.com');

        expect(res.success).toBe(true);
        expect(res.token).toBeDefined();
        // Since Resend API key is not present in mock env, emailSent is false and error is tracked
        expect(res.emailSent).toBe(false);
        expect(res.emailDeliveryError).toBeDefined();
    });

    it('3. inviteSupplier rejects duplicate pending invitation', async () => {
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

    it('4. registerAndAcceptInvitation accepts canonical SUPPLIER_CONTACT invite and creates exactly one RELATIONSHIP_USER membership', async () => {
        const rawToken = 'test-supplier-token-123';
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const engInvite = {
            id: 'inv-eng-1',
            tokenHash,
            sentToEmail: 'supplier.rep@bank.com',
            role: 'SUPPLIER_CONTACT',
            organizationId: null,
            clientLEId: null,
            fiEngagementId: 'eng-1',
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86400000),
            fiEngagement: {
                id: 'eng-1',
                fiOrgId: 'fi-org-1',
                status: 'INVITED',
                org: { id: 'fi-org-1', name: 'Barclays Supplier' },
                clientLE: { id: 'le-1', name: 'Alpha Client LE' },
            },
        };

        prismaMock.invitation.findUnique.mockResolvedValue(engInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-supp-1', email: 'supplier.rep@bank.com' });
        prismaMock.membership.create.mockResolvedValue({ id: 'm-supp-1' });

        const result = await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123!',
            name: 'Supplier Rep',
        });

        expect(result.success).toBe(true);
        expect(result.userId).toBe('user-supp-1');
        expect(result.redirectUrl).toBe('/app/s/fi-org-1');

        // Assert exactly one membership created with RELATIONSHIP_USER and fiEngagementId
        expect(prismaMock.membership.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.membership.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-supp-1',
                organizationId: null,
                clientLEId: null,
                fiEngagementId: 'eng-1',
                role: 'RELATIONSHIP_USER',
            },
        });

        // Assert engagement status updated to CONNECTED
        expect(prismaMock.fIEngagement.update).toHaveBeenCalledWith({
            where: { id: 'eng-1' },
            data: { status: 'CONNECTED' },
        });

        // Assert invitation marked used
        expect(prismaMock.invitation.update).toHaveBeenCalledWith({
            where: { id: 'inv-eng-1' },
            data: {
                usedAt: expect.any(Date),
                acceptedByUserId: 'user-supp-1',
            },
        });
    });

    it('5. registerAndAcceptInvitation supports legacy "Supplier Contact" string for backward compatibility', async () => {
        const rawToken = 'test-legacy-supplier-token-456';
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const legacyEngInvite = {
            id: 'inv-eng-legacy',
            tokenHash,
            sentToEmail: 'legacy.supplier@bank.com',
            role: 'Supplier Contact',
            organizationId: null,
            clientLEId: null,
            fiEngagementId: 'eng-1',
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86400000),
            fiEngagement: {
                id: 'eng-1',
                fiOrgId: 'fi-org-1',
                status: 'INVITED',
                org: { id: 'fi-org-1', name: 'Barclays Supplier' },
                clientLE: { id: 'le-1', name: 'Alpha Client LE' },
            },
        };

        prismaMock.invitation.findUnique.mockResolvedValue(legacyEngInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-supp-legacy', email: 'legacy.supplier@bank.com' });
        prismaMock.membership.create.mockResolvedValue({ id: 'm-supp-legacy' });

        const result = await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123!',
        });

        expect(result.success).toBe(true);
        expect(prismaMock.membership.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-supp-legacy',
                organizationId: null,
                clientLEId: null,
                fiEngagementId: 'eng-1',
                role: 'RELATIONSHIP_USER',
            },
        });
    });
});
