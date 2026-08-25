import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { updateLEBilling, getClientBillingData } from '../billing';
import { can, Action, Role } from '@/lib/auth/permissions';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        clientLE: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            update: vi.fn()
        },
        clientLEOwner: {
            findFirst: vi.fn(),
            findMany: vi.fn().mockResolvedValue([])
        },
        organization: {
            findUnique: vi.fn()
        },
        membership: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn()
        }
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

const prismaMock = prisma as any;

describe('Billing Authorization — updateLEBilling Security Tests', () => {
    const LE_ID = 'le-alpha-1';
    const OWNING_ORG_ID = 'org-client-a';
    const UNRELATED_ORG_ID = 'org-client-b';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock for clientLEOwner: LE_ID is actively owned by OWNING_ORG_ID
        prismaMock.clientLEOwner.findFirst.mockResolvedValue({
            id: 'owner-rel-1',
            clientLEId: LE_ID,
            partyId: OWNING_ORG_ID,
            endAt: null,
            clientLE: { isDeleted: false }
        });

        prismaMock.clientLE.update.mockResolvedValue({
            id: LE_ID,
            billingDetails: { taxId: 'GB999888777' }
        });
    });

    it('rejects unauthenticated caller', async () => {
        vi.mocked(getIdentity).mockResolvedValue(null);

        const result = await updateLEBilling(LE_ID, { taxId: 'GB999888777' });

        expect(result).toEqual({ success: false, error: 'Unauthorized' });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });

    it('allows owning-org ORG_ADMIN to update billing', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-user', email: 'admin@client-a.com' });
        prismaMock.membership.findMany.mockResolvedValue([
            {
                organizationId: OWNING_ORG_ID,
                clientLEId: null,
                fiEngagementId: null,
                role: Role.ORG_ADMIN,
                clientLE: null
            }
        ]);

        const result = await updateLEBilling(LE_ID, { taxId: 'GB999888777' });

        expect(result).toEqual({ success: true });
        expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
            where: { id: LE_ID },
            data: { billingDetails: { taxId: 'GB999888777' } }
        });
    });

    it('DENIES LE_ADMIN from updating billing merely because they administer that ClientLE', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-user', email: 'leadmin@client-a.com' });
        // User has LE_ADMIN on the ClientLE, but NO ORG_ADMIN membership on the owning organisation
        prismaMock.membership.findMany.mockResolvedValue([
            {
                organizationId: null,
                clientLEId: LE_ID,
                fiEngagementId: null,
                role: Role.LE_ADMIN,
                clientLE: { isDeleted: false, status: 'ACTIVE' }
            }
        ]);

        const result = await updateLEBilling(LE_ID, { taxId: 'HACKED_TAX_ID' });

        expect(result).toEqual({
            success: false,
            error: 'Unauthorized: You do not have permission to edit billing details.'
        });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });

    it('DENIES LE_USER from updating billing', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-worker-user', email: 'worker@client-a.com' });
        prismaMock.membership.findMany.mockResolvedValue([
            {
                organizationId: null,
                clientLEId: LE_ID,
                fiEngagementId: null,
                role: Role.LE_USER,
                clientLE: { isDeleted: false, status: 'ACTIVE' }
            }
        ]);

        const result = await updateLEBilling(LE_ID, { taxId: 'HACKED_TAX_ID' });

        expect(result).toEqual({
            success: false,
            error: 'Unauthorized: You do not have permission to edit billing details.'
        });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });

    it('DENIES ORG_MEMBER from updating billing', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-member-user', email: 'member@client-a.com' });
        prismaMock.membership.findMany.mockResolvedValue([
            {
                organizationId: OWNING_ORG_ID,
                clientLEId: null,
                fiEngagementId: null,
                role: Role.ORG_MEMBER,
                clientLE: null
            }
        ]);

        const result = await updateLEBilling(LE_ID, { taxId: 'HACKED_TAX_ID' });

        expect(result).toEqual({
            success: false,
            error: 'Unauthorized: You do not have permission to edit billing details.'
        });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });

    it('DENIES ORG_ADMIN of an unrelated organisation from updating billing', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'other-org-admin', email: 'admin@client-b.com' });
        // User is ORG_ADMIN of UNRELATED_ORG_ID, not OWNING_ORG_ID
        prismaMock.membership.findMany.mockResolvedValue([
            {
                organizationId: UNRELATED_ORG_ID,
                clientLEId: null,
                fiEngagementId: null,
                role: Role.ORG_ADMIN,
                clientLE: null
            }
        ]);

        const result = await updateLEBilling(LE_ID, { taxId: 'HACKED_TAX_ID' });

        expect(result).toEqual({
            success: false,
            error: 'Unauthorized: You do not have permission to edit billing details.'
        });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });

    it('allows SYSTEM_ADMIN to update billing', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'sysadmin-user', email: 'sysadmin@coparity.com' });
        prismaMock.membership.findMany.mockResolvedValue([
            {
                organizationId: 'system-org',
                clientLEId: null,
                fiEngagementId: null,
                role: Role.SYSTEM_ADMIN,
                clientLE: null
            }
        ]);

        const result = await updateLEBilling(LE_ID, { taxId: 'SYS_ADMIN_OVERRIDE' });

        expect(result).toEqual({ success: true });
        expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
            where: { id: LE_ID },
            data: { billingDetails: { taxId: 'SYS_ADMIN_OVERRIDE' } }
        });
    });

    it('fails safely when ClientLE has no active owner or does not exist', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-user', email: 'admin@client-a.com' });
        prismaMock.clientLEOwner.findFirst.mockResolvedValue(null);

        const result = await updateLEBilling('non-existent-le', { taxId: 'TEST' });

        expect(result).toEqual({
            success: false,
            error: 'Legal Entity not found or has no active owner.'
        });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });

    it('fails safely when ClientLE is soft-deleted', async () => {
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-user', email: 'admin@client-a.com' });
        prismaMock.clientLEOwner.findFirst.mockResolvedValue({
            id: 'owner-rel-1',
            clientLEId: LE_ID,
            partyId: OWNING_ORG_ID,
            endAt: null,
            clientLE: { isDeleted: true }
        });

        const result = await updateLEBilling(LE_ID, { taxId: 'TEST' });

        expect(result).toEqual({
            success: false,
            error: 'Legal Entity not found or has no active owner.'
        });
        expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
    });
});

describe('Permissions Engine — Action.ORG_MANAGE_BILLING direct evaluation', () => {
    const mockPrismaEngine = {
        clientLEOwner: {
            findMany: vi.fn().mockResolvedValue([])
        }
    };

    it('allows ORG_ADMIN with partyId context', async () => {
        const user = {
            id: 'user-1',
            memberships: [{ organizationId: 'org-1', clientLEId: null, fiEngagementId: null, role: Role.ORG_ADMIN }]
        };

        const allowed = await can(user, Action.ORG_MANAGE_BILLING, { partyId: 'org-1' }, mockPrismaEngine as any);
        expect(allowed).toBe(true);
    });

    it('denies ORG_MEMBER with partyId context', async () => {
        const user = {
            id: 'user-2',
            memberships: [{ organizationId: 'org-1', clientLEId: null, fiEngagementId: null, role: Role.ORG_MEMBER }]
        };

        const allowed = await can(user, Action.ORG_MANAGE_BILLING, { partyId: 'org-1' }, mockPrismaEngine as any);
        expect(allowed).toBe(false);
    });

    it('denies LE_ADMIN with partyId context', async () => {
        const user = {
            id: 'user-3',
            memberships: [{ organizationId: null, clientLEId: 'le-1', fiEngagementId: null, role: Role.LE_ADMIN }]
        };

        const allowed = await can(user, Action.ORG_MANAGE_BILLING, { partyId: 'org-1' }, mockPrismaEngine as any);
        expect(allowed).toBe(false);
    });

    it('denies LE_USER with partyId context', async () => {
        const user = {
            id: 'user-4',
            memberships: [{ organizationId: null, clientLEId: 'le-1', fiEngagementId: null, role: Role.LE_USER }]
        };

        const allowed = await can(user, Action.ORG_MANAGE_BILLING, { partyId: 'org-1' }, mockPrismaEngine as any);
        expect(allowed).toBe(false);
    });
});
