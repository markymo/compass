import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';
import { deleteClientLE, createClientLE } from '../client';
import { LegalEntityEnrichmentService } from '@/services/legalEntityEnrichmentService';

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
        clientLEOwner: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
        fIEngagement: { findMany: vi.fn(), updateMany: vi.fn() },
        questionnaire: { updateMany: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn() }
    }
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

describe('Normal Delete and Resurrection — ClientLE', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.clientLEOwner.findMany.mockResolvedValue([]);
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
            prismaMock.clientLEOwner.findMany.mockResolvedValue([{ partyId: 'org-1' }]);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null }
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
    });

    describe('createClientLE resurrection', () => {
        it('resurrects soft-deleted ClientLE, its engagements and questionnaires on LEI match', async () => {
            vi.mocked(getIdentity).mockResolvedValue({ userId: 'org-admin-1' } as any);
            prismaMock.membership.findMany.mockResolvedValue([
                { organizationId: 'org-1', role: 'ORG_ADMIN', clientLEId: null, fiEngagementId: null }
            ]);
            prismaMock.clientLE.findUnique.mockResolvedValue({
                id: 'le-1',
                name: 'Acme Corp',
                lei: '5493001KJTIIGC8Y1R12',
                isDeleted: true
            });
            prismaMock.clientLEOwner.findFirst.mockResolvedValue({ id: 'owner-1' });
            prismaMock.fIEngagement.findMany.mockResolvedValue([{ id: 'eng-1' }]);

            const res = await createClientLE({
                name: 'Acme Corp',
                lei: '5493001KJTIIGC8Y1R12',
                clientOrgId: 'org-1'
            });

            expect(res.success).toBe(true);
            expect(res.message).toContain('was previously deleted. It has been restored');

            // LE restored
            expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
                where: { id: 'le-1' },
                data: { isDeleted: false, status: 'ACTIVE' }
            });
            // Engagements restored
            expect(prismaMock.fIEngagement.updateMany).toHaveBeenCalledWith({
                where: { clientLEId: 'le-1' },
                data: { isDeleted: false }
            });
            // Questionnaires restored
            expect(prismaMock.questionnaire.updateMany).toHaveBeenCalledWith({
                where: { fiEngagementId: { in: ['eng-1'] } },
                data: { isDeleted: false }
            });
        });
    });
});
