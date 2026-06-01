/**
 * KycStateService.collection.test.ts
 *
 * Unit tests for the effective-date post-filter in
 * KycStateService.getAuthoritativeCollection(), specifically validating
 * that Field 63 ("Current Directors") excludes resigned directors correctly
 * and supports historical snapshot queries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { ClaimStatus } from '@prisma/client';

// ── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma');
vi.mock('@/services/masterData/definitionService');

import prismaMock from '@/lib/__mocks__/prisma';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClaim(overrides: Record<string, any> = {}): any {
    return {
        id: `claim-${Math.random().toString(36).slice(2)}`,
        fieldNo: 63,
        subjectLeId: 'le-123',
        subjectPersonId: null,
        subjectOrgId: null,
        ownerScopeId: null,
        valueText: null,
        valueNumber: null,
        valueDate: null,
        valueJson: null,
        valuePersonId: null,
        valueLeId: null,
        valueOrgId: null,
        valueAddressId: null,
        valueDocId: null,
        collectionId: 'DIRECTORS',
        instanceId: null,
        effectiveFrom: null,
        effectiveTo: null,
        sourceType: 'REGISTRATION_AUTHORITY',
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
        valuePerson: { id: 'person-1', firstName: 'Alice', lastName: 'Smith' },
        valueLe: null,
        valueOrg: null,
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('KycStateService.getAuthoritativeCollection — effectiveTo filter (Field 63)', () => {
    const SUBJECT = { subjectLeId: 'le-123' };
    const TODAY   = new Date('2025-06-01');

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no claims
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);
    });

    it('returns active director (effectiveTo = null) in current view', async () => {
        const alice = makeClaim({
            instanceId: 'ch_2021-03-15_smith_a',
            valuePersonId: 'person-alice',
            effectiveFrom: new Date('2021-03-15'),
            effectiveTo: null, // still active
        });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([alice]);

        // Inject a fixed "now" by passing TODAY as snapshotDate
        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 63, undefined, TODAY);
        expect(results).toHaveLength(1);
        expect(results[0].instanceId).toBe('ch_2021-03-15_smith_a');
    });

    it('excludes resigned director (effectiveTo in the past) from current view', async () => {
        const bob = makeClaim({
            instanceId: 'ch_2019-06-01_jones_b',
            valuePersonId: 'person-bob',
            effectiveFrom: new Date('2019-06-01'),
            effectiveTo: new Date('2024-01-31'), // resigned before TODAY
        });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([bob]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 63, undefined, TODAY);
        expect(results).toHaveLength(0);
    });

    it('returns resigned director whose effectiveTo is in the future relative to TODAY', async () => {
        const future = makeClaim({
            instanceId: 'ch_2022-01-01_green_c',
            valuePersonId: 'person-green',
            effectiveFrom: new Date('2022-01-01'),
            effectiveTo: new Date('2025-12-31'), // resigns AFTER TODAY (2025-06-01)
        });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([future]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 63, undefined, TODAY);
        expect(results).toHaveLength(1);
    });

    it('includes a resigned director in a historical snapshot taken before their resignation', async () => {
        const SNAPSHOT = new Date('2023-01-01'); // before resignation
        const bob = makeClaim({
            instanceId: 'ch_2019-06-01_jones_b',
            valuePersonId: 'person-bob',
            effectiveFrom: new Date('2019-06-01'),
            effectiveTo: new Date('2024-01-31'), // resigned after snapshot
            assertedAt: new Date('2019-06-01'),  // asserted before snapshot
        });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([bob]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 63, undefined, SNAPSHOT);
        expect(results).toHaveLength(1); // Bob was active at snapshot date
    });

    it('returns both active and resigned directors when field has no filterByEffectiveDate config', async () => {
        // Field 999 is not in COLLECTION_FIELD_CONFIG — no effectiveTo filtering
        const active  = makeClaim({ fieldNo: 999, instanceId: 'row-1', effectiveTo: null });
        const resigned = makeClaim({ fieldNo: 999, instanceId: 'row-2', effectiveTo: new Date('2024-01-01') });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([active, resigned]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 999, undefined, TODAY);
        expect(results).toHaveLength(2); // no date filter applied
    });

    it('excludes tombstoned rows regardless of effectiveTo', async () => {
        const tombstone = makeClaim({
            instanceId: 'ch_2021-03-15_smith_a',
            valuePersonId: null,
            valueJson: { tombstone: true },
            effectiveTo: null,
        });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([tombstone]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 63, undefined, TODAY);
        expect(results).toHaveLength(0); // tombstone removed before effectiveTo filter
    });

    it('returns effectiveFrom and effectiveTo on the DerivedValue', async () => {
        const appointedOn  = new Date('2021-03-15');
        const alice = makeClaim({
            instanceId: 'ch_2021-03-15_smith_a',
            valuePersonId: 'person-alice',
            effectiveFrom: appointedOn,
            effectiveTo: null,
        });
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([alice]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 63, undefined, TODAY);
        expect(results[0].effectiveFrom).toEqual(appointedOn);
        expect(results[0].effectiveTo).toBeUndefined();
    });
});

// ── Collection-level provenance — tombstone cross-source scenarios ─────────────
//
// These tests verify the three ruling scenarios for USER_INPUT tombstones
// in mixed-source collections (Field 20 / SIC_CODES pattern):
//
//   Scenario 1: Registry@T1, USER_INPUT tombstone@T2  → item excluded
//   Scenario 2: Registry@T1, USER_INPUT tombstone@T2, Registry@T3 → item excluded
//   Scenario 3: Registry@T1, USER_INPUT tombstone@T2, USER_INPUT value@T3 → item included (re-add)
//
// Also tests that a pure-registry collection is unaffected.

describe('KycStateService.getAuthoritativeCollection — tombstone cross-source provenance (Field 20)', () => {

    const SUBJECT    = { subjectLeId: 'le-sic-test' };
    const FIELD_NO   = 20;
    const COLLECTION = 'SIC_CODES';
    const INSTANCE   = 'sic_35110';

    const T1 = new Date('2026-01-01T10:00:00Z');
    const T2 = new Date('2026-01-01T11:00:00Z');
    const T3 = new Date('2026-01-01T12:00:00Z');

    function makeCollectionClaim(overrides: Record<string, any> = {}): any {
        return {
            id: `claim-${Math.random().toString(36).slice(2)}`,
            fieldNo: FIELD_NO,
            subjectLeId: 'le-sic-test',
            subjectPersonId: null,
            subjectOrgId: null,
            ownerScopeId: null,
            valueText: null,
            valueNumber: null,
            valueDate: null,
            valueJson: { code: '35110', label: 'Production of electricity' },
            valuePersonId: null,
            valueLeId: null,
            valueOrgId: null,
            valueAddressId: null,
            valueDocId: null,
            collectionId: COLLECTION,
            instanceId: INSTANCE,
            effectiveFrom: null,
            effectiveTo: null,
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            evidenceId: null,
            confidenceScore: 0.9,
            status: ClaimStatus.VERIFIED,
            assertedAt: T1,
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

    beforeEach(() => {
        vi.clearAllMocks();
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            { sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'RA000585', priority: 50 },
        ]);
        (prismaMock.clientLEOwner.findFirst as any).mockResolvedValue(null);
    });

    // ── Scenario 1 ────────────────────────────────────────────────────────────

    it('S1: Registry@T1, USER_INPUT tombstone@T2 — item is excluded from collection', async () => {
        const registryClaim = makeCollectionClaim({
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            assertedAt: T1,
        });
        const userTombstone = makeCollectionClaim({
            sourceType: 'USER_INPUT',
            sourceReference: null,
            valueJson: { tombstone: true },
            assertedAt: T2, // newer than registry claim
            status: ClaimStatus.VERIFIED,
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([registryClaim, userTombstone]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);

        // The USER_INPUT tombstone wins over the registry value (cross-source rule).
        // getAuthoritativeCollection excludes tombstoned winners → empty result.
        expect(results).toHaveLength(0);
    });

    // ── Scenario 2 ────────────────────────────────────────────────────────────

    it('S2: Registry@T1, USER_INPUT tombstone@T2, Registry@T3 — item is still excluded', async () => {
        // This simulates a re-enrichment run writing a new claim after a user tombstone.
        // In practice KycWriteService now blocks this write, but we defend at the read side too.
        const registryClaimT1 = makeCollectionClaim({
            id: 'ra-t1',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            assertedAt: T1,
        });
        const userTombstone = makeCollectionClaim({
            id: 'tomb-t2',
            sourceType: 'USER_INPUT',
            sourceReference: null,
            valueJson: { tombstone: true },
            assertedAt: T2,
            status: ClaimStatus.VERIFIED,
        });
        const registryClaimT3 = makeCollectionClaim({
            id: 'ra-t3',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            assertedAt: T3, // newer than tombstone, but cross-source tombstone still wins
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([
            registryClaimT1, userTombstone, registryClaimT3,
        ]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);

        // USER_INPUT tombstone beats any REGISTRATION_AUTHORITY value, regardless of time.
        expect(results).toHaveLength(0);
    });

    // ── Scenario 3 ────────────────────────────────────────────────────────────

    it('S3: Registry@T1, USER_INPUT tombstone@T2, USER_INPUT value@T3 — item is re-included with USER_INPUT source', async () => {
        const registryClaim = makeCollectionClaim({
            id: 'ra-t1',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'RA000585',
            assertedAt: T1,
        });
        const userTombstone = makeCollectionClaim({
            id: 'tomb-t2',
            sourceType: 'USER_INPUT',
            sourceReference: null,
            valueJson: { tombstone: true },
            assertedAt: T2,
            status: ClaimStatus.VERIFIED,
        });
        const userReadd = makeCollectionClaim({
            id: 'user-t3',
            sourceType: 'USER_INPUT',
            sourceReference: null,
            valueJson: { code: '35110', label: 'Production of electricity' },
            assertedAt: T3, // newer than tombstone — USER_INPUT vs USER_INPUT: most recent wins
            status: ClaimStatus.VERIFIED,
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([
            registryClaim, userTombstone, userReadd,
        ]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);

        // The newer USER_INPUT value at T3 supersedes the USER_INPUT tombstone at T2.
        expect(results).toHaveLength(1);
        expect(results[0].instanceId).toBe(INSTANCE);
        expect(results[0].sourceType).toBe('USER_INPUT');
        expect(results[0].value).toEqual({ code: '35110', label: 'Production of electricity' });
    });

    // ── Regression: pure-registry collection is unaffected ───────────────────

    it('S4: Pure registry collection (no USER_INPUT actions) — all items shown with registry source', async () => {
        const sic35110 = makeCollectionClaim({ instanceId: 'sic_35110', assertedAt: T1 });
        const sic43120 = makeCollectionClaim({
            instanceId: 'sic_43120',
            valueJson: { code: '43120', label: 'Site preparation' },
            assertedAt: T1,
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([sic35110, sic43120]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);

        expect(results).toHaveLength(2);
        expect(results.every(r => r.sourceType === 'REGISTRATION_AUTHORITY')).toBe(true);
    });
});

