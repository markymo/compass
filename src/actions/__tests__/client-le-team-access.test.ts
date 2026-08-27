import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { getClientLETeamAssignments, saveClientLEPermissions } from '../client-le-team';
import { createClientLE } from '../client';
import { revokeInvitation, resendInvitation, inviteUser } from '../invitations';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        organization: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        clientLE: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn() },
        clientLEOwner: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        invitation: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        legalEntity: { findFirst: vi.fn(), create: vi.fn() },
        user: { findUnique: vi.fn() },
        $transaction: vi.fn(async (cb: any) => {
            if (typeof cb === 'function') {
                return await cb(mockPrisma);
            }
            return Promise.all(cb);
        })
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

vi.mock('@/services/legalEntityEnrichmentService', () => ({
    LegalEntityEnrichmentService: {
        bootstrapEntity: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

const prismaMock = prisma as any;

describe('ClientLE Team Access & Pending Invitations Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('1. Candidate Loader & Pending Invitations', () => {
        it('includes active pending invitations for the target ClientLE', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-admin-1' } as any);

            prismaMock.membership.findFirst.mockResolvedValueOnce({
                id: 'm-admin',
                userId: 'user-admin-1',
                organizationId: 'org-1',
                role: 'ORG_ADMIN'
            });

            prismaMock.clientLEOwner.findMany.mockResolvedValueOnce([{ clientLEId: 'cle-1' }]);

            // Active members
            prismaMock.membership.findMany.mockResolvedValueOnce([
                {
                    userId: 'user-admin-1',
                    organizationId: 'org-1',
                    role: 'ORG_ADMIN',
                    user: { email: 'alice@acme.com', name: 'Alice Admin', isDemoActor: false }
                }
            ]);

            prismaMock.membership.findMany.mockResolvedValueOnce([]); // No direct LE memberships yet

            // Active pending invites for cle-1
            prismaMock.invitation.findMany.mockResolvedValueOnce([
                {
                    id: 'inv-123',
                    sentToEmail: 'pending-jane@acme.com',
                    role: 'LE_USER',
                    clientLEId: 'cle-1',
                    usedAt: null,
                    revokedAt: null,
                    expiresAt: new Date(Date.now() + 86400000)
                }
            ]);

            const res = await getClientLETeamAssignments('cle-1', 'org-1');

            expect(res.success).toBe(true);
            expect(res.members).toHaveLength(2);

            const pendingRow = res.members.find(m => m.isPendingInvite);
            expect(pendingRow).toBeDefined();
            expect(pendingRow?.email).toBe('pending-jane@acme.com');
            expect(pendingRow?.orgRole).toBe('Invited');
            expect(pendingRow?.leRole).toBe('LE_USER');
            expect(pendingRow?.invitationId).toBe('inv-123');
        });
    });

    describe('2. Resend and Revoke Authorization & Actions', () => {
        it('allows authorized user to revoke a ClientLE invitation', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-admin-1' } as any);

            prismaMock.invitation.findUnique.mockResolvedValueOnce({
                id: 'inv-123',
                clientLEId: 'cle-1',
                createdByUserId: 'user-other',
                usedAt: null,
                revokedAt: null
            });

            // Requester memberships
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null, organization: { types: ['CLIENT'] } }
            ]);

            prismaMock.clientLEOwner.findFirst.mockResolvedValue({ partyId: 'org-1' });

            const res = await revokeInvitation('inv-123');

            expect(res.success).toBe(true);
            expect(prismaMock.invitation.update).toHaveBeenCalledWith({
                where: { id: 'inv-123' },
                data: { revokedAt: expect.any(Date) }
            });
        });

        it('denies unauthorized user from revoking a ClientLE invitation', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'stranger-user' } as any);

            prismaMock.invitation.findUnique.mockResolvedValueOnce({
                id: 'inv-123',
                clientLEId: 'cle-1',
                createdByUserId: 'user-other',
                usedAt: null,
                revokedAt: null
            });

            prismaMock.membership.findMany.mockResolvedValue([]); // Stranger has no memberships
            prismaMock.clientLEOwner.findFirst.mockResolvedValue({ partyId: 'org-1' });

            const res = await revokeInvitation('inv-123');

            expect(res).toEqual({ success: false, error: 'Unauthorized' });
            expect(prismaMock.invitation.update).not.toHaveBeenCalled();
        });

        it('allows authorized user to resend a ClientLE invitation and refresh expiration', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-admin-1' } as any);

            prismaMock.invitation.findUnique.mockResolvedValueOnce({
                id: 'inv-123',
                clientLEId: 'cle-1',
                createdByUserId: 'user-admin-1',
                usedAt: null,
                revokedAt: null
            });

            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null, organization: { types: ['CLIENT'] } }
            ]);

            const res = await resendInvitation('inv-123');

            expect(res.success).toBe(true);
            expect(prismaMock.invitation.update).toHaveBeenCalledWith({
                where: { id: 'inv-123' },
                data: { expiresAt: expect.any(Date) }
            });
        });
    });

    describe('3. Duplicate Invitation Protection', () => {
        it('prevents creating duplicate pending invitations for the same email and ClientLE', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-admin-1' } as any);

            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null, organization: { types: ['CLIENT'] } }
            ]);

            prismaMock.clientLEOwner.findMany.mockResolvedValue([
                { partyId: 'org-1', party: { types: ['CLIENT'] }, clientLE: { isDeleted: false } }
            ]);
            prismaMock.clientLE.findUnique.mockResolvedValue({ id: 'cle-1', name: 'Test LE', owners: [{ partyId: 'org-1' }] });
            prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1', types: ['CLIENT'] });
            prismaMock.user.findUnique.mockResolvedValue(null);

            // Existing pending invitation found
            prismaMock.invitation.findFirst.mockResolvedValueOnce({
                id: 'existing-inv',
                sentToEmail: 'duplicate@acme.com',
                clientLEId: 'cle-1',
                usedAt: null,
                revokedAt: null,
                expiresAt: new Date(Date.now() + 86400000)
            });

            const res = await inviteUser({
                email: 'duplicate@acme.com',
                role: 'LE_USER',
                clientLEId: 'cle-1'
            });

            expect(res).toEqual({
                success: false,
                error: 'A pending invitation for this user and scope already exists.'
            });
            expect(prismaMock.invitation.create).not.toHaveBeenCalled();
        });
    });
});
