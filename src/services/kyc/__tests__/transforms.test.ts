/**
 * transforms.test.ts
 *
 * Unit tests for the normalization transforms, focusing on TO_PARTY_LIST
 * temporal behaviour introduced for the Current Directors architecture.
 */

import { describe, it, expect } from 'vitest';
import { applyTransform, buildDirectorRowKey } from '../normalization/transforms';

// ── Fixtures ────────────────────────────────────────────────────────────────

const CH_OFFICERS_PAYLOAD = [
    {
        name: 'SMITH, Alice Jane',
        officer_role: 'director',
        appointed_on: '2021-03-15',
        resigned_on: null,
    },
    {
        name: 'JONES, Bob',
        officer_role: 'director',
        appointed_on: '2019-06-01',
        resigned_on: '2024-01-31',
    },
    {
        name: 'BROWN, Charlie',
        officer_role: 'secretary',
        appointed_on: '2020-09-10',
        resigned_on: null,
    },
];

// ── buildDirectorRowKey ──────────────────────────────────────────────────────

describe('buildDirectorRowKey', () => {
    it('produces a deterministic key from appointedOn + last name + first initial', () => {
        const key = buildDirectorRowKey('2021-03-15', { lastName: 'Smith', firstName: 'Alice' });
        expect(key).toBe('ch_2021-03-15_smith_a');
    });

    it('strips non-alpha characters from the name segments', () => {
        const key = buildDirectorRowKey('2019-06-01', { lastName: "O'Brien", firstName: 'Mary' });
        expect(key).toBe('ch_2019-06-01_obrien_m');
    });

    it('uses "unknown" for missing appointedOn', () => {
        const key = buildDirectorRowKey(null, { lastName: 'Doe', firstName: 'John' });
        expect(key).toBe('ch_unknown_doe_j');
    });

    it('uses "_" as first-initial placeholder when firstName is absent', () => {
        const key = buildDirectorRowKey('2021-03-15', { lastName: 'Smith' });
        expect(key).toBe('ch_2021-03-15_smith__');
    });

    it('produces identical keys for the same inputs (stable across calls)', () => {
        const a = buildDirectorRowKey('2021-03-15', { lastName: 'Smith', firstName: 'Alice' });
        const b = buildDirectorRowKey('2021-03-15', { lastName: 'Smith', firstName: 'Alice' });
        expect(a).toBe(b);
    });

    it('produces distinct keys for same name with different appointedOn dates', () => {
        const a = buildDirectorRowKey('2021-03-15', { lastName: 'Smith', firstName: 'Alice' });
        const b = buildDirectorRowKey('2022-01-01', { lastName: 'Smith', firstName: 'Alice' });
        expect(a).not.toBe(b);
    });
});

// ── TO_PARTY_LIST ────────────────────────────────────────────────────────────

describe('TO_PARTY_LIST', () => {
    it('preserves resigned officers — does NOT drop them', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        expect(result.value).toHaveLength(3); // all three, including Bob (resigned)
    });

    it('includes resignedOn on each item', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        const bob = result.value.find((x: any) => x.resignedOn === '2024-01-31');
        expect(bob).toBeDefined();
    });

    it('includes appointedOn on each item', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        const alice = result.value.find((x: any) => x.resignedOn === null && x.appointedOn === '2021-03-15');
        expect(alice).toBeDefined();
    });

    it('sets resignedOn=null for active officers', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        const alice = result.value.find((x: any) => x.appointedOn === '2021-03-15');
        expect(alice.resignedOn).toBeNull();
    });

    it('adds a non-empty rowKey to every item', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        for (const item of result.value) {
            expect(typeof item.rowKey).toBe('string');
            expect(item.rowKey.length).toBeGreaterThan(0);
        }
    });

    it('rowKey is stable — same officer produces same key on second call', () => {
        const first  = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        const second = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        const keys1 = first.value.map((x: any) => x.rowKey);
        const keys2 = second.value.map((x: any) => x.rowKey);
        expect(keys1).toEqual(keys2);
    });

    it('exposes parallel rowKeys array on the TransformResult', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        expect(Array.isArray(result.rowKeys)).toBe(true);
        expect(result.rowKeys).toHaveLength(result.value.length);
        // Each rowKeys[i] should match value[i].rowKey
        for (let i = 0; i < result.value.length; i++) {
            expect(result.rowKeys![i]).toBe(result.value[i].rowKey);
        }
    });

    it('returns null for non-array input', () => {
        const result = applyTransform({ name: 'not an array' }, 'TO_PARTY_LIST');
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(1);
    });

    it('handles empty array', () => {
        const result = applyTransform([], 'TO_PARTY_LIST');
        expect(result.value).toHaveLength(0);
        expect(result.rowKeys).toHaveLength(0);
    });

    it('resolves CH inverted name format correctly for resigned officer', () => {
        const result = applyTransform(CH_OFFICERS_PAYLOAD, 'TO_PARTY_LIST');
        const bob = result.value.find((x: any) => x.resignedOn === '2024-01-31');
        // TO_PARTY_OBJECT splits "JONES, Bob" into lastName=Jones, firstName=Bob
        expect(bob.lastName).toBe('Jones');
    });
});
