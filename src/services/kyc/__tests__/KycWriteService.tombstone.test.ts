/**
 * KycWriteService.tombstone.test.ts
 *
 * Unit tests for the tombstone-aware idempotency check in
 * KycWriteService.updateField() (the multi-value / repeating-field branch).
 *
 * Tests verified:
 *
 *   T1: A USER_INPUT tombstone for instanceId=X blocks a subsequent registry
 *       write for the same instanceId (user exclusion).
 *
 *   T2: A non-tombstone value claim for instanceId=X blocks duplicate writes
 *       for the same instanceId (standard idempotency — existing behaviour).
 *
 *   T3: A non-USER_INPUT (system) tombstone does NOT block re-enrichment;
 *       a new value claim can be written.
 *
 *   T4: When no prior claim exists, updateField writes a new value claim.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaimStatus, SourceType } from '@prisma/client';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');
vi.mock('@/lib/kyc/KycStateService');
vi.mock('@/lib/kyc/FieldClaimService');
vi.mock('@/lib/master-data/complex-field-config');
vi.mock('@/lib/master-data/field-types', () => ({
    APP_DATA_TYPES: { DOCUMENT_REF: 'DOCUMENT_REF', JSONB: 'JSONB' },
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

// ── Field definition stub ─────────────────────────────────────────────────────

const FIELD_20_DEF = {
    fieldNo: 20,
    fieldName: 'Industry classification',
    appDataType: 'JSONB',
    isMultiValue: true,
    modelField: null,
    categoryId: 'SIC_CODES',
    options: [],
};

// ── Claim factories ───────────────────────────────────────────────────────────

const INSTANCE_ID = 'sic_35110';
const SUBJECT_LE  = 'le-sic-write-test';
const SIC_VALUE   = { code: '35110', label: 'Production of electricity' };

function makeExistingClaim(overrides: Record<string, any> = {}): any {
    return {
        id: 'existing-claim-1',
        fieldNo: 20,
        subjectLeId: SUBJECT_LE,
        instanceId: INSTANCE_ID,
        collectionId: 'SIC_CODES',
        sourceType: 'REGISTRATION_AUTHORITY',
        valueJson: SIC_VALUE,
        assertedAt: new Date('2026-01-01T10:00:00Z'),
        status: ClaimStatus.VERIFIED,
        ...overrides,
    };
}

// ── Provenance object for a registry re-enrichment write ─────────────────────

const REGISTRY_PROVENANCE = {
    source: 'REGISTRATION_AUTHORITY' as any,
    reason: 'RA000585',
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('KycWriteService.updateField — multi-value tombstone-aware idempotency', () => {

    let service: KycWriteService;

    beforeEach(() => {
        vi.clearAllMocks();

        service = new KycWriteService();

        // Field 20 definition — isMultiValue: true, JSONB, no modelField (claim-only)
        (getMasterFieldDefinition as any).mockResolvedValue(FIELD_20_DEF);

        // evaluateOverwrite: getAuthoritativeValue returns null → "no existing record" → allowed
        (KycStateService.getAuthoritativeValue as any).mockResolvedValue(null);

        // sourceFieldMapping — no rows (evaluateOverwrite falls through to allowed)
        (prismaMock.sourceFieldMapping as any).findMany = vi.fn().mockResolvedValue([]);

        // Default: no existing instance claim (overridden per test)
        (prismaMock.fieldClaim.findFirst as any).mockResolvedValue(null);

        // fieldClaim.create — the actual write
        (prismaMock.fieldClaim.create as any).mockResolvedValue({ id: 'new-claim-1' });

        // propagateToQuestions — add question model mock so the write path completes
        (prismaMock as any).question = { findMany: vi.fn().mockResolvedValue([]) };

        // masterFieldGraphBinding — no graph binding for field 20
        (prismaMock as any).masterFieldGraphBinding = { findMany: vi.fn().mockResolvedValue([]) };

        // listAllMasterGroupsWithItems — propagateToQuestions calls this; return empty array
        (listAllMasterGroupsWithItems as any).mockResolvedValue([]);

        // FieldClaimService.assertClaim — the actual write called by KycWriteService
        (FieldClaimService.assertClaim as any).mockResolvedValue({ id: 'new-claim-1' });
    });



    // ── T1: USER_INPUT tombstone blocks registry re-enrichment ────────────────

    it('T1: USER_INPUT tombstone for instanceId blocks registry re-enrichment (user exclusion)', async () => {
        const userTombstone = makeExistingClaim({
            sourceType: 'USER_INPUT',
            valueJson: { tombstone: true },
            assertedAt: new Date('2026-01-01T11:00:00Z'), // after original registry claim
        });

        // The most recent claim for this instanceId is a USER_INPUT tombstone
        (prismaMock.fieldClaim.findFirst as any).mockResolvedValue(userTombstone);

        const result = await (service as any).updateField(
            SUBJECT_LE,
            20,
            SIC_VALUE,
            REGISTRY_PROVENANCE,
            INSTANCE_ID,
            'LEGAL_ENTITY'
        );

        // updateField returns true (skipped) — no new claim written
        expect(result).toBe(true);
        expect(prismaMock.fieldClaim.create).not.toHaveBeenCalled();
    });

    // ── T2: Non-tombstone value claim blocks duplicate write (standard idempotency) ──

    it('T2: Existing non-tombstone value claim blocks duplicate registry write (standard idempotency)', async () => {
        const existingValueClaim = makeExistingClaim({
            sourceType: 'REGISTRATION_AUTHORITY',
            valueJson: SIC_VALUE, // not a tombstone
        });

        (prismaMock.fieldClaim.findFirst as any).mockResolvedValue(existingValueClaim);

        const result = await (service as any).updateField(
            SUBJECT_LE,
            20,
            SIC_VALUE,
            REGISTRY_PROVENANCE,
            INSTANCE_ID,
            'LEGAL_ENTITY'
        );

        expect(result).toBe(true);
        expect(prismaMock.fieldClaim.create).not.toHaveBeenCalled();
    });

    // ── T3: Non-USER_INPUT tombstone does NOT block re-enrichment ────────────

    it('T3: Non-USER_INPUT (system) tombstone allows re-enrichment to write a new claim', async () => {
        const systemTombstone = makeExistingClaim({
            sourceType: 'SYSTEM_DERIVED', // NOT USER_INPUT
            valueJson: { tombstone: true },
        });

        (prismaMock.fieldClaim.findFirst as any).mockResolvedValue(systemTombstone);

        await (service as any).updateField(
            SUBJECT_LE,
            20,
            SIC_VALUE,
            REGISTRY_PROVENANCE,
            INSTANCE_ID,
            'LEGAL_ENTITY'
        );

        // A system tombstone does not block re-enrichment — write should proceed
        expect(FieldClaimService.assertClaim).toHaveBeenCalled();
    });

    // ── T4: No prior claim → write proceeds ──────────────────────────────────

    it('T4: No prior claim for instanceId — registry write proceeds normally', async () => {
        // findFirst returns null — no existing claim for this instanceId
        (prismaMock.fieldClaim.findFirst as any).mockResolvedValue(null);

        await (service as any).updateField(
            SUBJECT_LE,
            20,
            SIC_VALUE,
            REGISTRY_PROVENANCE,
            INSTANCE_ID,
            'LEGAL_ENTITY'
        );

        expect(FieldClaimService.assertClaim).toHaveBeenCalled();
    });
});
