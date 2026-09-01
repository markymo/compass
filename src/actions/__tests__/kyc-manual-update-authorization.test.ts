import { describe, it, expect, vi } from 'vitest';
vi.mock('next-auth', () => ({ default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })), getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));

import { updateFieldManually, updateCustomFieldManually } from '../kyc-manual-update';
import prisma from '@/lib/prisma';
import * as auth from '@/lib/auth';
import * as permissions from '@/lib/auth/permissions';

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1' })
}));
vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: { LE_EDIT_MASTER_DATA: 'le:edit_master_data' }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        membership: { findMany: vi.fn().mockResolvedValue([]) },
        clientLE: { findUnique: vi.fn().mockResolvedValue({ id: 'cle-1', legalEntityId: 'le-1' }) },
        fieldClaim: { findMany: vi.fn() },
        sourceFieldMapping: { findMany: vi.fn() },
    }
}));

describe('kyc-manual-update authorization checks', () => {
    it('throws ActionDomainError when caller lacks LE_EDIT_MASTER_DATA for updateFieldManually', async () => {
        vi.mocked(permissions.can).mockResolvedValueOnce(false);
        const res = await updateFieldManually('cle-1', 1, 'Value', 'Test');
        expect(res.success).toBe(false);
        expect(res.message).toContain('Unauthorized');
    });

    it('throws ActionDomainError when caller lacks LE_EDIT_MASTER_DATA for updateCustomFieldManually', async () => {
        vi.mocked(permissions.can).mockResolvedValueOnce(false);
        const res = await updateCustomFieldManually('cle-1', 'custom_1', 'Value', 'Test');
        expect(res.success).toBe(false);
        expect(res.message).toContain('Unauthorized');
    });
});
