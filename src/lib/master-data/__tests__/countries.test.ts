import { describe, it, expect } from 'vitest';
import { resolveCountry } from '../countries';

describe('resolveCountry', () => {
    it('resolves valid ISO codes', () => {
        expect(resolveCountry('GB')).toEqual({ code: 'GB', name: 'United Kingdom' });
        expect(resolveCountry('US')).toEqual({ code: 'US', name: 'United States' });
        expect(resolveCountry('gb')).toEqual({ code: 'GB', name: 'United Kingdom' }); // case-insensitive
    });

    it('resolves exact canonical names', () => {
        expect(resolveCountry('United Kingdom')).toEqual({ code: 'GB', name: 'United Kingdom' });
        expect(resolveCountry('UNITED KINGDOM')).toEqual({ code: 'GB', name: 'United Kingdom' });
        expect(resolveCountry('France')).toEqual({ code: 'FR', name: 'France' });
    });

    it('resolves known synonyms', () => {
        expect(resolveCountry('UK')).toEqual({ code: 'GB', name: 'United Kingdom' });
        expect(resolveCountry('England')).toEqual({ code: 'GB', name: 'United Kingdom' });
        expect(resolveCountry('Great Britain')).toEqual({ code: 'GB', name: 'United Kingdom' });
        expect(resolveCountry('USA')).toEqual({ code: 'US', name: 'United States' });
        expect(resolveCountry('United States of America')).toEqual({ code: 'US', name: 'United States' });
    });

    it('returns null for unknown countries or invalid inputs', () => {
        expect(resolveCountry('Narnia')).toBeNull();
        expect(resolveCountry('ZZ')).toBeNull();
        expect(resolveCountry('')).toBeNull();
        expect(resolveCountry(null)).toBeNull();
        expect(resolveCountry(undefined)).toBeNull();
    });
});
