import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyManualOverride, createCCPartyAndReferenceField, addExistingCCPartyReferenceToField } from '../kyc-manual-update';
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
const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        clientLE: {
            findUnique: vi.fn(),
            update: vi.fn()
        },
        fieldClaim: {
            findUnique: vi.fn()
        },
        cCParty: {
            findUnique: vi.fn(),
            delete: vi.fn(),
            update: vi.fn()
        }
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma
}));
vi.mock('@/domain/kyc/FieldDefinitions', () => ({
    isValidFieldNo: vi.fn()
}));
vi.mock('@/domain/kyc/FieldGroups', () => ({
    FIELD_GROUPS: {}
}));
vi.mock('@prisma/client', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        PrismaClient: vi.fn()
    };
});
vi.mock('@/lib/master-data/party-v2/CCPartyData', () => ({
    isCCPartyData: vi.fn()
}));
vi.mock('@/services/masterData/cc-party-service', () => ({
    CCPartyService: {
        create: vi.fn(),
        update: vi.fn()
    }
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

describe('Party Eligibility Validation in kyc-manual-update', () => {
    let mockGetMasterFieldDefinition: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Mock getIdentity
        vi.mocked(getIdentity).mockResolvedValue({ userId: 'test-user' } as any);
        
        // We'll override the global mocks for our specific tests
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        mockGetMasterFieldDefinition = getMasterFieldDefinition as any;
        
        mockPrisma.clientLE.findUnique.mockResolvedValue({ id: 'le-123' });
        mockPrisma.cCParty.findUnique.mockReset();
        mockPrisma.cCParty.delete.mockReset();
        mockPrisma.cCParty.update.mockReset();
        
        const { isCCPartyData } = await import('@/lib/master-data/party-v2/CCPartyData');
        vi.mocked(isCCPartyData).mockReturnValue(true);
        
        const { CCPartyService } = await import('@/services/masterData/cc-party-service');
        vi.mocked(CCPartyService.create).mockResolvedValue({ id: 'new-party-123' } as any);
    });

    afterEach(() => {
        mockGetMasterFieldDefinition.mockResolvedValue({ fieldNo: 1, appDataType: 'TEXT' });
    });

    it('creating a forbidden party type is rejected', async () => {
        mockGetMasterFieldDefinition.mockResolvedValue({
            fieldNo: 64,
            fieldName: 'Test Field',
            profileConfig: { allowedPartyTypes: ['INDIVIDUAL'] }
        });

        const result = await createCCPartyAndReferenceField('le-123', 64, { partyType: 'ORGANISATION' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('does not allow party type ORGANISATION');
    });

    it('linking an existing forbidden party type is rejected', async () => {
        mockGetMasterFieldDefinition.mockResolvedValue({
            fieldNo: 64,
            fieldName: 'Test Field',
            profileConfig: { allowedPartyTypes: ['TEAM'] }
        });

        mockPrisma.cCParty.findUnique.mockResolvedValue({
            id: 'party-123',
            data: { partyType: 'INDIVIDUAL' }
        });

        const result = await addExistingCCPartyReferenceToField('le-123', 64, 'party-123');
        expect(result.success).toBe(false);
        expect(result.message).toContain('does not allow party type INDIVIDUAL');
    });

    it('undefined configuration permits valid canonical party types', async () => {
        mockGetMasterFieldDefinition.mockResolvedValue({
            fieldNo: 64,
            fieldName: 'Test Field',
            profileConfig: {} // undefined allowedPartyTypes
        });

        mockPrisma.cCParty.findUnique.mockResolvedValue({
            id: 'party-123',
            data: { partyType: 'ORGANISATION' }
        });
        
        // This should pass the allowedPartyTypes check and fail further down (e.g. updateFieldManually fails due to missing Prisma mocks for field claims), but success: false with a DIFFERENT error means it passed the check.
        const result = await addExistingCCPartyReferenceToField('le-123', 64, 'party-123');
        expect(result.message || '').not.toContain('does not allow party type');
    });

    it('an explicit empty array rejects all types', async () => {
        mockGetMasterFieldDefinition.mockResolvedValue({
            fieldNo: 64,
            fieldName: 'Test Field',
            profileConfig: { allowedPartyTypes: [] } // strictly empty
        });

        const result = await createCCPartyAndReferenceField('le-123', 64, { partyType: 'ORGANISATION' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('does not allow party type ORGANISATION');
    });
});

describe('ONP-6 Master Write Error Boundary & Discrimination', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-ignore
        prisma.clientLE.findUnique.mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc', customData: {} });
    });

    it('sanitizes raw Prisma/PostgreSQL database exceptions into unexpected failure with errorRef', async () => {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        // @ts-ignore
        getMasterFieldDefinition.mockResolvedValue({ fieldNo: 1, appDataType: 'TEXT' });

        // Simulate Prisma DB exception (e.g. UTF-8 NUL byte rejection 0x00)
        vi.mocked(FieldClaimService.assertClaim).mockRejectedValueOnce(
            new Error('Invalid byte sequence for encoding "UTF8": 0x00 at prisma.fieldClaim.create()')
        );

        const result = await applyManualOverride('le-123', 1, 'bad\0value', 'test');

        expect(result.success).toBe(false);
        expect((result as any).kind).toBe('unexpected');
        expect(result.message).toBe("We couldn’t save this field.");
        expect((result as any).errorRef).toMatch(/^ERR-[0-9A-F]{12}$/);
        expect(result.message).not.toContain('prisma');
        expect(result.message).not.toContain('0x00');
        expect(result.message).not.toContain('UTF8');
    });

    it('preserves intentional ActionDomainErrors as kind: domain without errorRef', async () => {
        const { getMasterFieldDefinition } = await import('@/services/masterData/definitionService');
        // @ts-ignore
        getMasterFieldDefinition.mockResolvedValue({
            fieldNo: 1,
            appDataType: 'PARTY',
            profileConfig: { partyPopulationPolicy: 'SYSTEM_ONLY' }
        });

        const result = await applyManualOverride('le-123', 1, 'value', 'test');

        expect(result.success).toBe(false);
        expect((result as any).kind).toBe('domain');
        expect(result.message).toContain('locked to authoritative sources');
        expect((result as any).errorRef).toBeUndefined();
    });
});


