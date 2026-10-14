import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    addExistingCCPartyReferenceToField,
    createCCPartyAndReferenceField,
    addExistingCCAddressReferenceToField,
    createCCAddressAndReferenceField,
    updateFieldManually
} from '../kyc-manual-update';
import { searchCCParties } from '../cc-party-actions';
import prisma from '@/lib/prisma';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    unstable_noStore: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user-123' }),
}));

vi.mock('@/lib/auth/permissions', () => ({
    can: vi.fn().mockResolvedValue(true),
    Action: { LE_EDIT_MASTER_DATA: 'LE_EDIT_MASTER_DATA', LE_VIEW_MASTER_DATA: 'LE_VIEW_MASTER_DATA' },
}));

vi.mock('@/lib/auth/api-auth', () => ({
    ensureApiAuthorization: vi.fn().mockResolvedValue({ userId: 'test-user-123' }),
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        assertClaim: vi.fn().mockResolvedValue({ id: 'claim-123' }),
    },
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-123'),
    },
}));

const mockDefinitions: Record<number, any> = {
    155: {
        fieldNo: 155,
        fieldName: 'Senior Managing Official',
        appDataType: 'PARTY',
        isMultiValue: false,
        profileConfig: {
            allowedPartyTypes: ['INDIVIDUAL'],
            allowedPartySubTypes: ['PERSON'],
            partyPopulationPolicy: 'SYSTEM_AND_CURATED',
        },
    },
    156: {
        fieldNo: 156,
        fieldName: 'System-Locked Party Field',
        appDataType: 'PARTY',
        isMultiValue: false,
        profileConfig: {
            allowedPartyTypes: ['INDIVIDUAL'],
            partyPopulationPolicy: 'SYSTEM_ONLY',
        },
    },
    138: {
        fieldNo: 138,
        fieldName: 'Registered Address',
        appDataType: 'ADDRESS',
        isMultiValue: false,
        profileConfig: {
            partyPopulationPolicy: 'SYSTEM_AND_CURATED',
        },
    },
    139: {
        fieldNo: 139,
        fieldName: 'System-Locked Address Field',
        appDataType: 'ADDRESS',
        isMultiValue: false,
        profileConfig: {
            partyPopulationPolicy: 'SYSTEM_ONLY',
        },
    },
};

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockImplementation((fieldNo: number) => {
        if (mockDefinitions[fieldNo]) {
            return Promise.resolve(mockDefinitions[fieldNo]);
        }
        return Promise.resolve({ fieldNo, appDataType: 'TEXT', isMultiValue: false });
    }),
    getComplexFieldConfig: vi.fn().mockReturnValue(null),
}));

const { mockPrisma } = vi.hoisted(() => {
    const mockPrisma = {
        clientLE: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        membership: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        cCParty: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
        cCAddress: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockPrisma)),
    };
    return { mockPrisma };
});

vi.mock('@/lib/prisma', () => ({
    default: mockPrisma,
}));

vi.mock('@/lib/master-data/party-v2/CCPartyData', () => ({
    isCCPartyData: vi.fn().mockReturnValue(true),
}));

vi.mock('@/services/masterData/cc-party-service', () => ({
    CCPartyService: {
        create: vi.fn().mockResolvedValue({ id: 'new-party-id' }),
        update: vi.fn().mockResolvedValue({ id: 'existing-party-id' }),
    },
}));

describe('R25 Single-Value PARTY and ADDRESS Routing & Enforcement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-ignore
        prisma.clientLE.findUnique.mockResolvedValue({
            id: 'le-123',
            name: 'Acme Corp',
            legalEntityId: 'legal-entity-123',
        });
    });

    describe('Single-value PARTY (Field 155)', () => {
        it('persists single-value party reference without rowId / instanceId', async () => {
            // @ts-ignore
            prisma.cCParty.findUnique.mockResolvedValue({
                id: 'party-person-1',
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    partySubType: 'PERSON',
                },
            });

            const res = await addExistingCCPartyReferenceToField('le-123', 155, 'party-person-1');
            expect(res.success).toBe(true);

            expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    fieldNo: 155,
                    valueJson: { ccPartyId: 'party-person-1' },
                    instanceId: undefined,
                    collectionId: undefined,
                })
            );
        });

        it('rejects party selection if subtype violates allowedPartySubTypes', async () => {
            // @ts-ignore
            prisma.cCParty.findUnique.mockResolvedValue({
                id: 'party-contact-1',
                data: {
                    schemaVersion: 2,
                    partyType: 'INDIVIDUAL',
                    partySubType: 'CONTACT',
                },
            });

            const res = await addExistingCCPartyReferenceToField('le-123', 155, 'party-contact-1');
            expect(res.success).toBe(false);
            expect(res.message).toContain('does not allow party subtype CONTACT');
        });

        it('rejects party creation if subtype violates allowedPartySubTypes', async () => {
            const forbiddenPartyData = {
                schemaVersion: 2,
                partyType: 'INDIVIDUAL',
                partySubType: 'CONTACT',
            };

            const res = await createCCPartyAndReferenceField('le-123', 155, forbiddenPartyData);
            expect(res.success).toBe(false);
            expect(res.message).toContain('does not allow party subtype CONTACT');
        });
    });

    describe('SYSTEM_ONLY Population Policy Enforcement', () => {
        it('rejects party linking when partyPopulationPolicy is SYSTEM_ONLY', async () => {
            const res = await addExistingCCPartyReferenceToField('le-123', 156, 'party-1');
            expect(res.success).toBe(false);
            expect(res.message).toContain('locked to authoritative sources');
            expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
        });

        it('rejects party creation when partyPopulationPolicy is SYSTEM_ONLY', async () => {
            const res = await createCCPartyAndReferenceField('le-123', 156, { partyType: 'INDIVIDUAL' });
            expect(res.success).toBe(false);
            expect(res.message).toContain('locked to authoritative sources');
            expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
        });

        it('rejects address linking when address/party policy is SYSTEM_ONLY', async () => {
            const res = await addExistingCCAddressReferenceToField('le-123', 139, 'addr-1');
            expect(res.success).toBe(false);
            expect(res.message).toContain('locked to authoritative sources');
            expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
        });

        it('rejects address creation when address/party policy is SYSTEM_ONLY', async () => {
            const res = await createCCAddressAndReferenceField('le-123', 139, { addressLines: ['1 Main St'] });
            expect(res.success).toBe(false);
            expect(res.message).toContain('locked to authoritative sources');
            expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
        });

        it('rejects manual curation in updateFieldManually for ADDRESS when SYSTEM_ONLY', async () => {
            const res = await updateFieldManually('le-123', 139, { ccAddressId: 'addr-1' }, 'Manual edit');
            expect(res.success).toBe(false);
            expect(res.message).toContain('locked to authoritative sources');
        });
    });

    describe('searchCCParties subtype filtering', () => {
        it('filters out parties with non-matching subtypes', async () => {
            // @ts-ignore
            prisma.cCParty.findMany.mockResolvedValue([
                {
                    id: 'p1',
                    data: {
                        partyType: 'INDIVIDUAL',
                        partySubType: 'PERSON',
                        forenames: 'Alice',
                        surname: 'Smith',
                    },
                },
                {
                    id: 'p2',
                    data: {
                        partyType: 'INDIVIDUAL',
                        partySubType: 'CONTACT',
                        forenames: 'Bob',
                        surname: 'Jones',
                    },
                },
            ]);

            const results = await searchCCParties('le-123', '', ['INDIVIDUAL'], ['PERSON']);
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('p1');
        });
    });

    describe('Single-value ADDRESS (Field 138)', () => {
        it('persists single-value address reference without rowId / instanceId', async () => {
            const res = await addExistingCCAddressReferenceToField('le-123', 138, 'addr-123');
            expect(res.success).toBe(true);

            expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
                expect.objectContaining({
                    fieldNo: 138,
                    valueJson: { ccAddressId: 'addr-123' },
                    instanceId: undefined,
                    collectionId: undefined,
                })
            );
        });
    });
});
