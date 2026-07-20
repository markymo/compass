import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFieldDetail } from '../kyc-query';
import * as defService from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import prisma from '@/lib/prisma';

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
}));

vi.mock('@/lib/kyc/KycStateService', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        KycStateService: {
            ...actual.KycStateService,
            evaluateSyncAttempt: actual.KycStateService.evaluateSyncAttempt,
            calculateDisplayState: actual.KycStateService.calculateDisplayState,
            resolveScopeId: vi.fn().mockResolvedValue('test-scope'),
            getAuthoritativeValue: vi.fn().mockResolvedValue(null),
            getAuthoritativeCollection: vi.fn().mockResolvedValue(null),
        }
    };
});

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn().mockResolvedValue({ id: 'cle_1', legalEntityId: 'le_1' }) },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldGraphBinding: { findMany: vi.fn().mockResolvedValue([]) },
        cCParty: { findMany: vi.fn().mockResolvedValue([]) },
        masterFieldAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
        $queryRaw: vi.fn().mockResolvedValue([]),
        sourceFieldMapping: { findMany: vi.fn().mockResolvedValue([]) },
    }
}));

describe('kyc-query profileConfig', () => {
    it('should include profileConfig in the returned payload', async () => {
        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 63,
            fieldName: 'Test Field',
            isMultiValue: false,
            appDataType: 'PARTY',
            profileConfig: { displayMask: ['forenames', 'surname'] }
        } as any);

        const result = await getFieldDetail('cle_1', 63, 'CLIENT_LE');
        expect(result.profileConfig).toBeDefined();
        expect(result.profileConfig.displayMask).toEqual(['forenames', 'surname']);
    });
});
