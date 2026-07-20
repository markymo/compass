import { describe, it, expect } from 'vitest';
import {
    validateTimezone,
    resolveSystemTimezone,
    formatSystemDateTime,
    formatBusinessDate
} from '../date-utils';

describe('validateTimezone', () => {
    it('accepts valid timezones', () => {
        expect(validateTimezone('Europe/London')).toBe(true);
        expect(validateTimezone('America/New_York')).toBe(true);
    });

    it('accepts UTC explicitly', () => {
        expect(validateTimezone('UTC')).toBe(true);
        expect(validateTimezone('utc')).toBe(true);
    });

    it('accepts blank inputs as valid (resets to UTC)', () => {
        expect(validateTimezone('')).toBe(true);
        expect(validateTimezone('   ')).toBe(true);
        expect(validateTimezone(null)).toBe(true);
        expect(validateTimezone(undefined)).toBe(true);
    });

    it('rejects invalid timezones', () => {
        expect(validateTimezone('America/Fake')).toBe(false);
        expect(validateTimezone('invalid')).toBe(false);
    });
});

describe('resolveSystemTimezone', () => {
    it('resolves valid timezones correctly', () => {
        expect(resolveSystemTimezone({ timezone: 'Europe/London' })).toBe('Europe/London');
    });

    it('resolves invalid, missing or blank preferences to UTC', () => {
        expect(resolveSystemTimezone({})).toBe('UTC');
        expect(resolveSystemTimezone({ timezone: '' })).toBe('UTC');
        expect(resolveSystemTimezone({ timezone: '  ' })).toBe('UTC');
        expect(resolveSystemTimezone({ timezone: 'Invalid/Zone' })).toBe('UTC');
        expect(resolveSystemTimezone(null)).toBe('UTC');
        expect(resolveSystemTimezone('Europe/London')).toBe('UTC'); // invalid shape
    });
});

describe('formatSystemDateTime', () => {
    it('formats a timestamp in UTC', () => {
        const date = new Date('2026-07-20T12:00:00Z');
        expect(formatSystemDateTime(date, 'UTC')).toBe('20 Jul 2026, 12:00 UTC');
    });

    it('formats a timestamp in Europe/London (summer time)', () => {
        const date = new Date('2026-07-20T12:00:00Z');
        // UK is UTC+1 in July, so 12:00 UTC -> 13:00 BST
        expect(formatSystemDateTime(date, 'Europe/London')).toBe('20 Jul 2026, 13:00 BST');
    });

    it('formats a timestamp in Europe/London (winter time)', () => {
        const date = new Date('2026-01-20T12:00:00Z');
        // UK is UTC in January, so 12:00 UTC -> 12:00 GMT
        expect(formatSystemDateTime(date, 'Europe/London')).toBe('20 Jan 2026, 12:00 GMT');
    });

    it('formats a timestamp in America/New_York', () => {
        const date = new Date('2026-07-20T12:00:00Z');
        // NY is UTC-4 in July, so 12:00 UTC -> 08:00 EDT (or GMT-4 on some Node versions)
        expect(formatSystemDateTime(date, 'America/New_York')).toMatch(/20 Jul 2026, 08:00 (EDT|GMT-4)/);
    });

    it('returns null for invalid inputs', () => {
        expect(formatSystemDateTime(null)).toBeNull();
        expect(formatSystemDateTime(undefined)).toBeNull();
        expect(formatSystemDateTime('not-a-date')).toBeNull();
    });
});

describe('formatBusinessDate', () => {
    it('safely extracts and formats standard ISO dates', () => {
        expect(formatBusinessDate('2020-05-12T00:00:00Z')).toBe('12 May 2020');
        expect(formatBusinessDate('2020-05-12T15:30:00Z')).toBe('12 May 2020');
        expect(formatBusinessDate('2020-05-12')).toBe('12 May 2020');
    });

    it('safely extracts regardless of arbitrary string padding', () => {
        expect(formatBusinessDate('  2020-05-12   ')).toBe('12 May 2020');
    });

    it('fails gracefully for malformed strings without trying to invent a date', () => {
        expect(formatBusinessDate('invalid-string')).toBe('invalid-string');
        expect(formatBusinessDate('Unknown')).toBe('Unknown');
        expect(formatBusinessDate('202-05-12')).toBe('202-05-12'); // doesn't match YYYY-MM-DD
    });

    it('handles nulls safely', () => {
        expect(formatBusinessDate(null)).toBeNull();
        expect(formatBusinessDate(undefined)).toBeNull();
    });
});
