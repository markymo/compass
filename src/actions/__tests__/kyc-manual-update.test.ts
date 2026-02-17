import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyManualOverride } from '../kyc-manual-update';
import { KycWriteService } from '@/services/kyc/KycWriteService';
import prisma from '@/lib/prisma';
import { isValidFieldNo } from '@/domain/kyc/FieldDefinitions';

// Mock Dependencies
vi.mock('@/services/kyc/KycWriteService');
vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn(),
            update: vi.fn()
        }
    }
}));
vi.mock('@/domain/kyc/FieldDefinitions', () => ({
    isValidFieldNo: vi.fn()
}));
vi.mock('@/domain/kyc/FieldGroups', () => ({
    FIELD_GROUPS: {}
}));


// Access mocked instances
const mockApplyManualOverride = vi.fn(); // Service method
// @ts-ignore
KycWriteService.prototype.applyManualOverride = mockApplyManualOverride;

describe('applyManualOverride Routing Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default behavior
        // @ts-ignore
        isValidFieldNo.mockImplementation((n) => n > 0);
        // @ts-ignore
        prisma.clientLE.findUnique.mockResolvedValue({ id: 'le-123', customData: {} });
    });

    it('should route "0" to Custom Field (PrismaUpdate) because num=0 is falsy/invalid', async () => {
        // 0 is not > 0
        await applyManualOverride('le-123', '0', 'value', 'reason');

        // Should NOT call Service
        expect(mockApplyManualOverride).not.toHaveBeenCalled();

        // Should call Prisma Update (Custom Field)
        expect(prisma.clientLE.update).toHaveBeenCalled();
    });

    it('should route standard field number (1) to Service', async () => {
        // 1 is > 0 and isValidFieldNo(1) is true
        await applyManualOverride('le-123', 1, 'value', 'reason');

        expect(mockApplyManualOverride).toHaveBeenCalledWith('le-123', 1, 'value', 'reason', expect.any(String));
        expect(prisma.clientLE.update).not.toHaveBeenCalled();
    });

    it('should route custom key string to Custom Field (PrismaUpdate)', async () => {
        // "custom" -> NaN
        await applyManualOverride('le-123', 'custom_key', 'value', 'reason');

        expect(mockApplyManualOverride).not.toHaveBeenCalled();
        expect(prisma.clientLE.update).toHaveBeenCalled();
    });
});

