import { describe, it, expect } from 'vitest';
import { resolveSourceCheckedAt, ProvenanceMap } from '../provenance-enricher';

describe('resolveSourceCheckedAt', () => {
    it('returns assertedAt when map is null', () => {
        const assertedAt = new Date('2026-07-03');
        const res = resolveSourceCheckedAt('COMPANIES_HOUSE', 'COMPANIES_HOUSE', assertedAt, null);
        expect(res).toBe(assertedAt);
    });

    it('resolves COMPANIES_HOUSE alias', () => {
        const assertedAt = new Date('2026-07-03');
        const checkedAt = new Date('2026-07-06');
        const map: ProvenanceMap = {
            gleifFetchedAt: null,
            registrationAuthorityMap: new Map([['COMPANIES_HOUSE', checkedAt]])
        };
        const res = resolveSourceCheckedAt('REGISTRATION_AUTHORITY', 'COMPANIES_HOUSE', assertedAt, map);
        expect(res).toBe(checkedAt);
    });

    it('resolves COMPANIES_HOUSE with null reference to latest registry verification date', () => {
        const assertedAt = new Date('2026-07-03');
        const checkedAt = new Date('2026-07-06');
        const map: ProvenanceMap = {
            gleifFetchedAt: null,
            registrationAuthorityMap: new Map([['COMPANIES_HOUSE', checkedAt]])
        };
        const res = resolveSourceCheckedAt('COMPANIES_HOUSE', null, assertedAt, map);
        expect(res).toBe(checkedAt);
    });

    it('resolves REGISTRATION_AUTHORITY using actual reference', () => {
        const assertedAt = new Date('2026-07-03');
        const checkedAt = new Date('2026-07-06');
        const map: ProvenanceMap = {
            gleifFetchedAt: null,
            registrationAuthorityMap: new Map([['RA123', checkedAt]])
        };
        const res = resolveSourceCheckedAt('REGISTRATION_AUTHORITY', 'RA123', assertedAt, map);
        expect(res).toBe(checkedAt);
    });

    it('falls back to assertedAt if authority not in map', () => {
        const assertedAt = new Date('2026-07-03');
        const checkedAt = new Date('2026-07-06');
        const map: ProvenanceMap = {
            gleifFetchedAt: null,
            registrationAuthorityMap: new Map([['RA123', checkedAt]])
        };
        const res = resolveSourceCheckedAt('REGISTRATION_AUTHORITY', 'RA456', assertedAt, map);
        expect(res).toBe(assertedAt);
    });
});
