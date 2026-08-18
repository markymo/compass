import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { getAllClientLEsForAdmin, restoreClientLEFromAdmin } from '../admin';
import { isSystemAdmin } from '../security';
import { restoreClientLECore, deleteClientLE, createClientLE } from '../client';

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
        clientLEOwner: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
        fIEngagement: { findMany: vi.fn(), updateMany: vi.fn() },
        questionnaire: { updateMany: vi.fn() },
        membership: { findMany: vi.fn(), findFirst: vi.fn() }
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn()
}));

vi.mock('../security', () => ({
    isSystemAdmin: vi.fn()
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

describe('Admin ClientLE Soft-Delete Visibility & Restore Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAllClientLEsForAdmin', () => {
        it('rejects non-system admin with empty array', async () => {
            vi.mocked(isSystemAdmin).mockResolvedValue(false);

            const result = await getAllClientLEsForAdmin();

            expect(result).toEqual([]);
            expect(prismaMock.clientLE.findMany).not.toHaveBeenCalled();
        });

        it('returns both active and soft-deleted ClientLEs for System Admin', async () => {
            vi.mocked(isSystemAdmin).mockResolvedValue(true);
            prismaMock.clientLE.findMany.mockResolvedValue([
                {
                    id: 'le-active',
                    name: 'Active Corp',
                    shortCode: 'AC',
                    status: 'ACTIVE',
                    isDeleted: false,
                    createdAt: new Date('2026-01-01'),
                    owners: [],
                    fiEngagements: [{ id: 'eng-1' }],
                    memberships: [{ id: 'mem-1' }]
                },
                {
                    id: 'le-deleted',
                    name: 'Deleted Corp',
                    shortCode: 'DC',
                    status: 'ACTIVE',
                    isDeleted: true,
                    createdAt: new Date('2026-02-01'),
                    owners: [],
                    fiEngagements: [{ id: 'eng-2' }],
                    memberships: []
                }
            ]);

            const result = await getAllClientLEsForAdmin();

            expect(prismaMock.clientLE.findMany).toHaveBeenCalledWith({
                orderBy: { name: 'asc' },
                include: expect.any(Object)
            });
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 'le-active', name: 'Active Corp', isDeleted: false, status: 'ACTIVE' });
            expect(result[1]).toMatchObject({ id: 'le-deleted', name: 'Deleted Corp', isDeleted: true, status: 'ACTIVE' });
        });
    });

    describe('restoreClientLEFromAdmin authorization & execution', () => {
        it('rejects non-System Admin callers with Unauthorized error', async () => {
            vi.mocked(isSystemAdmin).mockResolvedValue(false);

            const result = await restoreClientLEFromAdmin('le-deleted');

            expect(result).toEqual({
                success: false,
                error: 'Unauthorized: Only System Admins can restore legal entities.'
            });
            expect(prismaMock.clientLE.update).not.toHaveBeenCalled();
        });

        it('allows System Admin to restore soft-deleted ClientLE, engagements, and questionnaires', async () => {
            vi.mocked(isSystemAdmin).mockResolvedValue(true);
            prismaMock.clientLE.update.mockResolvedValue({ id: 'le-deleted', isDeleted: false, status: 'ACTIVE' });
            prismaMock.fIEngagement.findMany.mockResolvedValue([{ id: 'eng-2' }]);

            const result = await restoreClientLEFromAdmin('le-deleted');

            expect(result).toEqual({ success: true });
            expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
                where: { id: 'le-deleted' },
                data: { isDeleted: false, status: 'ACTIVE' }
            });
            expect(prismaMock.fIEngagement.updateMany).toHaveBeenCalledWith({
                where: { clientLEId: 'le-deleted' },
                data: { isDeleted: false }
            });
            expect(prismaMock.questionnaire.updateMany).toHaveBeenCalledWith({
                where: { fiEngagementId: { in: ['eng-2'] } },
                data: { isDeleted: false }
            });
        });
    });

    describe('shared restoreClientLECore helper', () => {
        it('restores entity state without modifying documents, master data, or relationships', async () => {
            prismaMock.clientLE.update.mockResolvedValue({ id: 'le-1', isDeleted: false, status: 'ACTIVE' });
            prismaMock.fIEngagement.findMany.mockResolvedValue([{ id: 'eng-1' }, { id: 'eng-2' }]);

            const res = await restoreClientLECore('le-1');

            expect(res).toEqual({ id: 'le-1', isDeleted: false, status: 'ACTIVE' });
            expect(prismaMock.clientLE.update).toHaveBeenCalledWith({
                where: { id: 'le-1' },
                data: { isDeleted: false, status: 'ACTIVE' }
            });
            expect(prismaMock.fIEngagement.updateMany).toHaveBeenCalledWith({
                where: { clientLEId: 'le-1' },
                data: { isDeleted: false }
            });
            expect(prismaMock.questionnaire.updateMany).toHaveBeenCalledWith({
                where: { fiEngagementId: { in: ['eng-1', 'eng-2'] } },
                data: { isDeleted: false }
            });
        });
    });
});
