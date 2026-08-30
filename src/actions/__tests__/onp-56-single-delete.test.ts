import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearSingleValueEntry } from '../kyc-manual-update';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import prisma from '@/lib/prisma';
import { getIdentity } from '@/lib/auth';

// Contract: MASTER-03 — Single-value Master fields can be cleared/deleted safely
// Linear: ONP-56

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn(),
    withServerActionAuth: vi.fn((fn) => fn),
    checkAuthorization: vi.fn(() => ({ userId: 'test-user-id' }))
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn()
        },
        clientLEOwner: {
            findFirst: vi.fn().mockResolvedValue({ partyId: 'party-1' })
        },
        masterFieldDefinition: {
            findUnique: vi.fn(),
            findMany: vi.fn()
        },
        membership: {
            findMany: vi.fn()
        },
        fieldClaim: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn()
        }
    }
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        emitTombstone: vi.fn(),
        verifyClaim: vi.fn()
    }
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn()
}));

describe('MASTER-03 / ONP-56 — Single-Value Master Fields Clear Unit Invariants', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'test-user-1' } as any);
        (prisma.clientLE.findUnique as any).mockResolvedValue({
            id: 'cle-1',
            legalEntityId: 'le-1',
            organizationId: 'org-1'
        });
        (prisma.masterFieldDefinition.findMany as any).mockResolvedValue([
            {
                fieldNo: 78,
                fieldName: 'primaryActivity',
                isMultiValue: false,
                categoryId: 'GENERAL'
            },
            {
                fieldNo: 30,
                fieldName: 'directors',
                isMultiValue: true,
                categoryId: 'PARTIES'
            }
        ]);
        (prisma.masterFieldDefinition.findUnique as any).mockResolvedValue({
            fieldNo: 78,
            fieldName: 'primaryActivity',
            isMultiValue: false,
            categoryId: 'GENERAL'
        });
    });

    it('1. Emits verified tombstone claim when clearing a field without manual claims', async () => {
        (prisma.fieldClaim.findMany as any).mockResolvedValue([]);
        (FieldClaimService.emitTombstone as any).mockResolvedValue({ id: 'tomb-1' });

        const result = await clearSingleValueEntry('cle-1', 78);

        expect(result).toEqual({ success: true });
        expect(FieldClaimService.emitTombstone).toHaveBeenCalledWith(
            expect.objectContaining({ clientLEId: 'cle-1', subjectLeId: 'le-1' }),
            78,
            'GENERAL',
            'single',
            expect.any(String)
        );
        expect(FieldClaimService.verifyClaim).toHaveBeenCalledWith('tomb-1', 'test-user-1');
    });

    it('2. Emits verified tombstone claim when clearing a manual override (preserving claim immutability)', async () => {
        (FieldClaimService.emitTombstone as any).mockResolvedValue({ id: 'tomb-2' });

        const result = await clearSingleValueEntry('cle-1', 78);

        expect(result).toEqual({ success: true });
        expect(FieldClaimService.emitTombstone).toHaveBeenCalledWith(
            expect.objectContaining({ clientLEId: 'cle-1', subjectLeId: 'le-1' }),
            78,
            'GENERAL',
            'single',
            expect.any(String)
        );
        expect(FieldClaimService.verifyClaim).toHaveBeenCalledWith('tomb-2', 'test-user-1');
        expect(prisma.fieldClaim.updateMany).not.toHaveBeenCalled();
    });

    it('3. Rejects clearSingleValueEntry on multi-value collection fields with clear error', async () => {
        (prisma.masterFieldDefinition.findUnique as any).mockResolvedValue({
            fieldNo: 30,
            fieldName: 'directors',
            isMultiValue: true,
            categoryId: 'PARTIES'
        });

        const result = await clearSingleValueEntry('cle-1', 30);

        expect(result.success).toBe(false);
        expect(FieldClaimService.emitTombstone).not.toHaveBeenCalled();
    });

    it('4. Requires authentication before clearing', async () => {
        vi.mocked(getIdentity).mockResolvedValue(null);

        const result = await clearSingleValueEntry('cle-1', 78);

        expect(result.success).toBe(false);
        expect(FieldClaimService.emitTombstone).not.toHaveBeenCalled();
    });
});
