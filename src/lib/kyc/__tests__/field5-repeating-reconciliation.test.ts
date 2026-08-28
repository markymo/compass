/**
 * field5-repeating-reconciliation.test.ts
 *
 * Deterministic regression test for ONP-83 / 83.1:
 * Repeating source reconciliation & cross-source multi-feed previous legal names.
 *
 * Intended Contract:
 *  1. All higher-priority Companies House repeating rows survive; collection is not truncated to 1.
 *  2. Lower-priority GLEIF data does not displace higher-priority Companies House data.
 *  3. The same semantic previous name is NOT returned twice merely because source systems
 *     generate different source-specific instanceIds.
 *  4. Independent different previous names remain independent collection rows.
 *  5. Provenance/source selection remains traceable.
 *  6. Distinct historical periods for the same name (e.g. reused name) are preserved.
 *  7. Non-name-history collections (Field 20, 63, 64) retain their standard instanceId grouping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycStateService } from '@/lib/kyc/KycStateService';
import { ClaimStatus } from '@prisma/client';

vi.mock('@/lib/prisma');
import prismaMock from '@/lib/__mocks__/prisma';

const SUBJECT = { subjectLeId: 'le-hornsea-reconciliation' };
const FIELD_NO = 5;

let claimSeq = 0;
function makeField5Claim(overrides: Record<string, any> = {}): any {
    return {
        id: `claim-f5-${++claimSeq}`,
        fieldNo: FIELD_NO,
        subjectLeId: 'le-hornsea-reconciliation',
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
        collectionId: 'NAME_HISTORY',
        instanceId: null,
        effectiveFrom: null,
        effectiveTo: null,
        sourceType: 'REGISTRATION_AUTHORITY',
        sourceReference: 'COMPANIES_HOUSE',
        evidenceId: null,
        confidenceScore: 0.9,
        status: ClaimStatus.ASSERTED,
        assertedAt: new Date('2024-06-01'),
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
        targetFieldNo: FIELD_NO,
        sourceType: 'REGISTRATION_AUTHORITY',
        sourceReference: 'COMPANIES_HOUSE',
        priority: 50,
        ...overrides,
    };
}

describe('ONP-83 — Cross-Source Repeating Reconciliation (Field 5 Previous Names)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        claimSeq = 0;
        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([]);
        (prismaMock.clientLEOwner.findFirst as any).mockResolvedValue(null);
    });

    it('T1: CH + GLEIF same semantic previous name → one authoritative row, higher-priority CH wins', async () => {
        // 1. GLEIF claim (Lower Priority: P100): HERON WIND LIMITED with no dates
        const gleifClaim = makeField5Claim({
            id: 'claim-gleif-heron',
            sourceType: 'GLEIF',
            sourceReference: null,
            instanceId: 'GLEIF::::name_heron_wind_limited_unknown',
            valueJson: {
                name: 'HERON WIND LIMITED',
                nameType: 'PREVIOUS_LEGAL_NAME',
            },
            effectiveFrom: null,
            effectiveTo: null,
            assertedAt: new Date('2024-01-01T00:00:00Z'),
        });

        // 2. Companies House claim 1 (Higher Priority: P50): HERON WIND LIMITED with authoritative dates
        const chClaim1 = makeField5Claim({
            id: 'claim-ch-heron',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::name_heron_wind_limited_2011-05-19',
            valueJson: {
                name: 'HERON WIND LIMITED',
                effectiveFrom: '2011-05-19',
                effectiveTo: '2017-11-22',
            },
            effectiveFrom: new Date('2011-05-19'),
            effectiveTo: new Date('2017-11-22'),
            assertedAt: new Date('2024-06-01T00:00:00Z'),
        });

        // 3. Companies House claim 2 (Higher Priority: P50): EARLIER DEV CO LTD
        const chClaim2 = makeField5Claim({
            id: 'claim-ch-earlier',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::name_earlier_dev_co_ltd_2008-01-01',
            valueJson: {
                name: 'EARLIER DEV CO LTD',
                effectiveFrom: '2008-01-01',
                effectiveTo: '2011-05-18',
            },
            effectiveFrom: new Date('2008-01-01'),
            effectiveTo: new Date('2011-05-18'),
            assertedAt: new Date('2024-06-01T00:00:00Z'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([gleifClaim, chClaim1, chClaim2]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', priority: 50 }),
            makeMapping({ sourceType: 'GLEIF', sourceReference: null, priority: 100 }),
        ]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);

        // Contract Assertion 1: All distinct CH repeating rows survive
        expect(results.length).toBe(2);

        // Contract Assertion 2: HERON WIND LIMITED is not duplicated
        const heronEntries = results.filter(r => {
            const val = r.value as any;
            return (val && typeof val === 'object' && val.name?.includes('HERON WIND'));
        });
        expect(heronEntries.length).toBe(1);
        expect(heronEntries[0].sourceType).toBe('REGISTRATION_AUTHORITY');
        expect(heronEntries[0].effectiveTo).toEqual(new Date('2017-11-22'));

        // Contract Assertion 3: EARLIER DEV CO LTD survives
        const earlierEntries = results.filter(r => {
            const val = r.value as any;
            return (val && typeof val === 'object' && val.name?.includes('EARLIER DEV'));
        });
        expect(earlierEntries.length).toBe(1);
    });

    it('T2: Distinct historical periods for the same reused previous name are preserved', async () => {
        // Entity used "ACME LIMITED" in 2000-2005, and reused "ACME LIMITED" in 2010-2015
        const period1 = makeField5Claim({
            id: 'claim-acme-p1',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::name_acme_ltd_2000-01-01',
            valueJson: {
                name: 'ACME LIMITED',
                effectiveFrom: '2000-01-01',
                effectiveTo: '2005-01-01',
            },
            effectiveFrom: new Date('2000-01-01'),
            effectiveTo: new Date('2005-01-01'),
        });

        const period2 = makeField5Claim({
            id: 'claim-acme-p2',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::name_acme_ltd_2010-01-01',
            valueJson: {
                name: 'ACME LIMITED',
                effectiveFrom: '2010-01-01',
                effectiveTo: '2015-01-01',
            },
            effectiveFrom: new Date('2010-01-01'),
            effectiveTo: new Date('2015-01-01'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([period1, period2]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', priority: 50 }),
        ]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);

        // Both distinct date periods must be preserved
        expect(results.length).toBe(2);
        const dates = results.map(r => r.effectiveTo?.toISOString().slice(0, 10));
        expect(dates).toContain('2005-01-01');
        expect(dates).toContain('2015-01-01');
    });

    it('T3: Provenance of the winning claim remains intact', async () => {
        const winningClaim = makeField5Claim({
            id: 'claim-provenance-test',
            sourceType: 'REGISTRATION_AUTHORITY',
            sourceReference: 'COMPANIES_HOUSE',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::name_prov_2012-01-01',
            valueJson: { name: 'PROVENANCE TEST CORP', effectiveTo: '2018-01-01' },
            confidenceScore: 0.95,
            assertedAt: new Date('2024-05-15T12:00:00Z'),
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([winningClaim]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            makeMapping({ sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', priority: 50 }),
        ]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, FIELD_NO);
        expect(results).toHaveLength(1);
        expect(results[0].sourceType).toBe('REGISTRATION_AUTHORITY');
        expect(results[0].sourceReference).toBe('COMPANIES_HOUSE');
        expect(results[0].confidenceScore).toBe(0.95);
    });

    it('T4: Other repeating collection fields (e.g. Field 20 SIC codes) maintain standard instanceId grouping', async () => {
        const sic1 = makeField5Claim({
            id: 'claim-sic-1',
            fieldNo: 20,
            collectionId: 'SIC_CODES',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::sic_35110',
            valueJson: { code: '35110', label: 'Production of electricity' },
        });

        const sic2 = makeField5Claim({
            id: 'claim-sic-2',
            fieldNo: 20,
            collectionId: 'SIC_CODES',
            instanceId: 'REGISTRATION_AUTHORITY::COMPANIES_HOUSE::sic_64209',
            valueJson: { code: '64209', label: 'Activities of other holding companies' },
        });

        (prismaMock.fieldClaim.findMany as any).mockResolvedValue([sic1, sic2]);
        (prismaMock.sourceFieldMapping.findMany as any).mockResolvedValue([
            { targetFieldNo: 20, sourceType: 'REGISTRATION_AUTHORITY', sourceReference: 'COMPANIES_HOUSE', priority: 50 },
        ]);

        const results = await KycStateService.getAuthoritativeCollection(SUBJECT, 20);
        expect(results).toHaveLength(2);
        expect(results.map(r => (r.value as any)?.code)).toEqual(expect.arrayContaining(['35110', '64209']));
    });
});
