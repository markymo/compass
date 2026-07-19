import { describe, it, expect } from 'vitest';
import { canonicaliseClaimValueForComparison, valuesAreCanonicallyEqual } from '../canonical-comparison';

describe('Canonical Comparison', () => {
    it('ignores object key ordering', () => {
        const a = { a: 1, b: 2 };
        const b = { b: 2, a: 1 };
        expect(valuesAreCanonicallyEqual(a, b)).toBe(true);
    });

    it('ignores transport-only rowKey', () => {
        const a = { name: 'John', rowKey: 'auto_123' };
        const b = { name: 'John', rowKey: 'auto_456' };
        expect(valuesAreCanonicallyEqual(a, b)).toBe(true);
    });

    it('reordering semantically unordered arrays (sourceIdentifiers) is ignored', () => {
        const a = { sourceIdentifiers: ['a', 'b'] };
        const b = { sourceIdentifiers: ['b', 'a'] };
        expect(valuesAreCanonicallyEqual(a, b)).toBe(true);
    });

    it('reordering semantic arrays (roles) triggers a change', () => {
        const a = { roles: ['director', 'shareholder'] };
        const b = { roles: ['shareholder', 'director'] };
        expect(valuesAreCanonicallyEqual(a, b)).toBe(false);
    });

    it('natureOfControl: [] is strictly distinct from omitted natureOfControl', () => {
        const a = { natureOfControl: [] };
        const b = {};
        expect(valuesAreCanonicallyEqual(a, b)).toBe(false);
    });

    it('removed address reference is detected as change', () => {
        const a = { address: { line1: '123' } };
        const b = {};
        expect(valuesAreCanonicallyEqual(a, b)).toBe(false);
    });

    it('explicitly cleared cessation date is detected as change', () => {
        const a = { ceasedOn: '2023-01-01' };
        const b = { ceasedOn: null };
        expect(valuesAreCanonicallyEqual(a, b)).toBe(false);
    });

    it('missing data erases previously known data in full snapshot mode', () => {
        const a = { a: 1, b: 2 };
        const b = { a: 1 };
        expect(valuesAreCanonicallyEqual(a, b, false)).toBe(false);
    });

    it('missing data does not erase previously known data in partial snapshot mode', () => {
        const a = { a: 1, b: 2 };
        const b = { a: 1 };
        expect(valuesAreCanonicallyEqual(a, b, true)).toBe(true);
    });

    it('handles explicit nulls correctly', () => {
        const a = { a: null };
        const b = { a: null };
        expect(valuesAreCanonicallyEqual(a, b)).toBe(true);

        const c = { a: 1 };
        const d = { a: null };
        expect(valuesAreCanonicallyEqual(c, d)).toBe(false);
    });
});
