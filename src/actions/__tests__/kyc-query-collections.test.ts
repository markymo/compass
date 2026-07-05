import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFieldDetail, resolveMasterData } from '../kyc-query';
import { KycStateService } from '@/lib/kyc/KycStateService';
import * as defService from '@/services/masterData/definitionService';

vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn(),
    getMasterFieldGroup: vi.fn(),
}));

vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('test-scope'),
        getAuthoritativeCollection: vi.fn().mockResolvedValue([]),
        getAuthoritativeValue: vi.fn().mockResolvedValue(null)
    }
}));

vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: { findUnique: vi.fn().mockResolvedValue({ id: 'cle_1', legalEntityId: 'le_1' }) },
        clientLEOwner: { findFirst: vi.fn().mockResolvedValue({ partyId: 'party_1' }) },
    }
}));

describe('kyc-query structured collections', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass collectionId filter for STRUCTURED_COLLECTION fields in getFieldDetail (group)', async () => {
        // Field 20 is a STRUCTURED_COLLECTION in complex-field-config with collectionId 'SIC_CODES'
        vi.mocked(defService.getMasterFieldGroup).mockResolvedValue({
            id: 'group_1',
            name: 'Group 1',
            items: [{ fieldNo: 20 }]
        } as any);

        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 20,
            fieldName: 'SIC Codes',
            isMultiValue: true,
            appDataType: 'CODE_LIST'
        } as any);

        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            { value: { code: '35110', label: 'Production of electricity' }, isScoped: true, assertedAt: new Date() }
        ] as any);

        await getFieldDetail('cle_1', 0, 'CLIENT_LE', undefined, 'group_1');

        // Verify the 5th argument is 'SIC_CODES'
        expect(KycStateService.getAuthoritativeCollection).toHaveBeenCalledWith(
            { subjectLeId: 'le_1' },
            20,
            'test-scope',
            undefined,
            'SIC_CODES'
        );
    });

    it('should pass collectionId filter for STRUCTURED_COLLECTION fields in resolveMasterData (group)', async () => {
        // Field 20 is a STRUCTURED_COLLECTION in complex-field-config with collectionId 'SIC_CODES'
        vi.mocked(defService.getMasterFieldGroup).mockResolvedValue({
            id: 'group_1',
            name: 'Group 1',
            items: [{ fieldNo: 20 }]
        } as any);

        vi.mocked(defService.getMasterFieldDefinition).mockResolvedValue({
            fieldNo: 20,
            fieldName: 'SIC Codes',
            isMultiValue: true,
            appDataType: 'CODE_LIST'
        } as any);

        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            { value: { code: '35110', label: 'Production of electricity' }, isScoped: true, assertedAt: new Date() }
        ] as any);

        const questionnaireResponse = [
            {
                questionId: 'q1',
                masterQuestionGroupId: 'group_1'
            }
        ];

        await resolveMasterData('cle_1', questionnaireResponse as any);

        // Verify the 5th argument is 'SIC_CODES'
        expect(KycStateService.getAuthoritativeCollection).toHaveBeenCalledWith(
            { subjectLeId: 'le_1' },
            20,
            'test-scope',
            undefined,
            'SIC_CODES'
        );
    });
});
