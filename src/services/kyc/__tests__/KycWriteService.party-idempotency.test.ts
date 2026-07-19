/**
 * KycWriteService.party-idempotency.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaimStatus, SourceType } from '@prisma/client';

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');
vi.mock('@/lib/kyc/KycStateService');
vi.mock('@/lib/kyc/FieldClaimService');
vi.mock('@/lib/master-data/complex-field-config');
vi.mock('@/lib/master-data/field-types', () => ({
    APP_DATA_TYPES: { PARTY: 'PARTY', PARTY_REF: 'PARTY_REF', JSONB: 'JSONB' },
    isKnownAppDataType: () => true,
}));
vi.mock('@/lib/kyc/source-priority-config', () => ({
    getFallbackPriority: () => 500,
    USER_INPUT_PRIORITY: 0,
}));

import prismaMock from '@/lib/__mocks__/prisma';
import { getMasterFieldDefinition, listAllMasterGroupsWithItems } from '@/services/masterData/definitionService';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { KycWriteService } from '@/services/kyc/KycWriteService';

const FIELD_63_DEF = {
    fieldNo: 63,
    fieldName: 'Beneficial Owners',
    appDataType: 'PARTY',
    isMultiValue: true,
};

describe('KycWriteService - Party Idempotency (CP5C)', () => {
    let writeService: KycWriteService;

    beforeEach(() => {
        vi.clearAllMocks();
        writeService = new KycWriteService();

        vi.mocked(getMasterFieldDefinition).mockResolvedValue(FIELD_63_DEF as any);
        vi.mocked(FieldClaimService.assertClaim).mockResolvedValue(true);
        prismaMock.clientLE.findUnique.mockResolvedValue({ id: 'le_1', legalEntityId: 'real_le_1' } as any);
        prismaMock.question = { findMany: vi.fn().mockResolvedValue([]) } as any;
        
        // Mock listAllMasterGroupsWithItems which is imported from definitionService
        vi.mocked(listAllMasterGroupsWithItems).mockResolvedValue([]);
    });

    it('1. unchanged repeated embedded PARTY creates no claim', async () => {
        const rowId = 'ch::psc_123';
        const value = { name: 'John Doe', roles: [{ roleType: 'PSC' }] };

        // Mock current collection state
        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            { instanceId: rowId, value, sourceType: 'REGISTRATION_AUTHORITY' } as any
        ]);
        
        prismaMock.fieldClaim.findFirst.mockResolvedValue({
            id: 'claim_1',
            instanceId: rowId,
            sourceType: 'REGISTRATION_AUTHORITY',
            valueJson: value
        } as any);

        const result = await writeService.updateField(
            'le_1', 63, value, { source: 'REGISTRATION_AUTHORITY' }, rowId, 'LEGAL_ENTITY'
        );

        expect(result).toBe(true); // skips
        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
    });

    it('2. changed Party snapshot appends under the same instanceId', async () => {
        const rowId = 'ch::psc_123';
        const oldValue = { name: 'John Doe', roles: [{ roleType: 'PSC' }] };
        const newValue = { name: 'John Doe', roles: [{ roleType: 'PSC', isActiveRole: false }] };

        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            { instanceId: rowId, value: oldValue, sourceType: 'REGISTRATION_AUTHORITY' } as any
        ]);

        prismaMock.fieldClaim.findFirst.mockResolvedValue({
            id: 'claim_1',
            instanceId: rowId,
            sourceType: 'REGISTRATION_AUTHORITY',
            valueJson: oldValue
        } as any);

        const result = await writeService.updateField(
            'le_1', 63, newValue, { source: 'REGISTRATION_AUTHORITY' }, rowId, 'LEGAL_ENTITY'
        );

        expect(result).toBe(true);
        expect(FieldClaimService.assertClaim).toHaveBeenCalledTimes(1);
        const arg = vi.mocked(FieldClaimService.assertClaim).mock.calls[0][0];
        expect(arg.instanceId).toBe(rowId);
        expect(arg.valueJson).toEqual(newValue);
    });

    it('3. unchanged reference-backed repeated value creates no physical duplicate', async () => {
        vi.mocked(getMasterFieldDefinition).mockResolvedValue({ ...FIELD_63_DEF, appDataType: 'PARTY_REF' } as any);
        
        const rowId = 'ch::psc_456';
        const value = { person: { id: 'person_1', name: 'Jane Doe' } };

        vi.mocked(KycStateService.getAuthoritativeCollection).mockResolvedValue([
            { instanceId: rowId, value, sourceType: 'REGISTRATION_AUTHORITY' } as any
        ]);

        // Mock DB query returns a claim with valueJson: null (as PARTY_REF behaves)
        prismaMock.fieldClaim.findFirst.mockResolvedValue({
            id: 'claim_2',
            instanceId: rowId,
            sourceType: 'REGISTRATION_AUTHORITY',
            valueJson: null,
            valuePersonId: 'person_1'
        } as any);

        const result = await writeService.updateField(
            'le_1', 63, value, { source: 'REGISTRATION_AUTHORITY' }, rowId, 'LEGAL_ENTITY'
        );

        expect(result).toBe(true);
        // This test will initially fail because findFirst uses `valueJson: { not: Prisma.JsonNull }`
        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
    });

    it('4. legacy unscoped IDs transition without creating a second active row', async () => {
        const valueArray = [{ name: 'Legacy Party', rowKey: 'psc_legacy' }];
        const candidate = {
            fieldNo: 63,
            source: 'REGISTRATION_AUTHORITY',
            sourceKey: 'ch',
            value: valueArray,
            rowKeys: ['psc_legacy']
        } as any;

        // Mock KycWriteService.updateField so we don't do full DB writes
        const updateSpy = vi.spyOn(writeService, 'updateField').mockResolvedValue(true);

        // Mock fieldClaim lookup to return a legacy row
        prismaMock.fieldClaim.findFirst.mockResolvedValue({ id: 'legacy_1' } as any);

        await writeService.applyFieldCandidate('le_1', candidate, 'user_1');

        expect(prismaMock.fieldClaim.findFirst).toHaveBeenCalled();
        const callArgs = prismaMock.fieldClaim.findFirst.mock.calls[0][0];
        expect(callArgs.where.instanceId).toBe('psc_legacy');
        expect(callArgs.where.sourceType).toBe('REGISTRATION_AUTHORITY');

        // Verify updateField was called with the LEGACY instanceId, not the scoped one
        expect(updateSpy).toHaveBeenCalled();
        expect(updateSpy.mock.calls[0][4]).toBe('psc_legacy');
    });

    it('5. completely missing stable rowKey does not generate timestamp identity for sources', async () => {
        const candidate = {
            fieldNo: 63,
            source: 'REGISTRATION_AUTHORITY',
            value: [{ name: 'No Identity' }],
            rowKeys: []
        } as any;

        const updateSpy = vi.spyOn(writeService, 'updateField').mockResolvedValue(true);

        const result = await writeService.applyFieldCandidate('le_1', candidate, 'user_1');

        expect(result).toBe(false); // Should fail the mapping safely
        expect(updateSpy).not.toHaveBeenCalled(); // No timestamp fallback
    });
});
