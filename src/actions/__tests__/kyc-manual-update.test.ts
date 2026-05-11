import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyManualOverride } from '../kyc-manual-update';
import { KycWriteService } from '@/services/kyc/KycWriteService';
import prisma from '@/lib/prisma';
import { isValidFieldNo } from '@/domain/kyc/FieldDefinitions';
import { getIdentity } from '@/lib/auth';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';

// Mock Dependencies
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-123' })
}));
vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        assertClaim: vi.fn().mockResolvedValue({ id: 'claim-1' })
    }
}));
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-123')
    }
}));
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockResolvedValue({ fieldNo: 1, appDataType: 'TEXT' })
}));
vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn(),
            update: vi.fn()
        },
        fieldClaim: {
            findUnique: vi.fn()
        }
    }
}));
vi.mock('@/domain/kyc/FieldDefinitions', () => ({
    isValidFieldNo: vi.fn()
}));
vi.mock('@/domain/kyc/FieldGroups', () => ({
    FIELD_GROUPS: {}
}));

describe('applyManualOverride Routing Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default behavior
        // @ts-ignore
        isValidFieldNo.mockImplementation((n) => n > 0);
        // @ts-ignore
        prisma.clientLE.findUnique.mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc', customData: {} });
    });

    it('should route "0" to Custom Field (PrismaUpdate) because num=0 is falsy/invalid', async () => {
        // 0 is not > 0
        await applyManualOverride('le-123', '0', 'value', 'reason');

        // Should NOT call Service
        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();

        // Should call Prisma Update (Custom Field)
        expect(prisma.clientLE.update).toHaveBeenCalled();
    });

    it('should route standard field number (1) to Service', async () => {
        // 1 is > 0 and isValidFieldNo(1) is true
        await applyManualOverride('le-123', 1, 'value', 'reason');

        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(expect.objectContaining({
            fieldNo: 1,
            valueText: 'value',
            sourceReference: 'reason'
        }));
        expect(prisma.clientLE.update).not.toHaveBeenCalled();
    });

    it('should route custom key string to Custom Field (PrismaUpdate)', async () => {
        // "custom" -> NaN
        await applyManualOverride('le-123', 'custom_key', 'value', 'reason');

        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
        expect(prisma.clientLE.update).toHaveBeenCalled();
    });
});

