import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addMultiValueEntry, removeMultiValueEntry } from '../kyc-manual-update';
import prisma from '@/lib/prisma';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        masterFieldDefinition: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        masterFieldGraphBinding: {
            findMany: vi.fn(),
        },
        clientLE: {
            findUnique: vi.fn(),
        },
        fieldClaim: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1', orgId: 'org-1' }),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        emitTombstone: vi.fn().mockResolvedValue({ id: 'tombstone-1' }),
        verifyClaim: vi.fn().mockResolvedValue(true),
        createClaim: vi.fn().mockResolvedValue({ id: 'claim-new' }),
    }
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-1'),
    }
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockResolvedValue({
        fieldNo: 235,
        fieldName: 'Corporate Sector(s)',
        appDataType: 'SELECT',
        isMultiValue: true,
        categoryId: 'SECTOR',
    }),
}));

describe('MASTER-05 / ONP-55 — Multi-Value Master Collection Lifecycle Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removeMultiValueEntry emits tombstone for specific instanceId and preserves collection', async () => {
        mockPrisma.masterFieldGraphBinding.findMany.mockResolvedValue([]);
        mockPrisma.clientLE.findUnique.mockResolvedValue({ id: 'cle-1', legalEntityId: 'le-1' });
        mockPrisma.fieldClaim.findUnique.mockResolvedValue({
            id: 'claim-100',
            instanceId: 'row-abc',
            collectionId: 'SECTOR',
            fieldNo: 235,
        });

        const result = await removeMultiValueEntry('cle-1', 235, 'claim-100');
        expect(result.success).toBe(true);
        expect(FieldClaimService.emitTombstone).toHaveBeenCalledWith(
            { subjectLeId: 'le-1', clientLEId: 'cle-1' },
            235,
            'SECTOR',
            'row-abc',
            'scope-1'
        );
    });
});
