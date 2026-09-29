import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    membership: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    organization: { findMany: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({ default: mocks }));
vi.mock('@/lib/auth/permissions', () => ({ Action: {}, ensureAuthorization: vi.fn(), can: vi.fn().mockResolvedValue(true) }));
vi.mock('@/lib/auth', () => ({ getIdentity: vi.fn().mockResolvedValue({ userId: 'admin' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from 'next/cache';
import { assignClientRole, searchClients } from '../super-admin-users';
import { updateMembershipRole, removeMembership } from '../memberships';
import { ensureAuthorization } from '@/lib/auth/permissions';

beforeEach(() => { vi.clearAllMocks(); mocks.membership.findFirst.mockResolvedValue(null); mocks.membership.findMany.mockResolvedValue([]); });
const assertRefreshed = () => {
    expect(revalidatePath).toHaveBeenCalledWith('/app/admin/organizations');
    expect(revalidatePath).toHaveBeenCalledWith('/app/admin/organizations/org-b');
};
describe('R01 membership writes', () => {
    it('assigns by selected stable ID and refreshes both organisation routes', async () => {
        expect(await assignClientRole({ userId: 'rob', clientId: 'org-b', role: 'ORG_ADMIN' })).toEqual({ success: true });
        expect(mocks.membership.create).toHaveBeenCalledWith({ data: { userId: 'rob', organizationId: 'org-b', role: 'ORG_ADMIN' } });
        assertRefreshed();
    });
    it('refreshes removal through the user editor', async () => {
        await assignClientRole({ userId: 'rob', clientId: 'org-b', role: 'NONE' });
        expect(mocks.membership.deleteMany).toHaveBeenCalledWith({ where: { userId: 'rob', organizationId: 'org-b' } });
        assertRefreshed();
    });
    it.each(['role', 'remove'])('refreshes %s through organisation detail', async kind => {
        mocks.membership.findUnique.mockResolvedValue({ id: 'membership', userId: 'rob', organizationId: 'org-b', role: 'ORG_ADMIN' });
        if (kind === 'role') await updateMembershipRole('membership', 'ORG_MEMBER');
        else await removeMembership('membership');
        assertRefreshed();
    });
    it('denies an unauthorised assignment without writing', async () => {
        vi.mocked(ensureAuthorization).mockRejectedValueOnce(new Error('Unauthorized'));
        await expect(assignClientRole({ userId: 'rob', clientId: 'org-b', role: 'ORG_ADMIN' })).rejects.toThrow('Unauthorized');
        expect(mocks.membership.create).not.toHaveBeenCalled();
    });
    it('returns distinguishing data and every role for selectors', async () => {
        mocks.organization.findMany.mockResolvedValue([{ id: 'org-b', name: 'Nobina', shortCode: 'NOB', domain: 'example.test', types: ['SUPPLIER', 'CLIENT'] }]);
        expect(await searchClients('Nobina')).toEqual([expect.objectContaining({ id: 'org-b', shortCode: 'NOB', domain: 'example.test', types: ['SUPPLIER', 'CLIENT'] })]);
    });
});
