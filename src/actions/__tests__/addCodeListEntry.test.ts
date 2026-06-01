/**
 * addCodeListEntry.test.ts
 *
 * Unit tests for the addCodeListEntry server action.
 *
 * Tests:
 *   A1 — Valid code for SIC_2007_UK → success with correct instanceId
 *   A2 — Unknown code → validation failure
 *   A3 — codeSystem mismatch (field config says SIC_2007_UK, caller sends NAF_2008)
 *   A4 — Active duplicate → explicit rejection (active rows only)
 *   A5 — Tombstoned code is NOT a duplicate → write proceeds
 *   A6 — Label comes from server mapper, not from any hypothetical client value
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({
    getIdentity: vi.fn().mockResolvedValue({ userId: 'user-test' }),
}));

// Prisma mock — only clientLE.findUnique used by addCodeListEntry
vi.mock('@/lib/prisma', () => ({
    default: {
        clientLE: {
            findUnique: vi.fn().mockResolvedValue({ id: 'cle-1', legalEntityId: 'le-abc' }),
        },
        // Other models needed by updateFieldManually's internal path
        legalEntity: { findUnique: vi.fn().mockResolvedValue(null) },
        fieldClaim: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
        masterFieldGraphBinding: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

// FieldClaimService — used by updateFieldManually internally
vi.mock('@/lib/kyc/FieldClaimService', () => ({
    FieldClaimService: {
        assertClaim: vi.fn().mockResolvedValue({ id: 'new-claim-1' }),
    },
}));

// getMasterFieldDefinition — field 20 is multiValue, JSONB
vi.mock('@/services/masterData/definitionService', () => ({
    getMasterFieldDefinition: vi.fn().mockResolvedValue({
        fieldNo: 20,
        fieldName: 'Industry classification',
        appDataType: 'JSONB',
        isMultiValue: true,
        modelField: null,
    }),
    listAllMasterGroupsWithItems: vi.fn().mockResolvedValue([]),
}));

// KycStateService — resolveScopeId + getAuthoritativeCollection
vi.mock('@/lib/kyc/KycStateService', () => ({
    KycStateService: {
        resolveScopeId: vi.fn().mockResolvedValue('scope-1'),
        getAuthoritativeCollection: vi.fn().mockResolvedValue([]),
    },
}));

// complex-field-config — field 20 has codeSystem: 'SIC_2007_UK'
vi.mock('@/lib/master-data/complex-field-config', () => ({
    getComplexFieldConfig: vi.fn().mockReturnValue({
        kind: 'STRUCTURED_COLLECTION',
        collectionId: 'SIC_CODES',
        codeSystem: 'SIC_2007_UK',
    }),
}));

// code-system — real implementation for getCodeSystemEntries
// We do NOT mock this — it reads the actual sic_codes.json
// (tests are fast enough with 731 entries)

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { addCodeListEntry } from '../kyc-manual-update';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { FieldClaimService } from '@/lib/kyc/FieldClaimService';
import { getComplexFieldConfig } from '@/lib/master-data/complex-field-config';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('addCodeListEntry', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to defaults
        (getComplexFieldConfig as any).mockReturnValue({
            kind: 'STRUCTURED_COLLECTION',
            collectionId: 'SIC_CODES',
            codeSystem: 'SIC_2007_UK',
        });
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([]);
        (FieldClaimService.assertClaim as any).mockResolvedValue({ id: 'new-claim-1' });
    });

    // ── A1 ────────────────────────────────────────────────────────────────────
    it('A1: valid code 35110 for SIC_2007_UK → success with instanceId sic_35110', async () => {
        const result = await addCodeListEntry('cle-1', 20, 'SIC_2007_UK', '35110');

        expect(result.success).toBe(true);
        expect(result.instanceId).toBe('sic_35110');
    });

    // ── A2 ────────────────────────────────────────────────────────────────────
    it('A2: unknown code 00000 → validation failure with clear message', async () => {
        // '00000' is not present in UK SIC 2007 (99999 is a valid code)
        const result = await addCodeListEntry('cle-1', 20, 'SIC_2007_UK', '00000');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/unknown code/i);
    });

    // ── A3 ────────────────────────────────────────────────────────────────────
    it('A3: codeSystem mismatch (config says SIC_2007_UK, caller sends NAF_2008) → rejected', async () => {
        const result = await addCodeListEntry('cle-1', 20, 'NAF_2008', '35110');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/mismatch/i);
    });

    // ── A4 ────────────────────────────────────────────────────────────────────
    it('A4: code 35110 already active → explicit duplicate rejection', async () => {
        // Simulate active row with instanceId sic_35110
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([
            { instanceId: 'sic_35110', value: { code: '35110', label: 'Production of electricity' } },
        ]);

        const result = await addCodeListEntry('cle-1', 20, 'SIC_2007_UK', '35110');

        expect(result.success).toBe(false);
        expect(result.message).toMatch(/already been added/i);
        // No write should have occurred
        expect(FieldClaimService.assertClaim).not.toHaveBeenCalled();
    });

    // ── A5 ────────────────────────────────────────────────────────────────────
    it('A5: tombstoned code (not in active rows) is not considered a duplicate', async () => {
        // getAuthoritativeCollection excludes tombstoned rows by design
        // → active rows are empty → re-add should succeed
        (KycStateService.getAuthoritativeCollection as any).mockResolvedValue([]);

        const result = await addCodeListEntry('cle-1', 20, 'SIC_2007_UK', '35110');

        expect(result.success).toBe(true);
        expect(result.instanceId).toBe('sic_35110');
        expect(FieldClaimService.assertClaim).toHaveBeenCalled();
    });

    // ── A6 ────────────────────────────────────────────────────────────────────
    it('A6: label written to claim comes from server mapper, never from client input', async () => {
        await addCodeListEntry('cle-1', 20, 'SIC_2007_UK', '35110');

        // assertClaim should have been called with the server-resolved label
        expect(FieldClaimService.assertClaim).toHaveBeenCalledWith(
            expect.objectContaining({
                valueJson: expect.objectContaining({
                    code: '35110',
                    label: 'Production of electricity',
                }),
            })
        );
    });
});
