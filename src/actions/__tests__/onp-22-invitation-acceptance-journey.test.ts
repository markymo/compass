import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAndAcceptInvitation, acceptInvitation } from '../accept-invitation';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Contract: INV-01 — Invitation acceptance is a clean one-time journey
// Linear: ONP-22

const prismaMock = vi.hoisted(() => ({
    invitation: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
        create: vi.fn(),
    },
    membership: {
        create: vi.fn(),
        findFirst: vi.fn(),
    },
    fIEngagement: {
        update: vi.fn(),
    },
    engagementActivity: {
        create: vi.fn(),
    },
    question: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    clientLE: {
        findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(prismaMock)),
}));

vi.mock('@/lib/prisma', () => ({
    default: prismaMock,
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'existing-user-id' }),
}));

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed-password-123'),
    },
}));

describe('INV-01 / ONP-22 — Clean One-Time Invitation Acceptance Journey', () => {
    const validToken = 'valid-one-time-token-onp22';
    const futureDate = new Date(Date.now() + 86400000);

    const mockFreshInvite = {
        id: 'invite-onp22-1',
        tokenHash: 'mock-hash',
        sentToEmail: 'newuser@example.com',
        role: 'ORG_MEMBER',
        organizationId: 'org-onp22',
        clientLEId: null,
        fiEngagementId: null,
        expiresAt: futureDate,
        usedAt: null,
        revokedAt: null,
        organization: { id: 'org-onp22', name: 'Acme Corp' },
        clientLE: null,
        fiEngagement: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('1. Fresh invitation → registerAndAcceptInvitation succeeds cleanly once and marks usedAt atomically', async () => {
        (prismaMock.invitation.findUnique as any).mockResolvedValueOnce(mockFreshInvite);
        (prismaMock.user.findUnique as any).mockResolvedValueOnce(null); // No existing user
        (prismaMock.invitation.findUnique as any).mockResolvedValueOnce(mockFreshInvite); // Inside tx
        (prismaMock.user.findUnique as any).mockResolvedValueOnce(null); // Inside tx
        (prismaMock.user.create as any).mockResolvedValueOnce({ id: 'user-new-1', email: 'newuser@example.com' });
        (prismaMock.invitation.update as any).mockResolvedValueOnce({ ...mockFreshInvite, usedAt: new Date() });

        const result = await registerAndAcceptInvitation({
            token: validToken,
            password: 'StrongPassword123!',
            name: 'New User',
        });

        expect(result.success).toBe(true);
        expect(result.userId).toBe('user-new-1');
        expect(result.redirectUrl).toBe('/app/clients/org-onp22');
        expect(prismaMock.membership.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-new-1',
                    organizationId: 'org-onp22',
                    role: 'ORG_MEMBER',
                }),
            })
        );
        expect(prismaMock.invitation.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'invite-onp22-1' },
                data: expect.objectContaining({
                    usedAt: expect.any(Date),
                    acceptedByUserId: 'user-new-1',
                }),
            })
        );
    });

    it('2. Immediate replay / back-navigation on consumed invitation returns explicit already accepted error without mutating state', async () => {
        const usedInvite = {
            ...mockFreshInvite,
            usedAt: new Date(Date.now() - 5000),
            acceptedByUserId: 'user-new-1',
        };

        (prismaMock.invitation.findUnique as any).mockResolvedValue(usedInvite);

        const result = await registerAndAcceptInvitation({
            token: validToken,
            password: 'StrongPassword123!',
            name: 'New User',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('This invitation has already been accepted.');
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('3. acceptInvitation for logged-in user with already-used token also returns already accepted error cleanly', async () => {
        const usedInvite = {
            ...mockFreshInvite,
            usedAt: new Date(Date.now() - 5000),
        };

        (prismaMock.invitation.findUnique as any).mockResolvedValue(usedInvite);

        const result = await acceptInvitation(validToken);
        expect(result.success).toBe(false);
        expect(result.error).toBe('This invitation has already been accepted.');
    });

    it('4. Expired invitation is rejected with clear expiration message', async () => {
        const expiredInvite = {
            ...mockFreshInvite,
            expiresAt: new Date(Date.now() - 86400000),
        };

        (prismaMock.invitation.findUnique as any).mockResolvedValue(expiredInvite);

        const result = await registerAndAcceptInvitation({
            token: validToken,
            password: 'StrongPassword123!',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('This invitation has expired.');
    });

    it('5. Revoked invitation is rejected with clear revocation message', async () => {
        const revokedInvite = {
            ...mockFreshInvite,
            revokedAt: new Date(),
        };

        (prismaMock.invitation.findUnique as any).mockResolvedValue(revokedInvite);

        const result = await registerAndAcceptInvitation({
            token: validToken,
            password: 'StrongPassword123!',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('This invitation has been revoked.');
    });
});
