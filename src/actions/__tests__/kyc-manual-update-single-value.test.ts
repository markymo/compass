import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addExistingCCPartyReferenceToField, createCCPartyAndReferenceField, clearSingleValueEntry, removeMultiValueEntry } from '../kyc-manual-update';
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
        assertClaim: vi.fn().mockImplementation((input) => Promise.resolve({ id: 'claim-1', ...input })),
        emitTombstone: vi.fn().mockImplementation((subject, fieldNo, collectionId, instanceId, ownerScopeId) => Promise.resolve({ id: 'tombstone-123', fieldNo, instanceId })),
        verifyClaim: vi.fn().mockResolvedValue({})
    }
}));
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-123')
    }
}));
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockImplementation(async (fieldNo: number) => {
        if (fieldNo === 235) {
            return { fieldNo: 235, appDataType: 'SELECT', isMultiValue: true, categoryId: 'GENERAL' };
        }
        return { fieldNo: fieldNo || 133, appDataType: 'PARTY', isMultiValue: false, categoryId: 'GENERAL' };
    })
}));
vi.mock('@/services/masterData/cc-party-service', () => ({
    CCPartyService: {
        create: vi.fn().mockResolvedValue({ id: 'party-created' }),
        update: vi.fn().mockResolvedValue({ id: 'party-created' })
    }
}));

vi.mock('@/lib/prisma', () => {
    const inst = {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc' })
        },
        cCParty: {
            findUnique: vi.fn().mockResolvedValue({ id: 'party-123', data: { contactType: 'PERSON' } }),
            create: vi.fn().mockResolvedValue({ id: 'party-created', data: { contactType: 'PERSON' } }),
            update: vi.fn().mockResolvedValue({ id: 'party-created' }),
            delete: vi.fn().mockResolvedValue({ id: 'party-created' })
        },
        $transaction: vi.fn()
    };
    inst.$transaction.mockImplementation(async (cb) => cb(inst));
    return { default: inst };
});

vi.mock('@prisma/client', () => {
    const inst = {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ id: 'le-123', legalEntityId: 'le-abc' })
        },
        cCParty: {
            findUnique: vi.fn().mockResolvedValue({ id: 'party-123', data: { contactType: 'PERSON' } }),
            create: vi.fn().mockResolvedValue({ id: 'party-created', data: { contactType: 'PERSON' } }),
            update: vi.fn().mockResolvedValue({ id: 'party-created' }),
            delete: vi.fn().mockResolvedValue({ id: 'party-created' })
        },
        $transaction: vi.fn()
    };
    inst.$transaction.mockImplementation(async (cb) => cb(inst));
    
    return {
        PrismaClient: function() {
            return inst;
        },
        SourceType: {
            USER_INPUT: "USER_INPUT",
            REGISTRATION_AUTHORITY: "REGISTRATION_AUTHORITY",
            SYSTEM_DERIVED: "SYSTEM_DERIVED"
        }
    };
});

describe('addExistingCCPartyReferenceToField & createCCPartyAndReferenceField for single-value fields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should write single-value party claim with undefined instanceId and collectionId', async () => {
        const res = await addExistingCCPartyReferenceToField('le-123', 133, 'party-123');
        expect(res.success).toBe(true);

        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(expect.objectContaining({
            fieldNo: 133,
            valueJson: { ccPartyId: 'party-123' },
            instanceId: undefined,
            collectionId: undefined
        }));
    });

    it('should write single-value created party claim with undefined instanceId and collectionId', async () => {
        const v2Payload = {
            schemaVersion: 2,
            partyType: 'INDIVIDUAL',
            forenames: 'Test',
            emails: [],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            isActiveParty: true
        };
        const res = await createCCPartyAndReferenceField('le-123', 133, v2Payload);
        expect(res.success).toBe(true);

        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(expect.objectContaining({
            fieldNo: 133,
            valueJson: { ccPartyId: 'party-created' },
            instanceId: undefined,
            collectionId: undefined
        }));
    });

    it('should reject legacy V1 payloads', async () => {
        const res = await createCCPartyAndReferenceField('le-123', 133, { contactType: 'PERSON' });
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/Invalid CCPartyData V2/);
    });
});

describe('clearSingleValueEntry & removeMultiValueEntry server action contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clearSingleValueEntry emits tombstone claim for single-value field (F78)', async () => {
        const res = await clearSingleValueEntry('le-123', 78);
        expect(res.success).toBe(true);
        expect(FieldClaimService.emitTombstone).toHaveBeenCalledWith(
            { subjectLeId: 'le-abc', clientLEId: 'le-123' },
            78,
            'GENERAL',
            'single',
            'scope-123'
        );
        expect(FieldClaimService.verifyClaim).toHaveBeenCalledWith('tombstone-123', 'user-123');
    });

    it('clearSingleValueEntry rejects multi-value field (F235)', async () => {
        const res = await clearSingleValueEntry('le-123', 235);
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/multi-value collection/i);
        expect(FieldClaimService.emitTombstone).not.toHaveBeenCalled();
    });

    it('removeMultiValueEntry rejects single-value field (F78)', async () => {
        const res = await removeMultiValueEntry('le-123', 78, 'current');
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/is not multi-value/i);
        expect(FieldClaimService.emitTombstone).not.toHaveBeenCalled();
    });
});
