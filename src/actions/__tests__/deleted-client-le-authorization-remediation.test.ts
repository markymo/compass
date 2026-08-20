import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, Action, Role } from '@/lib/auth/permissions';
import { getUserContexts } from '@/actions/dashboard';
import { getClientDashboardData, getCurrentUserLERole } from '@/actions/client';
import { getFullMasterData } from '@/actions/client-le';
import { getAllClientLEsForAdmin } from '@/actions/admin';
import { getIdentity } from '@/lib/auth';
import { isSystemAdmin } from '@/actions/security';
import prisma from '@/lib/prisma';

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
}));

vi.mock('@/actions/security', () => ({
    isSystemAdmin: vi.fn(),
    getUserFIOrg: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        clientLE: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        clientLEOwner: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        organization: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        masterSchema: {
            findFirst: vi.fn(),
        },
        clientLERecord: {
            findFirst: vi.fn(),
        },
        sourceFieldMapping: {
            findMany: vi.fn(),
        },
        customFieldDefinition: {
            findMany: vi.fn(),
        },
        masterFieldDefinition: {
            findMany: vi.fn(),
        },
        masterFieldGroup: {
            findMany: vi.fn(),
        },
        masterFieldAssignment: {
            findMany: vi.fn(),
        },
        invitation: {
            findMany: vi.fn(),
        },
        fIEngagement: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

describe('Soft-Deleted ClientLE Authorization Remediation & Verification Pass', () => {
    const ORG_ID = 'org-entity-long-term';
    const DELETED_TRIKI_ID = 'cle-triki-deleted';
    const ACTIVE_LE_ID = 'cle-active-1';
    const OTHER_ACTIVE_LE_ID = 'cle-active-2';

    const mockDeletedTriki = {
        id: DELETED_TRIKI_ID,
        name: 'TRIKI CONSULTING LTD',
        isDeleted: true,
        status: 'ACTIVE',
        owners: [{ partyId: ORG_ID, endAt: null, party: { id: ORG_ID, name: 'Entity Long Term Tests' } }],
    };

    const mockActiveLE1 = {
        id: ACTIVE_LE_ID,
        name: 'BRITISH LIVER TRUST',
        isDeleted: false,
        status: 'ACTIVE',
        owners: [{ partyId: ORG_ID, endAt: null, party: { id: ORG_ID, name: 'Entity Long Term Tests' } }],
        fiEngagements: [],
        memberships: [],
    };

    const mockActiveLE2 = {
        id: OTHER_ACTIVE_LE_ID,
        name: 'OTHER ACTIVE LE',
        isDeleted: false,
        status: 'ACTIVE',
        owners: [{ partyId: ORG_ID, endAt: null, party: { id: ORG_ID, name: 'Entity Long Term Tests' } }],
        fiEngagements: [],
        memberships: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isSystemAdmin).mockResolvedValue(false);
        vi.mocked(prisma.clientLE.findMany).mockResolvedValue([]);
        vi.mocked(prisma.fIEngagement.findMany).mockResolvedValue([]);
        vi.mocked(prisma.masterFieldDefinition.findMany).mockResolvedValue([]);
        vi.mocked(prisma.masterFieldGroup.findMany).mockResolvedValue([]);
        vi.mocked(prisma.customFieldDefinition.findMany).mockResolvedValue([]);
        vi.mocked(prisma.sourceFieldMapping.findMany).mockResolvedValue([]);
        vi.mocked(prisma.clientLEOwner.findFirst).mockResolvedValue({ partyId: ORG_ID } as any);
    });

    describe('1. Delete -> Restore Lifecycle Verification', () => {
        const USER_ID = 'user-lifecycle-tester';

        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: 'lifecycle@example.com' } as any);
            vi.mocked(isSystemAdmin).mockResolvedValue(false);
        });

        it('disables ordinary user authorization upon soft-delete and reactivates retained membership upon restore', async () => {
            vi.mocked(isSystemAdmin).mockResolvedValue(false);
            // State A: Active LE
            const leActiveState = { ...mockActiveLE1, isDeleted: false };
            const activeMembership = {
                id: 'mem-lifecycle-1',
                userId: USER_ID,
                role: 'LE_USER',
                clientLEId: ACTIVE_LE_ID,
                fiEngagementId: null,
                clientLE: leActiveState
            };

            // 1. User can access active LE
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(leActiveState as any);
            vi.mocked(prisma.membership.findFirst).mockImplementation(async (args: any) => {
                if (args?.where?.clientLEId === ACTIVE_LE_ID) return activeMembership as any;
                return null;
            });

            const roleActive = await getCurrentUserLERole(ACTIVE_LE_ID);
            expect(roleActive).toBe('LE_USER');

            const canViewActive = await can({ id: USER_ID, memberships: [activeMembership] }, Action.LE_VIEW_MASTER_DATA, { clientLEId: ACTIVE_LE_ID }, prisma);
            expect(canViewActive).toBe(true);

            // State B: Soft-deleted LE
            const leDeletedState = { ...mockActiveLE1, isDeleted: true };
            const retainedMembership = {
                id: 'mem-lifecycle-1',
                userId: USER_ID,
                role: 'LE_USER',
                clientLEId: ACTIVE_LE_ID,
                fiEngagementId: null,
                clientLE: leDeletedState
            };

            // 2. Authorization immediately disappears while deleted
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(leDeletedState as any);
            const roleDeleted = await getCurrentUserLERole(ACTIVE_LE_ID);
            expect(roleDeleted).toBeNull();

            const canViewDeleted = await can({ id: USER_ID, memberships: [retainedMembership] }, Action.LE_VIEW_MASTER_DATA, { clientLEId: ACTIVE_LE_ID }, prisma);
            expect(canViewDeleted).toBe(false);

            // State C: Restored LE
            const leRestoredState = { ...mockActiveLE1, isDeleted: false };
            const restoredMembership = {
                id: 'mem-lifecycle-1',
                userId: USER_ID,
                role: 'LE_USER',
                clientLEId: ACTIVE_LE_ID,
                fiEngagementId: null,
                clientLE: leRestoredState
            };

            // 3. Retained membership becomes effective again post-restore
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(leRestoredState as any);
            vi.mocked(prisma.membership.findFirst).mockImplementation(async (args: any) => {
                if (args?.where?.clientLEId === ACTIVE_LE_ID) return restoredMembership as any;
                return null;
            });

            const roleRestored = await getCurrentUserLERole(ACTIVE_LE_ID);
            expect(roleRestored).toBe('LE_USER');

            const canViewRestored = await can({ id: USER_ID, memberships: [restoredMembership] }, Action.LE_VIEW_MASTER_DATA, { clientLEId: ACTIVE_LE_ID }, prisma);
            expect(canViewRestored).toBe(true);
        });
    });

    describe('Case A — deleted-only LE user (e.g. advisors@riskbridge)', () => {
        const USER_ID = 'user-advisors';

        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: 'advisors@riskbridge.com' } as any);
            vi.mocked(isSystemAdmin).mockResolvedValue(false);
        });

        it('1. Organisation does not appear in getUserContexts()', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-triki',
                    userId: USER_ID,
                    role: 'LE_USER',
                    organizationId: null,
                    clientLEId: DELETED_TRIKI_ID,
                    fiEngagementId: null,
                    organization: null,
                    clientLE: mockDeletedTriki,
                }
            ] as any);

            const contexts = await getUserContexts();

            expect(contexts.clients).toHaveLength(0);
            expect(contexts.legalEntities).toHaveLength(0);
        });

        it('2. Organisation Overview (getClientDashboardData) returns Unauthorized', async () => {
            vi.mocked(prisma.membership.findFirst).mockResolvedValue(null); // No direct org membership
            vi.mocked(prisma.membership.findMany).mockResolvedValue([]); // CASE B active LE query returns []

            const res = await getClientDashboardData(ORG_ID);

            expect(res.success).toBe(false);
            expect(res.error).toBe('Unauthorized');
        });

        it('3. Deleted Triki master data (getFullMasterData) cannot be reached', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: DELETED_TRIKI_ID,
                    role: 'LE_USER',
                    clientLE: mockDeletedTriki,
                }
            ] as any);

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(mockDeletedTriki as any);

            const res = await getFullMasterData(DELETED_TRIKI_ID);

            expect(res.success).toBe(false);
            expect(res.data).toEqual({});
        });

        it('4. Unassigned active LE in that org (getFullMasterData) cannot be reached', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: DELETED_TRIKI_ID,
                    role: 'LE_USER',
                    clientLE: mockDeletedTriki,
                }
            ] as any);

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(mockActiveLE1 as any);
            vi.mocked(prisma.clientLEOwner.findMany).mockResolvedValue([
                { clientLEId: ACTIVE_LE_ID, partyId: ORG_ID, clientLE: mockActiveLE1 }
            ] as any);

            const res = await getFullMasterData(ACTIVE_LE_ID);

            expect(res.success).toBe(false);
            expect(res.data).toEqual({});
        });

        it('5. getCurrentUserLERole returns null for soft-deleted LE', async () => {
            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(mockDeletedTriki as any);

            const role = await getCurrentUserLERole(DELETED_TRIKI_ID);

            expect(role).toBeNull();
        });
    });

    describe('Case B — active LE-only user isolation', () => {
        const USER_ID = 'user-active-le-only';

        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: USER_ID, email: 'active-le-user@example.com' } as any);
        });

        it('1. Parent organization and only assigned active LE appear in getUserContexts()', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    id: 'mem-active-1',
                    userId: USER_ID,
                    role: 'LE_USER',
                    organizationId: null,
                    clientLEId: ACTIVE_LE_ID,
                    fiEngagementId: null,
                    organization: null,
                    clientLE: mockActiveLE1,
                }
            ] as any);

            const contexts = await getUserContexts();

            expect(contexts.clients).toHaveLength(1);
            expect(contexts.clients[0].id).toBe(ORG_ID);
            expect(contexts.legalEntities).toHaveLength(1);
            expect(contexts.legalEntities[0].id).toBe(ACTIVE_LE_ID);
        });

        it('2. getClientDashboardData shows only the assigned active LE and denies canViewAllLEs', async () => {
            vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: USER_ID,
                    role: 'LE_USER',
                    clientLE: mockActiveLE1,
                }
            ] as any);

            const res = await getClientDashboardData(ORG_ID);

            expect(res.success).toBe(true);
            expect(res.data?.les).toHaveLength(1);
            expect(res.data?.les[0].id).toBe(ACTIVE_LE_ID);
            expect(res.data?.permissions.canViewAllLEs).toBe(false);
            expect(res.data?.permissions.canCreateLE).toBe(false);
        });

        it('3. Assigned active LE master data can be accessed', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: ACTIVE_LE_ID,
                    role: 'LE_USER',
                    clientLE: mockActiveLE1,
                }
            ] as any);

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(mockActiveLE1 as any);
            vi.mocked(prisma.clientLE.findFirst).mockResolvedValue(mockActiveLE1 as any);

            const res = await getFullMasterData(ACTIVE_LE_ID);

            expect(res.success).not.toBe(false);
        });

        it('4. Other unassigned active LE in same organization cannot be accessed server-side', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: USER_ID,
                    organizationId: null,
                    clientLEId: ACTIVE_LE_ID,
                    role: 'LE_USER',
                    clientLE: mockActiveLE1,
                }
            ] as any);

            vi.mocked(prisma.clientLE.findUnique).mockResolvedValue(mockActiveLE2 as any);
            vi.mocked(prisma.clientLEOwner.findMany).mockResolvedValue([
                { clientLEId: OTHER_ACTIVE_LE_ID, partyId: ORG_ID, clientLE: mockActiveLE2 }
            ] as any);

            const res = await getFullMasterData(OTHER_ACTIVE_LE_ID);

            expect(res.success).toBe(false);
            expect(res.data).toEqual({});
        });
    });

    describe('Case C — organization-level roles (ORG_ADMIN and ORG_MEMBER)', () => {
        const ADMIN_USER_ID = 'user-org-admin';
        const MEMBER_USER_ID = 'user-org-member';

        it('1. Org Admin can view organisation overview and all active LEs with management rights', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: ADMIN_USER_ID, email: 'org-admin@example.com' } as any);
            vi.mocked(prisma.membership.findFirst).mockResolvedValue({
                id: 'mem-org-admin',
                userId: ADMIN_USER_ID,
                organizationId: ORG_ID,
                role: 'ORG_ADMIN',
                organization: { id: ORG_ID, name: 'Entity Long Term Tests', status: 'ACTIVE', types: ['CLIENT'] }
            } as any);

            vi.mocked(prisma.clientLE.findMany).mockResolvedValue([mockActiveLE1, mockActiveLE2] as any);

            const res = await getClientDashboardData(ORG_ID);

            expect(res.success).toBe(true);
            expect(res.data?.permissions.canCreateLE).toBe(true);
            expect(res.data?.permissions.canManageOrg).toBe(true);
            expect(res.data?.permissions.canViewAllLEs).toBe(true);
            expect(res.data?.les).toHaveLength(2);
        });

        it('2. ORG_MEMBER can view organisation overview and active LEs but without management rights', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: MEMBER_USER_ID, email: 'org-member@example.com' } as any);
            vi.mocked(prisma.membership.findFirst).mockResolvedValue({
                id: 'mem-org-member',
                userId: MEMBER_USER_ID,
                organizationId: ORG_ID,
                role: 'ORG_MEMBER',
                organization: { id: ORG_ID, name: 'Entity Long Term Tests', status: 'ACTIVE', types: ['CLIENT'] }
            } as any);

            vi.mocked(prisma.clientLE.findMany).mockResolvedValue([mockActiveLE1, mockActiveLE2] as any);

            const res = await getClientDashboardData(ORG_ID);

            expect(res.success).toBe(true);
            expect(res.data?.permissions.canCreateLE).toBe(false);
            expect(res.data?.permissions.canManageOrg).toBe(false);
            expect(res.data?.permissions.canViewAllLEs).toBe(true);
            expect(res.data?.les).toHaveLength(2);
        });
    });

    describe('Case D — SysAdmin', () => {
        const SYS_ADMIN_ID = 'user-sysadmin';

        beforeEach(() => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: SYS_ADMIN_ID, email: 'sysadmin@example.com' } as any);
            vi.mocked(isSystemAdmin).mockResolvedValue(true);
        });

        it('1. getAllClientLEsForAdmin includes soft-deleted ClientLEs for admin directory', async () => {
            vi.mocked(prisma.clientLE.findMany).mockResolvedValue([
                mockActiveLE1,
                mockDeletedTriki
            ] as any);

            const adminList = await getAllClientLEsForAdmin();

            expect(adminList).toHaveLength(2);
            expect(adminList.find(l => l.id === DELETED_TRIKI_ID)?.isDeleted).toBe(true);
        });

        it('2. getFullMasterData allows SysAdmin access to deleted LE for restore/governance', async () => {
            vi.mocked(prisma.membership.findMany).mockResolvedValue([
                {
                    userId: SYS_ADMIN_ID,
                    role: 'SYSTEM_ADMIN',
                    organizationId: 'sys-org',
                    organization: { types: ['SYSTEM'] }
                }
            ] as any);

            vi.mocked(prisma.clientLE.findFirst).mockResolvedValue(mockDeletedTriki as any);

            const res = await getFullMasterData(DELETED_TRIKI_ID);

            expect(res.success).not.toBe(false);
        });
    });
});
