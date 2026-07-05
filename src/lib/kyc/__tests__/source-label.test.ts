/**
 * source-label.test.ts
 *
 * Unit tests for resolveSourceLabel().
 * Pure function — no DB, no mocks required.
 */

import { describe, it, expect } from 'vitest';
import { resolveSourceLabel, RaNameLookup } from '../source-label';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RA_MAP: RaNameLookup = {
    'RA000585': 'Companies House',
    'RA000586': 'Companies House Scotland',
    'RA000192': 'Registre National des Entreprises',
};

// ── Registration Authority ────────────────────────────────────────────────────

describe('resolveSourceLabel', () => {

    describe('REGISTRATION_AUTHORITY', () => {
        it('known RA000585 resolves to Companies House', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', 'RA000585', RA_MAP))
                .toBe('Companies House');
        });

        it('known RA000586 resolves to Companies House', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', 'RA000586', RA_MAP))
                .toBe('Companies House');
        });

        it('known RA000192 resolves to French registry name', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', 'RA000192', RA_MAP))
                .toBe('RNCS / Infogreffe - RA000192');
        });

        it('unknown RA code falls back to Registry', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', 'RA999999', RA_MAP))
                .toBe('Registry - RA999999');
        });

        it('null sourceReference falls back to Registration Authority (unknown)', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', null, RA_MAP))
                .toBe('Registration Authority (unknown)');
        });

        it('undefined sourceReference falls back to Registration Authority (unknown)', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', undefined, RA_MAP))
                .toBe('Registration Authority (unknown)');
        });

        it('no raNameLookup provided resolves to Companies House', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', 'RA000585'))
                .toBe('Companies House');
        });

        it('empty raNameLookup resolves to Companies House', () => {
            expect(resolveSourceLabel('REGISTRATION_AUTHORITY', 'RA000585', {}))
                .toBe('Companies House');
        });
    });

    // ── USER_INPUT ────────────────────────────────────────────────────────────

    describe('USER_INPUT', () => {
        it('resolves to User Input', () => {
            expect(resolveSourceLabel('USER_INPUT', null, RA_MAP)).toBe('User Input');
        });

        it('sourceReference is ignored for USER_INPUT — still returns User Input', () => {
            // Defensive: even if a RA code is present on a user input claim, it must not
            // resolve to an authority name.
            expect(resolveSourceLabel('USER_INPUT', 'RA000585', RA_MAP)).toBe('User Input');
        });
    });

    // ── GLEIF ─────────────────────────────────────────────────────────────────

    describe('GLEIF', () => {
        it('GLEIF resolves to GLEIF', () => {
            expect(resolveSourceLabel('GLEIF', null, RA_MAP)).toBe('GLEIF');
        });

        it('GLEIF_DIRECT resolves to lowercase title-ized', () => {
            expect(resolveSourceLabel('GLEIF_DIRECT', null, RA_MAP)).toBe('gleif direct');
        });
    });

    // ── MASTER_RECORD / fallbacks ─────────────────────────────────────────────

    describe('MASTER_RECORD and fallbacks', () => {
        it('MASTER_RECORD resolves to Master Record', () => {
            expect(resolveSourceLabel('MASTER_RECORD', null, RA_MAP)).toBe('Master Record');
        });

        it('null source resolves to Master Record', () => {
            expect(resolveSourceLabel(null)).toBe('Master Record');
        });

        it('undefined source resolves to Master Record', () => {
            expect(resolveSourceLabel(undefined)).toBe('Master Record');
        });

        it('empty string source resolves to Master Record', () => {
            expect(resolveSourceLabel('')).toBe('Master Record');
        });

        it('unknown source string is returned lowercased (safe passthrough)', () => {
            // Ensures future source types are returned nicely
            expect(resolveSourceLabel('SOME_FUTURE_SOURCE', null, RA_MAP))
                .toBe('some future source');
        });
    });

    // ── Backwards compatibility ───────────────────────────────────────────────

    describe('backwards compatibility', () => {
        it('existing HydratedValue without sourceReference field still renders safely', () => {
            // Simulates a HydratedValue produced before Phase 1 where sourceReference
            // was not present on the object. Destructuring with undefined must not throw.
            const hydratedValue = {
                value: 'Acme Ltd',
                source: 'REGISTRATION_AUTHORITY' as string | null,
                isSynced: true,
                // sourceReference intentionally absent
            };

            expect(() =>
                resolveSourceLabel(hydratedValue.source, (hydratedValue as any).sourceReference, RA_MAP)
            ).not.toThrow();

            expect(
                resolveSourceLabel(hydratedValue.source, (hydratedValue as any).sourceReference, RA_MAP)
            ).toBe('Registration Authority (unknown)');
        });
    });

});
