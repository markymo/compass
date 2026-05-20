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
