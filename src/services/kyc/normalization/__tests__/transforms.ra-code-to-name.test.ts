/**
 * transforms.ra-code-to-name.test.ts
 *
 * Unit tests for the RA_CODE_TO_NAME transform.
 *
 * Verifies:
 *  - Known RA code (string input) → authority name from lookup
 *  - Known RA code (object input { id, other }) → authority name
 *  - Unknown RA code → raw code with 0.1 confidence penalty
 *  - No raNameLookup supplied → raw code with 0.1 confidence penalty
 *  - Empty/null input → null value, no penalty
 *  - applyTransform is synchronous and DB-free (no prisma import in transforms.ts)
 */
import { describe, it, expect } from 'vitest';
import { applyTransform } from '../transforms';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RA_LOOKUP = {
    'RA000192': 'Registre du Commerce et des Sociétés (France)',
    'RA000585': 'Companies House',
    'RA000242': 'Gemeinsames Registerportal der Länder (Germany)',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RA_CODE_TO_NAME transform', () => {

    it('RA-1: bare string code resolves to authority name from lookup', () => {
        const result = applyTransform('RA000192', 'RA_CODE_TO_NAME', { raNameLookup: RA_LOOKUP });
        expect(result.value).toBe('Registre du Commerce et des Sociétés (France)');
        expect(result.confidencePenalty).toBe(0);
    });

    it('RA-2: object { id, other: null } resolves to authority name', () => {
        const result = applyTransform(
            { id: 'RA000585', other: null },
            'RA_CODE_TO_NAME',
            { raNameLookup: RA_LOOKUP }
        );
        expect(result.value).toBe('Companies House');
        expect(result.confidencePenalty).toBe(0);
    });

    it('RA-3: unknown RA code falls back to raw code with 0.1 penalty', () => {
        const result = applyTransform('RA000999', 'RA_CODE_TO_NAME', { raNameLookup: RA_LOOKUP });
        expect(result.value).toBe('RA000999');
        expect(result.confidencePenalty).toBe(0.1);
    });

    it('RA-4: no raNameLookup supplied → raw code with 0.1 penalty', () => {
        const result = applyTransform('RA000192', 'RA_CODE_TO_NAME', {});
        expect(result.value).toBe('RA000192');
        expect(result.confidencePenalty).toBe(0.1);
    });

    it('RA-5: no transformConfig at all → raw code with 0.1 penalty', () => {
        const result = applyTransform('RA000192', 'RA_CODE_TO_NAME', undefined);
        expect(result.value).toBe('RA000192');
        expect(result.confidencePenalty).toBe(0.1);
    });

    it('RA-6: null input → null value, no confidence penalty', () => {
        const result = applyTransform(null, 'RA_CODE_TO_NAME', { raNameLookup: RA_LOOKUP });
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(0);
    });

    it('RA-7: empty string input → null value, no penalty', () => {
        const result = applyTransform('', 'RA_CODE_TO_NAME', { raNameLookup: RA_LOOKUP });
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(0);
    });

    it('RA-8: object with empty id → null value, no penalty', () => {
        const result = applyTransform({ id: '', other: null }, 'RA_CODE_TO_NAME', { raNameLookup: RA_LOOKUP });
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(0);
    });

    it('RA-9: lookup with all supported RA codes — spot-check RA000242', () => {
        const result = applyTransform(
            { id: 'RA000242' },
            'RA_CODE_TO_NAME',
            { raNameLookup: RA_LOOKUP }
        );
        expect(result.value).toBe('Gemeinsames Registerportal der Länder (Germany)');
        expect(result.confidencePenalty).toBe(0);
    });

    it('RA-10: transform is synchronous — applyTransform is not async', () => {
        // If applyTransform ever returns a Promise this assertion fails at compile time
        // and the instanceof check catches it at runtime.
        const result = applyTransform('RA000192', 'RA_CODE_TO_NAME', { raNameLookup: RA_LOOKUP });
        expect(result instanceof Promise).toBe(false);
        expect(typeof result.value).toBe('string');
    });
});
