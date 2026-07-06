import { describe, it, expect, vi } from 'vitest';
import { getFieldDetail } from '../kyc-query';
import * as defService from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import prisma from '@/lib/prisma';

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('test-scope'),
        getAuthoritativeValue: vi.fn().mockResolvedValue({
            value: 'Test Value',
            sourceType: 'COMPANIES_HOUSE',
            sourceReference: 'CH_123',
            assertedAt: new Date('2026-01-01T00:00:00Z'),
            sourceCheckedAt: new Date('2026-07-03T00:00:00Z'),
            confidenceScore: 1.0,
            claimId: 'claim_1'
        }),
        getAuthoritativeCollection: vi.fn().mockResolvedValue(null),
    }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn().mockResolvedValue({ id: 'cle_1', legalEntityId: 'le_1', registryReferences: [] }) },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGraphBinding: { findMany: vi.fn().mockResolvedValue([]) },
        cCParty: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
        $queryRaw: vi.fn().mockResolvedValue([]),
        sourceFieldMapping: { findMany: vi.fn().mockResolvedValue([{ sourceType: 'COMPANIES_HOUSE', sourceReference: 'CH_123', priority: 1 }]) },
        clientLE: { 
            findUnique: vi.fn().mockResolvedValue({ 
                legalEntityId: 'le-1', 
                gleifFetchedAt: new Date('2026-07-04T00:00:00Z'),
                registryReferences: [
                    {
                        lastSyncSucceededAt: new Date('2026-07-06T00:00:00Z'),
                        authority: { id: 'auth-1', registryKey: 'GB_COMPANIES_HOUSE', name: 'Companies House' }
                    }
                ]
            })
        },
        enrichmentRun: { 
            findFirst: vi.fn().mockResolvedValue({ completedAt: new Date('2026-07-03T00:00:00Z') }),
            findMany: vi.fn().mockResolvedValue([{ registrationAuthorityId: 'CH_123', completedAt: new Date('2026-07-03T00:00:00Z') }]) 
        },
    }
}));

describe('kyc-query provenance', () => {
    it('should propagate sourceCheckedAt to canonicalDisplayModel.source.lastValidatedAt', async () => {
        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 3,
            fieldName: 'Legal Name',
            isMultiValue: false,
            appDataType: 'STRING'
        } as any);

        const result = await getFieldDetail('cle_1', 3, 'CLIENT_LE');
        expect(result.canonicalDisplayModel).toBeDefined();
        
        // Asserted time
        expect(result.canonicalDisplayModel?.source?.timestamp).toBe('2026-01-01T00:00:00.000Z');
        
        // The fix: Last validated time
        expect(result.canonicalDisplayModel?.source?.lastValidatedAt).toBe('2026-07-03T00:00:00.000Z');
    });
});
