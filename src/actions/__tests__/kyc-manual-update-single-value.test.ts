import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addExistingCCPartyReferenceToField, createCCPartyAndReferenceField } from '../kyc-manual-update';
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
        assertClaim: vi.fn().mockImplementation((input) => Promise.resolve({ id: 'claim-1', ...input }))
    }
}));
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-123')
    }
}));
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockResolvedValue({ fieldNo: 133, appDataType: 'PARTY', isMultiValue: false })
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
