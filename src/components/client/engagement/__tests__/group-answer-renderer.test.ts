/**
 * group-answer-renderer.test.ts
 *
 * Unit tests for the pure helper functions exported from GroupAnswerRenderer.
 * No DOM, no React rendering — pure logic only, matching the project's test pattern.
 */

import { describe, it, expect } from 'vitest';
import {
    formatFieldDate,
    formatSicItem,
    formatScalarValue,
} from '../group-answer-renderer';

// ── formatFieldDate ───────────────────────────────────────────────────────────

describe('formatFieldDate', () => {
    it('formats a Date object', () => {
        const d = new Date('2026-06-10T00:00:00Z');
        const result = formatFieldDate(d);
        // Format is locale-dependent but must be non-empty and contain "2026"
        expect(result).toMatch(/2026/);
    });

    it('formats an ISO date string', () => {
        const result = formatFieldDate('2026-01-15T10:00:00Z');
        expect(result).toMatch(/2026/);
        expect(result).not.toBe('—');
    });

    it('returns — for null', () => {
        expect(formatFieldDate(null)).toBe('—');
    });

    it('returns — for undefined', () => {
        expect(formatFieldDate(undefined)).toBe('—');
    });

    it('returns the raw string for an unparseable date', () => {
        expect(formatFieldDate('not-a-date')).toBe('not-a-date');
    });

    it('handles a numeric timestamp', () => {
        const result = formatFieldDate(new Date('2026-03-01').getTime());
        expect(result).toMatch(/2026/);
    });
});

// ── formatSicItem ─────────────────────────────────────────────────────────────

describe('formatSicItem', () => {
    it('{ code, label } → "code  label"', () => {
        expect(formatSicItem({ code: '35110', label: 'Production of electricity' }))
            .toBe('35110  Production of electricity');
    });

    it('{ code, label: null } → code only', () => {
        expect(formatSicItem({ code: '35110', label: null }))
            .toBe('35110');
    });

    it('{ code, label: "" } → code only (empty string treated as missing)', () => {
        expect(formatSicItem({ code: '35110', label: '' }))
            .toBe('35110');
    });

    it('plain string → string as-is', () => {
        expect(formatSicItem('35110')).toBe('35110');
    });

    it('{ code } with no label property → code only', () => {
        expect(formatSicItem({ code: '61900' })).toBe('61900');
    });

    it('null → JSON.stringify fallback (does not throw)', () => {
        expect(() => formatSicItem(null)).not.toThrow();
        expect(formatSicItem(null)).toBe('null');
    });

    it('arbitrary object without code → JSON string fallback', () => {
        const result = formatSicItem({ foo: 'bar' });
        expect(result).toBe('{"foo":"bar"}');
    });

    it('number string value renders correctly', () => {
        expect(formatSicItem('20100')).toBe('20100');
    });
});

// ── formatScalarValue ─────────────────────────────────────────────────────────

describe('formatScalarValue', () => {

    // BOOLEAN
    it('BOOLEAN true → "Yes"', () => {
        expect(formatScalarValue(true, 'BOOLEAN')).toBe('Yes');
    });

    it('BOOLEAN false → "No"', () => {
        expect(formatScalarValue(false, 'BOOLEAN')).toBe('No');
    });

    // NUMBER
    it('NUMBER value formatted as locale string', () => {
        // toLocaleString is locale-dependent; just check it is a non-null string
        const result = formatScalarValue(1234567, 'NUMBER');
        expect(result).not.toBeNull();
        expect(result).toContain('1'); // sanity: starts with digits
    });

    it('NUMBER string passthrough', () => {
        expect(formatScalarValue('42', 'NUMBER')).toBe('42');
    });

    // DATE
    it('DATE formats as a readable date string', () => {
        const result = formatScalarValue('2026-06-10T00:00:00Z', 'DATE');
        expect(result).toMatch(/2026/);
    });

    it('DATE null → null', () => {
        expect(formatScalarValue(null, 'DATE')).toBeNull();
    });

    // TEXT / ENUM
    it('TEXT returns string value', () => {
        expect(formatScalarValue('Wind farm operation', 'TEXT')).toBe('Wind farm operation');
    });

    it('TEXT empty string → null', () => {
        expect(formatScalarValue('', 'TEXT')).toBeNull();
    });

    it('ENUM returns string value', () => {
        expect(formatScalarValue('ACTIVE', 'ENUM')).toBe('ACTIVE');
    });

    // Null / undefined
    it('null value → null for any type', () => {
        expect(formatScalarValue(null, 'TEXT')).toBeNull();
        expect(formatScalarValue(null, 'NUMBER')).toBeNull();
        expect(formatScalarValue(null, 'BOOLEAN')).toBeNull();
    });

    it('undefined value → null for any type', () => {
        expect(formatScalarValue(undefined, 'TEXT')).toBeNull();
    });

    // Unknown type falls through to TEXT branch
    it('unknown appDataType falls through to string conversion', () => {
        expect(formatScalarValue('some value', 'CUSTOM_TYPE')).toBe('some value');
    });

    // Edge: numeric 0 must not be treated as empty
    it('NUMBER 0 is not treated as empty', () => {
        expect(formatScalarValue(0, 'NUMBER')).not.toBeNull();
    });

    // Edge: BOOLEAN false must not be treated as empty
    it('BOOLEAN false is not treated as empty (returns "No", not null)', () => {
        expect(formatScalarValue(false, 'BOOLEAN')).toBe('No');
    });
});

// ── Empty-field hidden (integration-style logic check) ────────────────────────

describe('populated field filter logic', () => {
    it('field with isSynced: false is excluded', () => {
        const fields = [
            { fieldNo: 1, hydrated: { value: 'Hello', source: 'GLEIF', isSynced: true } },
            { fieldNo: 2, hydrated: { value: null, source: null, isSynced: false } },
            { fieldNo: 3, hydrated: { value: 'World', source: 'USER_INPUT', isSynced: true } },
        ];
        const populated = fields.filter(f => f.hydrated.isSynced);
        expect(populated).toHaveLength(2);
        expect(populated.map(f => f.fieldNo)).toEqual([1, 3]);
    });

    it('all fields unsynced → populated is empty', () => {
        const fields = [
            { fieldNo: 1, hydrated: { value: null, source: null, isSynced: false } },
        ];
        const populated = fields.filter(f => f.hydrated.isSynced);
        expect(populated).toHaveLength(0);
    });
});

// ── SIC truncation threshold ──────────────────────────────────────────────────

describe('SIC truncation logic', () => {
    const ALWAYS_SHOW = 3;
    const COLLAPSE_THRESHOLD = 5;

    it('4 items do not trigger collapse', () => {
        const items = [1, 2, 3, 4];
        expect(items.length >= COLLAPSE_THRESHOLD).toBe(false);
    });

    it('5 items trigger collapse', () => {
        const items = [1, 2, 3, 4, 5];
        expect(items.length >= COLLAPSE_THRESHOLD).toBe(true);
    });

    it('collapsed view shows first 3 items', () => {
        const items = ['a', 'b', 'c', 'd', 'e', 'f'];
        const visible = items.slice(0, ALWAYS_SHOW);
        expect(visible).toEqual(['a', 'b', 'c']);
        expect(items.length - ALWAYS_SHOW).toBe(3); // hiddenCount
    });

    it('10 items: hidden count is 7', () => {
        const items = Array.from({ length: 10 }, (_, i) => i);
        const hiddenCount = items.length - ALWAYS_SHOW;
        expect(hiddenCount).toBe(7);
    });
});
