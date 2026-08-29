import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseFieldDefault, updateFieldManually } from '../kyc-manual-update';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';

// Contract: MASTER-01 — Boolean Master fields use boolean editing semantics
// Linear: ONP-20

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-onp20' })
}));
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-onp20')
    }
}));
vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        assertClaim: vi.fn().mockImplementation((input) => Promise.resolve({ id: 'claim-onp20-1', ...input }))
    }
}));
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockImplementation((fieldNo) => {
        if (fieldNo === 243 || fieldNo === 999) {
            return Promise.resolve({ fieldNo, appDataType: 'BOOLEAN', isMultiValue: false, name: 'Is Ultimate Parent' });
        }
        return Promise.resolve({ fieldNo, appDataType: 'TEXT', isMultiValue: false, name: 'Text Field' });
    })
}));
vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ id: 'le-onp20', legalEntityId: 'le-abc' })
        }
    }
}));

describe('MASTER-01 / ONP-20 — Boolean Master Fields Semantics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('1. updateFieldManually stores primitive boolean true/false as valueJson', async () => {
        const resTrue = await updateFieldManually('le-onp20', 243, true, 'Confirmed ultimate parent');
        expect(resTrue.success).toBe(true);
        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 243,
                valueJson: true
            })
        );

        const resFalse = await updateFieldManually('le-onp20', 243, false, 'Not ultimate parent');
        expect(resFalse.success).toBe(true);
        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 243,
                valueJson: false
            })
        );
    });

    it('2. updateFieldManually normalizes valid string booleans ("true", "false", "yes", "no") to boolean primitives', async () => {
        const resYes = await updateFieldManually('le-onp20', 243, 'yes', 'Yes string');
        expect(resYes.success).toBe(true);
        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 243,
                valueJson: true
            })
        );

        const resNo = await updateFieldManually('le-onp20', 243, 'no', 'No string');
        expect(resNo.success).toBe(true);
        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 243,
                valueJson: false
            })
        );
    });

    it('3. updateFieldManually rejects arbitrary free text for BOOLEAN fields with an error', async () => {
        const res = await updateFieldManually('le-onp20', 243, 'random invalid free text', 'Bogus entry');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Invalid boolean value/i);
        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
    });

    it('4. releaseFieldDefault parses "true" string into boolean true', async () => {
        const res = await releaseFieldDefault('le-onp20', 243, 'true');
        expect(res.success).toBe(true);
        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                fieldNo: 243,
                valueJson: true
            })
        );
    });

    it('5. resolveFieldForDisplay / field-interpreter correctly formats boolean values for Master Record canonical display', () => {
        const meta = { fieldNo: 243, label: 'Is Ultimate Parent', appDataType: 'BOOLEAN' };

        const displayTrue = resolveFieldForDisplay(true, null, meta);
        expect(displayTrue.state).toBe('POPULATED');
        expect(displayTrue.value).toEqual({ kind: 'scalar', display: 'Yes', rawValue: true });
        expect(displayTrue.textSummary).toBe('Yes');

        const displayFalse = resolveFieldForDisplay(false, null, meta);
        expect(displayFalse.state).toBe('POPULATED');
        expect(displayFalse.value).toEqual({ kind: 'scalar', display: 'No', rawValue: false });
        expect(displayFalse.textSummary).toBe('No');
    });
});
