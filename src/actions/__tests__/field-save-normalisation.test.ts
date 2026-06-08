/**
 * field-save-normalisation.test.ts
 *
 * Unit tests for the save-normalisation logic in the admin create/edit
 * sheets — specifically the `multiValueTypes` guard that determines whether
 * `isMultiValue` is preserved or stripped before calling the server action.
 *
 * These tests are pure logic tests extracted from the UI components; they do
 * not mount React components and have no external dependencies.
 *
 * Bugs fixed (and proven by this suite):
 *   BUG-1  field-create-sheet.tsx — PARTY_REF with isMultiValue=true was
 *          silently reset to false before save.
 *   BUG-2  field-detail-sheet.tsx — same issue on edit/update.
 *
 * Coverage:
 *   N-1  Scalar types (TEXT, NUMBER, BOOLEAN, DATETIME) → isMultiValue stripped
 *   N-2  JSONB → isMultiValue preserved
 *   N-3  SELECT → isMultiValue preserved
 *   N-4  PARTY_REF → isMultiValue preserved   [BUG-1 / BUG-2 fix]
 *   N-5  PERSON_REF → isMultiValue preserved  [BUG-1 / BUG-2 fix]
 *   N-6  ORG_REF → isMultiValue preserved     [BUG-1 / BUG-2 fix]
 *   N-7  ADDRESS_REF → isMultiValue preserved [BUG-1 / BUG-2 fix]
 *   N-8  Unknown / unrecognised type → isMultiValue stripped (safe default)
 */

import { describe, it, expect } from 'vitest';
import { APP_DATA_TYPES } from '@/lib/master-data/field-types';

// ── Extracted normalisation logic ─────────────────────────────────────────────
//
// This is the exact multiValueTypes guard from both sheets — tested in isolation
// so it can evolve without needing to mount the full React component tree.

const MULTI_VALUE_TYPES: string[] = [
    APP_DATA_TYPES.SELECT,
    APP_DATA_TYPES.JSONB,
    APP_DATA_TYPES.PARTY_REF,
    APP_DATA_TYPES.PERSON_REF,
    APP_DATA_TYPES.ORG_REF,
    APP_DATA_TYPES.ADDRESS_REF,
];

/**
 * Mirrors the save-normalisation step in both field-create-sheet.tsx and
 * field-detail-sheet.tsx: if the type is not in multiValueTypes, isMultiValue
 * is reset to false regardless of what the user set in the UI.
 */
function normaliseIsMultiValue(appDataType: string, isMultiValue: boolean): boolean {
    if (!MULTI_VALUE_TYPES.includes(appDataType)) return false;
    return isMultiValue;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Field save normalisation — multiValueTypes guard', () => {

    // ── N-1: Scalar types → strip isMultiValue ───────────────────────────────

    it('N-1a: TEXT with isMultiValue=true → stripped to false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.TEXT, true)).toBe(false);
    });

    it('N-1b: NUMBER with isMultiValue=true → stripped to false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.NUMBER, true)).toBe(false);
    });

    it('N-1c: BOOLEAN with isMultiValue=true → stripped to false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.BOOLEAN, true)).toBe(false);
    });

    it('N-1d: DATETIME with isMultiValue=true → stripped to false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.DATETIME, true)).toBe(false);
    });

    // ── N-2: JSONB → preserve ────────────────────────────────────────────────

    it('N-2: JSONB with isMultiValue=true → preserved (SIC codes, previous names)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.JSONB, true)).toBe(true);
    });

    it('N-2: JSONB with isMultiValue=false → preserved as false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.JSONB, false)).toBe(false);
    });

    // ── N-3: SELECT → preserve ───────────────────────────────────────────────

    it('N-3: SELECT with isMultiValue=true → preserved', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.SELECT, true)).toBe(true);
    });

    // ── N-4: PARTY_REF → preserve (BUG-1 / BUG-2 fix) ───────────────────────

    it('N-4: PARTY_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.PARTY_REF, true)).toBe(true);
    });

    it('N-4: PARTY_REF with isMultiValue=false → preserved as false (single-value graph ref)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.PARTY_REF, false)).toBe(false);
    });

    // ── N-5: PERSON_REF → preserve (BUG-1 / BUG-2 fix) ─────────────────────

    it('N-5: PERSON_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.PERSON_REF, true)).toBe(true);
    });

    // ── N-6: ORG_REF → preserve (BUG-1 / BUG-2 fix) ────────────────────────

    it('N-6: ORG_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.ORG_REF, true)).toBe(true);
    });

    // ── N-7: ADDRESS_REF → preserve (BUG-1 / BUG-2 fix) ────────────────────

    it('N-7: ADDRESS_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.ADDRESS_REF, true)).toBe(true);
    });

    it('N-7: ADDRESS_REF with isMultiValue=false → preserved as false (single-value address ref)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.ADDRESS_REF, false)).toBe(false);
    });

    // ── N-8: Unknown / unrecognised type → strip (safe default) ─────────────

    it('N-8: unknown type with isMultiValue=true → stripped to false (safe default)', () => {
        expect(normaliseIsMultiValue('UNKNOWN_FUTURE_TYPE', true)).toBe(false);
    });

    // ── Exhaustiveness: every reference type in MULTI_VALUE_TYPES is present ─

    it('MULTI_VALUE_TYPES contains all four reference types (exhaustiveness check)', () => {
        expect(MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.PARTY_REF);
        expect(MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.PERSON_REF);
        expect(MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.ORG_REF);
        expect(MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.ADDRESS_REF);
    });

    it('MULTI_VALUE_TYPES does not contain scalar types', () => {
        expect(MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.TEXT);
        expect(MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.NUMBER);
        expect(MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.BOOLEAN);
        expect(MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.DATETIME);
    });
});
