import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { deleteClientLE, createClientLE } from '../client';
import { LegalEntityEnrichmentService } from '@/services/legalEntityEnrichmentService';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        organization: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        clientLE: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn() },
        clientLEOwner: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
        fIEngagement: { findMany: vi.fn(), updateMany: vi.fn() },
        questionnaire: { updateMany: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn() },
        legalEntity: { findFirst: vi.fn(), create: vi.fn() },
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

describe('Normal Delete and Re-creation — ClientLE', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
        prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-1', types: ['CLIENT'] });
    });

    describe('deleteClientLE', () => {
        it('rejects unauthorized user', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'user-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([]);
            prismaMock.clientLE.findUnique.mockResolvedValue({ id: 'le-1' });

            const res = await deleteClientLE('le-1');

            expect(res).toEqual({
                success: false,
                error: 'Unauthorized: You do not have permission to delete this Legal Entity.'
            });
            expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
        });

        it('soft-deletes ClientLE, engagements, and questionnaires when authorized by Org Admin', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-1' } as any);
            prismaMock.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'org-1', party: { types: ['CLIENT'] } }]);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null, organization: { types: ['CLIENT'] } }
            ]);
            prismaMock.clientLE.findUnique.mockResolvedValue({ id: 'le-1' });
            prismaMock.fIEngagement.findMany.mockResolvedValue([{ id: 'eng-1' }]);

            const res = await deleteClientLE('le-1');

            expect(res).toEqual({ success: true });
            expect(prismaMock.questionnaire.updateMany).toHaveBeenCalledWith({
                where: { fiEngagementId: { in: ['eng-1'] } },
                data: { isDeleted: true }
            });
            expect(prismaMock.fIEngagement.updateMany).toHaveBeenCalledWith({
                where: { clientLEId: 'le-1' },
                data: { isDeleted: true }
            });
            expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
                where: { id: 'le-1' },
                data: { isDeleted: true }
            });
        });

        it('soft-deletes ClientLE when authorized by LE_ADMIN of the entity', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'le-admin-rob' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { clientLEId: 'le-zoom-1', role: 'LE_ADMIN', organizationId: null, fiEngagementId: null }
            ]);
            prismaMock.clientLE.findUnique.mockResolvedValue({ id: 'le-zoom-1' });
            prismaMock.fIEngagement.findMany.mockResolvedValue([]);

            const res = await deleteClientLE('le-zoom-1');

            expect(res).toEqual({ success: true });
            expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
                where: { id: 'le-zoom-1' },
                data: { isDeleted: true }
            });
        });
    });

    describe('createClientLE fresh creation after soft-delete', () => {
        it('creates a fresh ClientLE dossier when a soft-deleted record exists for the LEI', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null, organization: { types: ['CLIENT'] } }
            ]);
            prismaMock.legalEntity.findFirst.mockResolvedValue({ id: 'real-le-1', reference: '5493001KJTIIGC8Y1R12' });
            prismaMock.clientLE.findFirst.mockResolvedValue(null); // No active duplicate in org
            prismaMock.clientLE.create.mockResolvedValue({
                id: 'le-fresh-2',
                name: 'Acme Corp',
                lei: '5493001KJTIIGC8Y1R12',
                legalEntityId: 'real-le-1',
                isDeleted: false
            });

            const res = await createClientLE({
                name: 'Acme Corp',
                lei: '5493001KJTIIGC8Y1R12',
                explicitOrgId: 'org-1'
            });

            expect(res.success).toBe(true);
            expect(res.data.id).toBe('le-fresh-2');
            expect(prismaMock.clientLE.create).toHaveBeenCalled();
        });
    });
});
