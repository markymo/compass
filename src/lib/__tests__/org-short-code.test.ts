import { describe, it, expect } from 'vitest';
import { generateShortCode, makeUnique, normalizeDomain } from '../org-short-code';

describe('org-short-code helper functions', () => {
    describe('generateShortCode', () => {
        it('preserves existing shortcode generation rules and produces 5-character uppercase codes', () => {
            const code = generateShortCode('Acme Corporation');
            expect(code).toHaveLength(5);
            expect(code).toBe('ACME0'); // noise word CORPORATION stripped + zero padding to 5 chars
        });

        it('handles noise word removal and acronyms', () => {
            const code1 = generateShortCode('Barclays Bank PLC');
            expect(code1).toHaveLength(5);
            expect(code1).toBe('BRCLY');

            const code2 = generateShortCode('(MUFG)');
            expect(code2).toHaveLength(5);
            expect(code2).toBe('MUFG0');
        });

        it('handles special cases like CoParity', () => {
            expect(generateShortCode('CoParity Services')).toBe('COPAR');
        });
    });

    describe('makeUnique', () => {
        it('returns desired code if not used', () => {
            const used = new Set<string>(['OTHER']);
            expect(makeUnique('ACME0', used)).toBe('ACME0');
        });

        it('resolves collision with single digit suffix while maintaining 5-character length limit', () => {
            const used = new Set<string>(['ACME0']);
            expect(makeUnique('ACME0', used)).toBe('ACME1');
        });

        it('handles multiple collisions sequentially (ACME0 -> ACME1 -> ACME2)', () => {
            const used = new Set<string>(['ACME0', 'ACME1', 'ACME2']);
            expect(makeUnique('ACME0', used)).toBe('ACME3');
        });

        it('handles two-digit suffix overflow without exceeding 5 characters', () => {
            const used = new Set<string>(['ACME0']);
            for (let i = 1; i <= 9; i++) {
                used.add(`ACME${i}`);
            }
            expect(makeUnique('ACME0', used)).toBe('ACM10');
            expect(makeUnique('ACME0', used)).toHaveLength(5);
        });
    });

    describe('normalizeDomain', () => {
        it('normalizes domains by removing http/https, lowercasing, trimming, and stripping trailing slashes', () => {
            expect(normalizeDomain('  HTTP://Acme.COM/  ')).toBe('acme.com');
            expect(normalizeDomain('https://sub.domain.co.uk///')).toBe('sub.domain.co.uk');
            expect(normalizeDomain(null)).toBeNull();
            expect(normalizeDomain('')).toBeNull();
        });
    });
});
