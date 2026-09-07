import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { inviteUser } from '../invitations';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        organization: { findUnique: vi.fn(), findFirst: vi.fn() },
        clientLE: { findUnique: vi.fn(), findFirst: vi.fn() },
        fIEngagement: { findUnique: vi.fn(), findFirst: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        invitation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
        user: { findUnique: vi.fn() },
        usageLog: { create: vi.fn() },
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
        ORG_MANAGE_TEAM: 'ORG_MANAGE_TEAM',
        LE_MANAGE_USERS: 'LE_MANAGE_USERS',
        ENG_MANAGE_USERS: 'ENG_MANAGE_USERS',
        SYSTEM_MANAGE_TENANTS: 'SYSTEM_MANAGE_TENANTS',
    },
    can: vi.fn().mockResolvedValue(true),
}));

const prismaMock = prisma as any;

describe('INV-03 / ONP-79 — User Invitation & Auto-Add Fork Workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'admin-user-1' } as any);
        prismaMock.membership.findMany.mockResolvedValue([
            { id: 'm-admin', userId: 'admin-user-1', organizationId: 'org-1', role: 'ORG_ADMIN' },
        ]);
        prismaMock.invitation.findFirst.mockResolvedValue(null);
    });

    it('Scenario A: Existing registered user is immediately granted Active Membership without Invitation token', async () => {
        // User exists in DB
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-existing-1',
            email: 'existing.user@example.com',
            name: 'Existing User',
        });
        // Not already a member of org-1
        prismaMock.membership.findFirst.mockResolvedValue(null);
        prismaMock.membership.create.mockResolvedValue({
            id: 'm-new-1',
            userId: 'user-existing-1',
            organizationId: 'org-1',
            role: 'ORG_MEMBER',
        });
        prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Acme Client Org' });

        const result = await inviteUser({
            email: 'existing.user@example.com',
            role: 'ORG_MEMBER',
            organizationId: 'org-1',
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('instantly granted access');

        // Assert Membership was created immediately
        expect(prismaMock.membership.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-existing-1',
                organizationId: 'org-1',
                clientLEId: null,
                fiEngagementId: null,
                role: 'ORG_MEMBER',
            },
        });

        // Assert NO Invitation token record was created
        expect(prismaMock.invitation.create).not.toHaveBeenCalled();
    });

    it('Scenario B: Unknown / unregistered email creates Pending Invitation with token and NO Membership', async () => {
        // User does NOT exist in DB
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Acme Client Org' });
        prismaMock.invitation.create.mockResolvedValue({
            id: 'inv-1',
            sentToEmail: 'unknown.person@example.com',
            role: 'ORG_MEMBER',
            organizationId: 'org-1',
        });

        const result = await inviteUser({
            email: 'unknown.person@example.com',
            role: 'ORG_MEMBER',
            organizationId: 'org-1',
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Invitation sent to unknown.person@example.com');

        // Assert Invitation was created with token and 7-day expiry
        expect(prismaMock.invitation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                sentToEmail: 'unknown.person@example.com',
                role: 'ORG_MEMBER',
                organizationId: 'org-1',
                tokenHash: expect.any(String),
                expiresAt: expect.any(Date),
                createdByUserId: 'admin-user-1',
            }),
        });

        // Assert NO Membership was created
        expect(prismaMock.membership.create).not.toHaveBeenCalled();
    });

    it('Step 3 (Duplicate Protection): Inviting an already-active member rejects with error and creates no duplicate', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-active-1',
            email: 'active.member@example.com',
        });
        // Already a member of org-1
        prismaMock.membership.findFirst.mockResolvedValue({
            id: 'm-existing',
            userId: 'user-active-1',
            organizationId: 'org-1',
            role: 'ORG_MEMBER',
        });

        const result = await inviteUser({
            email: 'active.member@example.com',
            role: 'ORG_MEMBER',
            organizationId: 'org-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('User is already a member of this scope.');

        expect(prismaMock.membership.create).not.toHaveBeenCalled();
        expect(prismaMock.invitation.create).not.toHaveBeenCalled();
    });
});
