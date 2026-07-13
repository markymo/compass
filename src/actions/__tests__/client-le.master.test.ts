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
});
