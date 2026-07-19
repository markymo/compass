import { describe, it, expect, vi } from 'vitest';
import { getFullMasterData } from '../client-le';
import prisma from '@/lib/prisma';
import { KycStateService } from '@/lib/kyc/KycStateService';
import * as defService from '@/services/masterData/definitionService';

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { 
            findUnique: vi.fn().mockResolvedValue({ 
                id: 'cle_1', 
                legalEntityId: 'le_1', 
                gleifFetchedAt: new Date('2026-07-04T00:00:00Z'),
                registryReferences: [
                    {
                        lastSyncSucceededAt: new Date('2026-07-06T00:00:00Z'),
                        authority: { id: 'auth-1', registryKey: 'GB_COMPANIES_HOUSE', name: 'Companies House' }
                    }
                ]
            }) 
        },
        clientLEOwner: { findFirst: vi.fn().mockResolvedValue({ partyId: 'org-1' }) },
        customFieldDefinition: { findMany: vi.fn().mockResolvedValue([]) },
        sourceFieldMapping: { findMany: vi.fn().mockResolvedValue([{ targetFieldNo: 3, sourceType: 'COMPANIES_HOUSE', sourceReference: 'CH_123', priority: 1 }]) },
        cCParty: { findMany: vi.fn().mockResolvedValue([{ id: 'p-123', data: { contactType: 'PERSON', forenames: 'Manual', surname: 'Party' } }]) },
        $queryRaw: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-1' })
}));

vi.mock('@/actions/security', () => ({
    getUserFIOrg: vi.fn().mockResolvedValue(null)
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('test-scope'),
        resolveAllAttachments: vi.fn().mockResolvedValue(new Map()),
        resolveAllFields: vi.fn().mockResolvedValue(new Map([
            [3, {
                value: 'Test Value',
                sourceType: 'COMPANIES_HOUSE',
                sourceReference: 'COMPANIES_HOUSE',
                assertedAt: new Date('2026-01-01T00:00:00Z'),
                sourceCheckedAt: new Date('2026-07-06T00:00:00Z'),
                isScoped: false
            }]
        ])),
    }
}));

vi.mock('@/services/masterData/definitionService', () => ({
    listAllMasterFields: vi.fn().mockResolvedValue([
        { fieldNo: 3, fieldName: 'Legal Name', isMultiValue: false, appDataType: 'STRING' }
    ]),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/kyc/provenance-enricher', () => ({
    fetchProvenanceMap: vi.fn().mockResolvedValue({
        gleifFetchedAt: new Date('2026-07-04T00:00:00Z'),
        registrationAuthorityMap: new Map([['COMPANIES_HOUSE', new Date('2026-07-06T00:00:00Z')]])
    }),
    resolveSourceCheckedAt: vi.fn().mockReturnValue(new Date('2026-07-06T00:00:00Z'))
}));

describe('getFullMasterData /master display path', () => {
    it('includes source.lastValidatedAt in canonicalDisplayModel for POPULATED data', async () => {
        const result = await getFullMasterData('cle_1');
        expect(result.success).toBe(true);
        const data = result.data as any;
        expect(data[3].canonicalDisplayModel).toBeDefined();
        
        // Asserted time
        expect(data[3].canonicalDisplayModel?.source?.timestamp).toBe('2026-01-01T00:00:00.000Z');
        
        // The fix: Last validated time from provenance
        expect(data[3].canonicalDisplayModel?.source?.lastValidatedAt).toBe('2026-07-06T00:00:00.000Z');
    });

    it('includes source.lastValidatedAt when CHECKED_NO_DATA and no value exists', async () => {
        // override mock for this test
        vi.mocked(KycStateService.resolveAllFields).mockResolvedValueOnce(new Map([
            [3, null] // no claim found
        ]));
        
        const result = await getFullMasterData('cle_1');
        const data = result.data as any;
        expect(data[3].displayState).toBe('CHECKED_NO_DATA');
        expect(data[3].canonicalDisplayModel?.source?.type).toBe('COMPANIES_HOUSE');
        
        // No asserted time because there's no claim
        expect(data[3].canonicalDisplayModel?.source?.timestamp).toBeUndefined();
        
        // But lastValidatedAt should be present due to our fix
        expect(data[3].canonicalDisplayModel?.source?.lastValidatedAt).toBe('2026-07-06T00:00:00.000Z');
    });

    it('retains the full CollectionItemEnvelope and correct source provenance for repeated Party collections (Field 62 fix)', async () => {
        // Mock Field 62 data
        vi.mocked(KycStateService.resolveAllFields).mockResolvedValueOnce(new Map([
            [62, [
                {
                    value: { firstName: 'Alice', lastName: 'Smith', metadata_type: 'PERSON' },
                    sourceType: 'COMPANIES_HOUSE',
                    sourceReference: 'RA000585',
                    instanceId: 'inst-1'
                },
                {
                    value: { firstName: 'Bob', lastName: 'Jones', metadata_type: 'PERSON' },
                    sourceType: 'COMPANIES_HOUSE',
                    sourceReference: 'RA000585',
                    instanceId: 'inst-2'
                }
            ]]
        ]));

        vi.mocked(defService.listAllMasterFields).mockResolvedValueOnce([
            { fieldNo: 62, fieldName: 'Ultimate Beneficial Owners', isMultiValue: true, appDataType: 'PARTY' } as any
        ]);

        const result = await getFullMasterData('cle_1');
        const data = result.data as any;
        const displayModel = data[62].canonicalDisplayModel;

        expect(displayModel).toBeDefined();
        expect(displayModel.value.kind).toBe('collection');
        
        // 1. Should have preserved items with their canonical shapes
        expect(displayModel.value.items).toHaveLength(2);
        const firstItem = displayModel.value.items[0];

        // 2. The item should have a generated partyLabel
        expect(firstItem.value.kind).toBe('party');
        expect(firstItem.value.partyLabel).toBe('Alice Smith');
        
        // 3. The item should retain its exact source, NOT 'Registration Authority (unknown)'
        expect(firstItem.source.type).toBe('COMPANIES_HOUSE');
        expect(firstItem.source.reference).toBe('RA000585');
        
        // 4. The field-level source should be correctly computed as 'Companies House'
        // (RA000585 is an alias that normalises to COMPANIES_HOUSE, which hides the suffix)
        expect(displayModel.source.label).toBe('Companies House');
    });

    it('renders Field 63 mixed-source without merging and uses Canonical labels', async () => {
        vi.mocked(KycStateService.resolveAllFields).mockResolvedValueOnce(new Map([
            [63, [
                {
                    value: { firstName: 'Embedded', lastName: 'Source' },
                    sourceType: 'COMPANIES_HOUSE',
                    sourceReference: 'RA000585',
                    instanceId: 'inst-1'
                },
                {
                    value: { ccPartyId: 'p-123' },
                    sourceType: 'USER_INPUT',
                    instanceId: 'inst-2'
                }
            ]]
        ]));

        vi.mocked(defService.listAllMasterFields).mockResolvedValueOnce([
            { fieldNo: 63, fieldName: 'Mixed Parties', isMultiValue: true, appDataType: 'PARTY' } as any
        ]);

        const result = await getFullMasterData('cle_1');
        const data = result.data as any;
        const displayModel = data[63].canonicalDisplayModel;

        // 1. Both rows remain
        expect(displayModel.value.items).toHaveLength(2);
        
        const embedded = displayModel.value.items[0];
        const manualRef = displayModel.value.items[1];

        // 2. Both use canonical Party labels
        expect(embedded.value.partyLabel).toBe('Embedded Source');
        expect(manualRef.value.kind).toBe('party'); 
        expect(manualRef.value.partyLabel).toBe('Manual Party');
        
        // 3. Field level provenance is Multiple sources
        expect(displayModel.source.label).toBe('Multiple sources');
        
        // 4. Row level provenance remains
        expect(embedded.source.type).toBe('COMPANIES_HOUSE');
        expect(manualRef.source.type).toBe('USER_INPUT');
    });
});
