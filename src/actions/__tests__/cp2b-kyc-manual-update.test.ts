import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCCPartyAndReferenceField, addExistingCCPartyReferenceToField } from '../kyc-manual-update';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'test-user' })
}));

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockResolvedValue({
        fieldNo: 63,
        fieldName: 'Directors',
        isMultiValue: true,
        appDataType: 'PARTY_REF'
    })
}));

const { mockPrismaDelete, mockPrismaUpdate, mockPrismaFindUnique } = vi.hoisted(() => ({
    mockPrismaDelete: vi.fn(),
    mockPrismaUpdate: vi.fn(),
    mockPrismaFindUnique: vi.fn()
}));

vi.mock('@prisma/client', async (importOriginal) => {
    const actual = await importOriginal<any>();
    class PrismaClient {
        clientLE = { findUnique: mockPrismaFindUnique };
        cCParty = {
            findUnique: mockPrismaFindUnique,
            delete: mockPrismaDelete,
            update: mockPrismaUpdate
        };
        $transaction = vi.fn().mockImplementation(async (cb) => cb(this));
        $extends = vi.fn().mockReturnValue(this);
    }
    return { ...actual, PrismaClient, Prisma: { defineExtension: vi.fn() } };
});

const { mockCCPartyServiceCreate, mockCCPartyServiceUpdate, mockAssertClaim, mockResolveScopeId } = vi.hoisted(() => ({
    mockCCPartyServiceCreate: vi.fn(),
    mockCCPartyServiceUpdate: vi.fn(),
    mockAssertClaim: vi.fn(),
    mockResolveScopeId: vi.fn().mockResolvedValue('scope-1')
}));

vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: { assertClaim: mockAssertClaim }
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: { resolveScopeId: mockResolveScopeId }
}));

vi.mock('@/services/masterData/cc-party-service', () => ({
    CCPartyService: {
        create: mockCCPartyServiceCreate,
        update: mockCCPartyServiceUpdate
    }
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

describe('CP2B Action Updates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrismaFindUnique.mockResolvedValue({ id: 'client-1', name: 'Test LE', legalEntityId: 'le-123', legalEntity: {} });
    });

    describe('createCCPartyAndReferenceField (Partial Failure)', () => {
        it('should attempt compensating deletion of CCParty if PARTY_REF creation fails', async () => {
            // 1. CCPartyService successfully creates the party
            mockCCPartyServiceCreate.mockResolvedValue({ id: 'new-party-123' });

            // 2. assertClaim fails (simulating graph rules or other failure)
            mockAssertClaim.mockResolvedValue(null);

            const result = await createCCPartyAndReferenceField('client-1', 1, { partyType: 'INDIVIDUAL' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Update failed');

            // 3. Assert compensating deletion was attempted
            expect(mockPrismaDelete).toHaveBeenCalledWith({ where: { id: 'new-party-123' } });
            
            // Prove that successful compensation leaves no orphan
            expect(mockPrismaUpdate).not.toHaveBeenCalled();
        });
    });

    describe('addExistingCCPartyReferenceToField (Field 63 Enrichment)', () => {
        it('should enrich and update if existing party is V2', async () => {
            mockPrismaFindUnique.mockImplementation(async (args) => {
                if (args.where.id === 'client-1') return { id: 'client-1', name: 'Company', legalEntityId: 'le-123' };
                if (args.where.id === 'party-1') return {
                    id: 'party-1',
                    clientLEId: 'client-1',
                    data: { schemaVersion: 2, roles: [] } // V2 Party
                };
            });

            mockAssertClaim.mockResolvedValue({ id: 'claim-1' });

            await addExistingCCPartyReferenceToField('client-1', 63, 'party-1');

            expect(mockCCPartyServiceUpdate).toHaveBeenCalledWith(expect.objectContaining({
                ccPartyId: 'party-1',
                data: expect.objectContaining({
                    roles: expect.arrayContaining([
                        expect.objectContaining({ roleType: 'director' })
                    ])
                })
            }));
        });

        it('should NOT enrich or rewrite if existing party is Legacy', async () => {
            mockPrismaFindUnique.mockImplementation(async (args) => {
                if (args.where.id === 'client-1') return { id: 'client-1', name: 'Company', legalEntityId: 'le-123' };
                if (args.where.id === 'party-2') return {
                    id: 'party-2',
                    clientLEId: 'client-1',
                    data: { roles: [] } // Legacy Party (no schemaVersion)
                };
            });

            mockAssertClaim.mockResolvedValue({ id: 'claim-1' });

            await addExistingCCPartyReferenceToField('client-1', 63, 'party-2');

            // Prove no update occurred
            expect(mockCCPartyServiceUpdate).not.toHaveBeenCalled();
            expect(mockPrismaUpdate).not.toHaveBeenCalled();
            
            expect(mockAssertClaim).toHaveBeenCalledWith(expect.objectContaining({
                fieldNo: 63,
                valueJson: { ccPartyId: 'party-2' }
            }));
        });
    });
});
