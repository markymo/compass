import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseFieldDefault, updateFieldManually } from '../kyc-manual-update';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';

// Mock Dependencies
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-123' })
}));
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-123')
    }
}));
vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        assertClaim: vi.fn().mockImplementation((input) => Promise.resolve({ id: 'claim-1', ...input }))
    }
}));
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockImplementation((fieldNo) => {
        if (fieldNo === 999) {
            return Promise.resolve({ fieldNo: 999, appDataType: 'BOOLEAN', isMultiValue: false });
        }
        return Promise.resolve({ fieldNo, appDataType: 'TEXT', isMultiValue: false });
    })
}));

vi.mock('@/lib/prisma', () => {
    return {
        default: {
            clientLE: {
                findUnique: vi.fn().mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc' })
            }
        }
    };
});

describe('BOOLEAN field manual updates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('releaseFieldDefault should parse "true" string into boolean true and pass to FieldClaimService as valueJson', async () => {
        const res = await releaseFieldDefault('le-123', 999, 'true');
        expect(res.success).toBe(true);

        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 999,
                valueJson: true // Canonical primitive boolean
            })
        );
    });

    it('updateFieldManually should pass primitive boolean through to FieldClaimService as valueJson', async () => {
        const res = await updateFieldManually('le-123', 999, false, 'Manual override');
        expect(res.success).toBe(true);

        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 999,
                valueJson: false // Canonical primitive boolean
            })
        );
    });
});
