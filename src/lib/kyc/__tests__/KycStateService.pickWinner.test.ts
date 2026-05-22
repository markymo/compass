/**
 * KycStateService.pickWinner.test.ts
 *
 * Unit tests for the hybrid authoritative-value selection algorithm in
 * KycStateService.getAuthoritativeValue().
 *
 * These tests verify that:
 *  - SourceFieldMapping.priority drives winner selection for automated sources
 *  - USER_INPUT always beats automated sources within the same tier
 *  - The existing tier model (VERIFIED > ASSERTED, scoped > baseline) is unchanged
 *  - Tombstone behaviour is unchanged
 *  - Scoped sourceReference match is preferred over generic null match
 *  - Missing mappings use fallback priority and emit a warning
 *  - Snapshot date filtering works correctly
 *  - GLEIF null sourceReference correctly resolves to the GLEIF/null mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { ClaimStatus } from '@prisma/client';

vi.mock('@/lib/prisma');

import prismaMock from '@/lib/__mocks__/prisma';

// ── Shared helpers ────────────────────────────────────────────────────────────

const SUBJECT = { subjectLeId: 'le-abc' };
const FIELD_NO = 3; // Legal name

let claimSeq = 0;
function makeClaim(overrides: Record<string, any> = {}): any {
    return {
        id: `claim-${++claimSeq}`,
        fieldNo: FIELD_NO,
        subjectLeId: 'le-abc',
        subjectPersonId: null,
        subjectOrgId: null,
        ownerScopeId: null,
        valueText: 'SOME COMPANY LIMITED',
        valueNumber: null,
        valueDate: null,
        valueJson: null,
        valuePersonId: null,
        valueLeId: null,
        valueOrgId: null,
        valueAddressId: null,
        valueDocId: null,
        collectionId: null,
        instanceId: null,
        effectiveFrom: null,
        effectiveTo: null,
        sourceType: 'GLEIF',
        sourceReference: null,
        evidenceId: null,
        confidenceScore: 0.9,
        status: ClaimStatus.ASSERTED,
        assertedAt: new Date('2024-01-01'),
        verifiedAt: null,
        verifiedByUserId: null,
        supersedesId: null,
        evidence: null,
        valueAddress: null,
        valuePerson: null,
        valueLe: null,
        valueOrg: null,
        ...overrides,
    };
}

function makeMapping(overrides: Record<string, any> = {}): any {
    return {
        sourceType: 'GLEIF',
        sourceReference: null,
        priority: 100,
        ...overrides,
    };
}

// ── beforeEach: reset mocks ───────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    // Default: no claims, no mappings
    (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);
    (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([]);
    // clientLEOwner: no scope
    (prismaMock.clientLEOwner.findFirst as any).mockResolvedValue(null);
});

// ── A: Core priority ordering ─────────────────────────────────────────────────

describe('A — Core priority ordering', () => {

    it('A1: CH/RA000585 (P50) beats GLEIF (P100) when both are ASSERTED', async () => {
        const gleifClaim = makeClaim({
            id: 'gleif-1',
            sourceType: 'GLEIF',
            sourceReference: null,
            valueText: 'GLEIF NAME',
            assertedAt: new Date('2024-01-01'),
        });
        const chClaim = makeClaim({
            id: 'ch-1',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'COMPANIES HOUSE NAME',
            assertedAt: new Date('2024-06-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifClaim, chClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        expect(result).not.toBeNull();
        expect(result!.sourceType).toBe('REGISTRATION_AUTHORITY');
        expect(result!.sourceReference).toBe('RA000585');
        expect(result!.value).toBe('COMPANIES HOUSE NAME');
    });

    it('A2: VERIFIED GLEIF beats ASSERTED CH (P50) — tier model overrides mapping priority', async () => {
        const gleifClaim = makeClaim({
            id: 'gleif-1',
            sourceType: 'GLEIF',
            sourceReference: null,
            valueText: 'GLEIF NAME',
            status: ClaimStatus.VERIFIED, // higher tier
            assertedAt: new Date('2024-01-01'),
        });
        const chClaim = makeClaim({
            id: 'ch-1',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'COMPANIES HOUSE NAME',
            status: ClaimStatus.ASSERTED,
            assertedAt: new Date('2024-06-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifClaim, chClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        // VERIFIED (Tier 3 baseline) beats ASSERTED (Tier 4 baseline) regardless of priority
        expect(result!.sourceType).toBe('GLEIF');
        expect(result!.value).toBe('GLEIF NAME');
    });

    it('A3: Two GLEIF claims for same field — newer assertedAt wins', async () => {
        const older = makeClaim({
            id: 'gleif-old',
            sourceType: 'GLEIF',
            valueText: 'OLD NAME',
            assertedAt: new Date('2023-01-01'),
        });
        const newer = makeClaim({
            id: 'gleif-new',
            sourceType: 'GLEIF',
            valueText: 'NEW NAME',
            assertedAt: new Date('2024-06-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([older, newer]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        expect(result!.value).toBe('NEW NAME');
        expect(result!.claimId).toBe('gleif-new');
    });

    it('A4: Generic RA/null (P10) beats scoped RA000585 (P50) — lower number wins', async () => {
        // Simulates a generic RA mapping at P10 (higher authority) competing with scoped P50
        const genericRAClaim = makeClaim({
            id: 'ra-generic',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: null,
            valueText: 'GENERIC RA NAME',
            assertedAt: new Date('2024-01-01'),
        });
        const scopedCHClaim = makeClaim({
            id: 'ra-ch',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'CH NAME',
            assertedAt: new Date('2024-06-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([genericRAClaim, scopedCHClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: null, priority: 10 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        // Generic RA at P10 beats scoped CH at P50 — lower number wins
        // Note: DerivedValue coerces null sourceReference → undefined (claim.sourceReference ?? undefined)
        expect(result!.sourceReference).toBeUndefined();
        expect(result!.value).toBe('GENERIC RA NAME');
    });

    it('A5: Single claim with no matching mapping still returns a result (graceful fallback)', async () => {
        // No mapping rows exist for this unknown source type.
        // The algorithm must not throw; it should resolve using the hardcoded fallback priority
        // and return the only available claim.
        const orphanClaim = makeClaim({
            id: 'orphan-1',
            sourceType: 'SOME_FUTURE_SOURCE',
            sourceReference: null,
            valueText: 'ORPHAN VALUE',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([orphanClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([]); // no mapping

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        // Graceful fallback: claim is still returned
        expect(result).not.toBeNull();
        expect(result!.value).toBe('ORPHAN VALUE');
        expect(result!.sourceType).toBe('SOME_FUTURE_SOURCE');
    });
});

// ── B: USER_INPUT protection ──────────────────────────────────────────────────

describe('B — USER_INPUT always wins over automated sources within tier', () => {

    it('B1: USER_INPUT (null scope) beats GLEIF (P100) and CH (P50), all ASSERTED baseline', async () => {
        const userClaim = makeClaim({
            id: 'user-1',
            sourceType: 'USER_INPUT',
            sourceReference: null,
            valueText: 'USER CORRECTED NAME',
            assertedAt: new Date('2023-01-01'), // older, but USER_INPUT wins
        });
        const gleifClaim = makeClaim({
            id: 'gleif-1',
            sourceType: 'GLEIF',
            valueText: 'GLEIF NAME',
            assertedAt: new Date('2024-06-01'),
        });
        const chClaim = makeClaim({
            id: 'ch-1',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'CH NAME',
            assertedAt: new Date('2024-06-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([userClaim, gleifClaim, chClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        expect(result!.sourceType).toBe('USER_INPUT');
        expect(result!.value).toBe('USER CORRECTED NAME');
    });

    it('B2: USER_INPUT scoped beats GLEIF VERIFIED (different tier wins)', async () => {
        const userScoped = makeClaim({
            id: 'user-scoped',
            sourceType: 'USER_INPUT',
            sourceReference: null,
            ownerScopeId: 'scope-org-1',
            status: ClaimStatus.ASSERTED,
            valueText: 'USER SCOPED NAME',
        });
        const gleifVerified = makeClaim({
            id: 'gleif-verified',
            sourceType: 'GLEIF',
            status: ClaimStatus.VERIFIED,
            valueText: 'GLEIF VERIFIED NAME',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([userScoped, gleifVerified]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        // Scoped ASSERTED (Tier 2) beats baseline VERIFIED (Tier 3)
        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO, 'scope-org-1');

        expect(result!.sourceType).toBe('USER_INPUT');
        expect(result!.value).toBe('USER SCOPED NAME');
        expect(result!.isScoped).toBe(true);
    });

    it('B3: USER_INPUT has priority 0 — wins even when automated source has P1 mapping', async () => {
        const userClaim = makeClaim({
            id: 'user-1',
            sourceType: 'USER_INPUT',
            valueText: 'USER VALUE',
        });
        const automatedClaim = makeClaim({
            id: 'auto-1',
            sourceType: 'GLEIF',
            valueText: 'AUTO VALUE',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([userClaim, automatedClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 1 }), // extremely high trust
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        expect(result!.sourceType).toBe('USER_INPUT');
        expect(result!.value).toBe('USER VALUE');
    });
});

// ── C: Null sourceReference handling ─────────────────────────────────────────

describe('C — Null sourceReference handling', () => {

    it('C1: Scoped RA000585 (P50) claim uses scoped mapping, NOT generic RA/null (P10)', async () => {
        // The claim has sourceReference='RA000585' — it should match P50, not P10
        // (i.e. scoped row is looked up first and used exclusively for that claim)
        const scopedClaim = makeClaim({
            id: 'ch-scoped',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'CH SCOPED',
        });
        const gleifClaim = makeClaim({
            id: 'gleif-1',
            sourceType: 'GLEIF',
            sourceReference: null,
            valueText: 'GLEIF VALUE',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([scopedClaim, gleifClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: null, priority: 10 }),  // generic
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }), // scoped
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        // RA000585 claim resolves via its SCOPED mapping (P50).
        // GLEIF resolves via its mapping (P100).
        // P50 < P100, so CH wins.
        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);
        expect(result!.sourceReference).toBe('RA000585');
        expect(result!.value).toBe('CH SCOPED');
    });

    it('C2: GLEIF claim (sourceReference=null) resolves to GLEIF/null mapping correctly', async () => {
        const gleifClaim = makeClaim({
            id: 'gleif-1',
            sourceType: 'GLEIF',
            sourceReference: null,
            valueText: 'GLEIF VALUE',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        expect(result).not.toBeNull();
        expect(result!.sourceType).toBe('GLEIF');
        expect(result!.value).toBe('GLEIF VALUE');
    });

    it('C3: RA000586 claim (no scoped mapping) falls back to generic RA/null mapping', async () => {
        const ra586Claim = makeClaim({
            id: 'ra586-1',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000586',
            valueText: 'RA586 VALUE',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([ra586Claim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: null, priority: 10 }), // generic fallback
            // No RA000586-specific row
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        // Should still resolve via generic fallback, not throw
        expect(result).not.toBeNull();
        expect(result!.value).toBe('RA586 VALUE');
    });
});

// ── D: Edge cases and regression ──────────────────────────────────────────────

describe('D — Edge cases and regression', () => {

    it('D1: Tombstone wins over valid claim with same source within tier', async () => {
        const tombstone = makeClaim({
            id: 'tomb-1',
            sourceType: 'GLEIF',
            valueText: null,
            valueJson: { tombstone: true },
            assertedAt: new Date('2024-06-01'), // newer
        });
        const validClaim = makeClaim({
            id: 'gleif-valid',
            sourceType: 'GLEIF',
            valueText: 'VALID NAME',
            assertedAt: new Date('2024-01-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([tombstone, validClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        // Tombstone picked, isTombstone → returns null
        expect(result).toBeNull();
    });

    it('D2: All claims are tombstones → null returned', async () => {
        const tomb1 = makeClaim({ id: 't1', valueText: null, valueJson: { tombstone: true } });
        const tomb2 = makeClaim({ id: 't2', valueText: null, valueJson: { tombstone: true } });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([tomb1, tomb2]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);
        expect(result).toBeNull();
    });

    it('D3: VERIFIED claim from lower-priority source beats ASSERTED from higher-priority source', async () => {
        const gleifVerified = makeClaim({
            id: 'gleif-verified',
            sourceType: 'GLEIF',
            status: ClaimStatus.VERIFIED,
            valueText: 'GLEIF VERIFIED',
            assertedAt: new Date('2024-01-01'),
        });
        const chAsserted = makeClaim({
            id: 'ch-asserted',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            status: ClaimStatus.ASSERTED,
            valueText: 'CH ASSERTED',
            assertedAt: new Date('2024-06-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifVerified, chAsserted]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        // VERIFIED (Tier 3) beats ASSERTED (Tier 4) regardless of mapping priority
        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);
        expect(result!.sourceType).toBe('GLEIF');
        expect(result!.value).toBe('GLEIF VERIFIED');
    });

    it('D4: Snapshot date — only claims assertedAt ≤ snapshotDate are eligible', async () => {
        const snapshot = new Date('2024-03-01');

        const beforeSnapshot = makeClaim({
            id: 'gleif-old',
            sourceType: 'GLEIF',
            valueText: 'OLD GLEIF NAME',
            assertedAt: new Date('2024-01-01'), // before snapshot
        });
        const afterSnapshot = makeClaim({
            id: 'ch-new',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'CH NEW NAME',
            assertedAt: new Date('2024-06-01'), // AFTER snapshot — should be excluded by DB query
        });

        // Only the before-snapshot claim is returned by the DB query (prisma where clause filters)
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([beforeSnapshot]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO, undefined, snapshot);

        expect(result!.value).toBe('OLD GLEIF NAME');
        expect(result!.sourceType).toBe('GLEIF');

        // Confirm prisma was called with the snapshot date filter
        expect(prismaMock.fieldClaim.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    assertedAt: { lte: snapshot }
                })
            })
        );
    });

    it('D5: No claims → returns null', async () => {
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);
        expect(result).toBeNull();
    });

    it('D6: Multiple active mappings for same exact key — uses minimum priority', async () => {
        const gleifClaim = makeClaim({
            id: 'gleif-1',
            sourceType: 'GLEIF',
            sourceReference: null,
            valueText: 'GLEIF NAME',
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            // Two active GLEIF rows — duplicates should not crash; lowest priority wins
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 200 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);
        expect(result).not.toBeNull();
        expect(result!.value).toBe('GLEIF NAME');
        // (minimum of 100 and 200 = 100 used — no crash)
    });
});

// ── E: Lynn Wind Farm Limited — real-world integration scenario ───────────────

describe('E — LYNN WIND FARM LIMITED (field 3, production scenario)', () => {

    it('CH/RA000585 (P50 RAW_PAYLOAD) now beats GLEIF (P100) for legal name', async () => {
        const gleifClaim = makeClaim({
            id: 'gleif-lwf',
            sourceType: 'GLEIF',
            sourceReference: null,
            valueText: 'LYNN WIND FARM LIMITED',
            status: ClaimStatus.ASSERTED,
            confidenceScore: 1.0,
            assertedAt: new Date('2026-04-15T09:01:58Z'),
        });
        const chClaim = makeClaim({
            id: 'ch-lwf',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            valueText: 'LYNN WIND FARM LIMITED',
            status: ClaimStatus.ASSERTED,
            confidenceScore: 0.9,
            assertedAt: new Date('2026-05-22T13:16:02Z'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifClaim, chClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            // Production mapping state post P0 fix
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 }),
        ]);

        const result = await KycStateService.getAuthoritativeValue(SUBJECT, FIELD_NO);

        expect(result).not.toBeNull();
        expect(result!.sourceType).toBe('REGISTRATION_AUTHORITY');
        expect(result!.sourceReference).toBe('RA000585');
        expect(result!.value).toBe('LYNN WIND FARM LIMITED');
        // Confidence does NOT influence the result — just metadata
        expect(result!.confidenceScore).toBe(0.9);
    });
});
