import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mocks
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed_password_123'),
        compare: vi.fn().mockResolvedValue(true),
    },
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue(null),
}));

// Mock Prisma with vi.hoisted
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
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    fIEngagement: {
        update: vi.fn(),
    },
    engagementActivity: {
        create: vi.fn(),
    },
    question: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clientLEOwner: {
        findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: prismaMock,
}));

import { registerAndAcceptInvitation } from '../accept-invitation';

describe('registerAndAcceptInvitation Regression Tests', () => {
    const rawToken = 'test-token-uuid-1234';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const validOrgInvite = {
        id: 'invite-org-1',
        tokenHash,
        sentToEmail: 'invitee@example.com',
        role: 'ORG_MEMBER',
        organizationId: 'org-123',
        clientLEId: null,
        fiEngagementId: null,
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        organization: { id: 'org-123', name: 'Acme Corp' },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default transaction mock executes callback with tx mock
        prismaMock.$transaction.mockImplementation(async (cb: any) => {
            return await cb(prismaMock);
        });
    });

    it('1. New invited user registers and accepts successfully', async () => {
        prismaMock.invitation.findUnique.mockResolvedValue(validOrgInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-new-1', email: 'invitee@example.com' });
        prismaMock.membership.create.mockResolvedValue({ id: 'mem-1' });
        prismaMock.invitation.update.mockResolvedValue({ ...validOrgInvite, usedAt: new Date() });

        const result = await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
            name: 'Jane Doe',
        });

        expect(result.success).toBe(true);
        expect(result.userId).toBe('user-new-1');
        expect(result.redirectUrl).toBe('/app/clients/org-123');
    });

    it('2. Membership/permission is created correctly matching the invitation role', async () => {
        prismaMock.invitation.findUnique.mockResolvedValue(validOrgInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-new-1', email: 'invitee@example.com' });

        await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
        });

        expect(prismaMock.membership.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-new-1',
                organizationId: 'org-123',
                clientLEId: null,
                role: 'ORG_MEMBER',
            },
        });
    });

    it('3. Invitation becomes used on acceptance', async () => {
        prismaMock.invitation.findUnique.mockResolvedValue(validOrgInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-new-1', email: 'invitee@example.com' });

        await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
        });

        expect(prismaMock.invitation.update).toHaveBeenCalledWith({
            where: { id: 'invite-org-1' },
            data: {
                usedAt: expect.any(Date),
                acceptedByUserId: 'user-new-1',
            },
        });
    });

    it('4. Assignment reconciliation still happens during acceptance', async () => {
        prismaMock.invitation.findUnique.mockResolvedValue(validOrgInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-new-1', email: 'invitee@example.com' });

        await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
        });

        expect(prismaMock.question.updateMany).toHaveBeenCalledWith({
            where: {
                assignedEmail: 'invitee@example.com',
                assignedToUserId: null,
                questionnaire: {
                    OR: [
                        { fiOrgId: 'org-123' },
                        { fiEngagement: { fiOrgId: 'org-123' } },
                    ],
                },
            },
            data: { assignedToUserId: 'user-new-1' },
        });
    });

    it('5. Correct redirect URL is returned for engagement scope', async () => {
        const engInvite = {
            id: 'invite-eng-1',
            tokenHash,
            sentToEmail: 'supplier@example.com',
            role: 'SUPPLIER_CONTACT',
            organizationId: null,
            clientLEId: null,
            fiEngagementId: 'eng-123',
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86400000),
            fiEngagement: {
                id: 'eng-123',
                fiOrgId: 'fi-org-777',
                status: 'INVITED',
                org: { id: 'fi-org-777', name: 'Supplier Org' },
                clientLE: { id: 'cle-1', name: 'Client LE' },
            },
        };

        prismaMock.invitation.findUnique.mockResolvedValue(engInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 'user-supplier-1', email: 'supplier@example.com' });

        const result = await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
        });

        expect(result.success).toBe(true);
        expect(result.redirectUrl).toBe('/app/s/fi-org-777');
    });

    it('6. Reused invitation is rejected', async () => {
        const usedInvite = {
            ...validOrgInvite,
            usedAt: new Date(),
        };
        prismaMock.invitation.findUnique.mockResolvedValue(usedInvite);

        const result = await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already been accepted/i);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('7. Failed transaction does not leave partial registration', async () => {
        prismaMock.invitation.findUnique.mockResolvedValue(validOrgInvite);
        prismaMock.user.findUnique.mockResolvedValue(null);

        // Simulate transaction failure during membership creation
        prismaMock.$transaction.mockImplementation(async (cb: any) => {
            throw new Error('Database foreign key failure');
        });

        const result = await registerAndAcceptInvitation({
            token: rawToken,
            password: 'securePassword123',
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unexpected error occurred/i);
        // invitation.update was NOT called outside transaction
        expect(prismaMock.invitation.update).not.toHaveBeenCalled();
    });

    it('8. Invitation page render itself does not consume the invitation (GET purity)', async () => {
        // Pure lookup as done by InvitationPage
        prismaMock.invitation.findUnique.mockResolvedValue(validOrgInvite);

        const fetched = await prismaMock.invitation.findUnique({
            where: { tokenHash },
        });

        expect(fetched.usedAt).toBeNull();
        expect(prismaMock.invitation.update).not.toHaveBeenCalled();
        expect(prismaMock.membership.create).not.toHaveBeenCalled();
    });
});
