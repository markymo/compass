import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { getEngagementTeam } from '../client-le';

// Contract: ONP-89
// getEngagementTeam engagement-scoped server-side authorization

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn() },
        clientLEOwner: { findMany: vi.fn() },
        fIEngagement: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn() },
        invitation: { findMany: vi.fn() },
        user: { findMany: vi.fn() },
        organization: { findUnique: vi.fn() }
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

const prismaMock = prisma as any;

describe('ONP-89 — getEngagementTeam Server-Side Authorization', () => {
    const targetEngagementId = 'eng-alpha-123';
    const foreignEngagementId = 'eng-beta-456';
    const targetClientLEId = 'le-alpha-789';
    const foreignClientLEId = 'le-beta-000';

    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
        
        // Mock engagement resolution in Prisma
        prismaMock.fIEngagement.findUnique.mockImplementation(async ({ where }: any) => {
            if (where.id === targetEngagementId) {
                return { id: targetEngagementId, clientLEId: targetClientLEId, fiOrgId: 'org-supp-a' };
            }
            if (where.id === foreignEngagementId) {
                return { id: foreignEngagementId, clientLEId: foreignClientLEId, fiOrgId: 'org-supp-b' };
            }
            return null;
        });

        // Mock mock invitations and memberships returned by DB
        prismaMock.invitation.findMany.mockResolvedValue([
            { id: 'inv-1', sentToEmail: 'supp-invite@example.com', role: 'SUPPLIER_CONTACT', createdByUserId: 'user-creator-1' }
        ]);
        prismaMock.user.findMany.mockResolvedValue([
            { id: 'user-creator-1', name: 'Alpha Creator', email: 'creator@alpha.com' }
        ]);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            // If querying by userId for auth check:
            if (where?.userId) {
                // Handled in individual tests
                return [];
            }
            // If querying team members for engagement response:
            return [
                {
                    id: 'mem-1',
                    clientLEId: targetClientLEId,
                    role: 'LE_ADMIN',
                    user: { name: 'Alpha Admin', email: 'admin@alpha.com', image: null }
                }
            ];
        });
    });

    it('1. Denies unauthenticated caller (not logged in)', async () => {
        vi.mocked(getIdentity).mockResolvedValue(null);

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
        // Ensure no data queries are run
        expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
    });

    it('2. Denies when engagementId is empty or missing', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-1' } as any);

        const res = await getEngagementTeam('');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Engagement ID is required');
        expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
    });

    it('3. Allows authorized Client LE_ADMIN to retrieve team data', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-alpha' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'le-admin-alpha') {
                return [
                    {
                        userId: 'le-admin-alpha',
                        clientLEId: targetClientLEId,
                        role: 'LE_ADMIN',
                        organizationId: null,
                        fiEngagementId: null,
                        clientLE: { isDeleted: false, status: 'ACTIVE' }
                    }
                ];
            }
            return [
                { id: 'm1', role: 'LE_ADMIN', user: { name: 'Alpha Admin', email: 'admin@alpha.com' } }
            ];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(true);
        expect(res.invitations).toBeDefined();
        expect(res.members).toBeDefined();
    });

    it('4. Allows authorized Client LE_USER to retrieve team data', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-user-alpha' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'le-user-alpha') {
                return [
                    {
                        userId: 'le-user-alpha',
                        clientLEId: targetClientLEId,
                        role: 'LE_USER',
                        organizationId: null,
                        fiEngagementId: null,
                        clientLE: { isDeleted: false, status: 'ACTIVE' }
                    }
                ];
            }
            return [
                { id: 'm1', role: 'LE_USER', user: { name: 'Alpha User', email: 'user@alpha.com' } }
            ];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(true);
        expect(res.invitations).toBeDefined();
        expect(res.members).toBeDefined();
    });

    it('5. Allows authorized Supplier RELATIONSHIP_ADMIN to retrieve team data', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-admin-1' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'rel-admin-1') {
                return [
                    {
                        userId: 'rel-admin-1',
                        clientLEId: null,
                        role: 'RELATIONSHIP_ADMIN',
                        organizationId: null,
                        fiEngagementId: targetEngagementId
                    }
                ];
            }
            return [
                { id: 'm1', role: 'RELATIONSHIP_ADMIN', user: { name: 'Rel Admin', email: 'reladmin@supp.com' } }
            ];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(true);
        expect(res.invitations).toBeDefined();
        expect(res.members).toBeDefined();
    });

    it('6. Allows authorized Supplier RELATIONSHIP_USER to retrieve team data', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-user-1' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'rel-user-1') {
                return [
                    {
                        userId: 'rel-user-1',
                        clientLEId: null,
                        role: 'RELATIONSHIP_USER',
                        organizationId: null,
                        fiEngagementId: targetEngagementId
                    }
                ];
            }
            return [
                { id: 'm1', role: 'RELATIONSHIP_USER', user: { name: 'Rel User', email: 'reluser@supp.com' } }
            ];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(true);
        expect(res.invitations).toBeDefined();
        expect(res.members).toBeDefined();
    });

    it('7. Denies unrelated Client LE user (membership only on a different ClientLE)', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-beta' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'le-admin-beta') {
                return [
                    {
                        userId: 'le-admin-beta',
                        clientLEId: foreignClientLEId,
                        role: 'LE_ADMIN',
                        organizationId: null,
                        fiEngagementId: null,
                        clientLE: { isDeleted: false, status: 'ACTIVE' }
                    }
                ];
            }
            return [];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
        // Ensure invitations query was not executed
        expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
    });

    it('8. Denies unrelated Supplier Relationship user (membership only on a different Engagement)', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'rel-user-beta' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'rel-user-beta') {
                return [
                    {
                        userId: 'rel-user-beta',
                        clientLEId: null,
                        role: 'RELATIONSHIP_USER',
                        organizationId: null,
                        fiEngagementId: foreignEngagementId
                    }
                ];
            }
            return [];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
        expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
    });

    it('9. Denies System Admin without explicit operational engagement membership', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'sys-admin-1' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'sys-admin-1') {
                return [
                    {
                        userId: 'sys-admin-1',
                        clientLEId: null,
                        role: 'SYSTEM_ADMIN',
                        organizationId: 'sys-org',
                        fiEngagementId: null
                    }
                ];
            }
            return [];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
        expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
    });

    it('10. Denies Org Admin / Org Member without explicit LE or Relationship role', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-1' } as any);
        prismaMock.membership.findMany.mockImplementation(async ({ where }: any) => {
            if (where?.userId === 'org-admin-1') {
                return [
                    {
                        userId: 'org-admin-1',
                        clientLEId: null,
                        role: 'ORG_ADMIN',
                        organizationId: 'client-org-1',
                        fiEngagementId: null,
                        organization: { types: ['CLIENT'] }
                    }
                ];
            }
            return [];
        });

        const res = await getEngagementTeam(targetEngagementId);
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized');
        expect(prismaMock.invitation.findMany).not.toHaveBeenCalled();
    });
});
