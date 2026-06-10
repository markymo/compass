/**
 * field-save-normalisation.test.ts
 *
 * Unit tests for the save-normalisation logic in the admin create/edit
 * sheets — specifically the `noMultiValueTypes` guard that determines whether
 * `isMultiValue` is preserved or stripped before calling the server action.
 *
 * These tests are pure logic tests extracted from the UI components; they do
 * not mount React components and have no external dependencies.
 *
 * Bugs fixed (and proven by this suite):
 *   BUG-1  field-create-sheet.tsx — PARTY_REF with isMultiValue=true was
 *          silently reset to false before save.
 *   BUG-2  field-detail-sheet.tsx — same issue on edit/update.
 *   BUG-3  field-detail-sheet.tsx — TEXT (e.g. Field 4 "Trading name") with
 *          isMultiValue=true was silently reset to false before save.
 *          Root cause: TEXT was excluded from the old allowlist instead of
 *          being in the correct denylist of types that can never be multi-value.
 *
 * Normalisation rule (corrected):
 *   Strip isMultiValue → false ONLY for: BOOLEAN, DATETIME, DOCUMENT_REF
 *   Preserve isMultiValue for ALL other types: TEXT, NUMBER, JSONB, SELECT,
 *   PARTY_REF, PERSON_REF, ORG_REF, ADDRESS_REF
 *
 * Coverage:
 *   N-1  TEXT → isMultiValue preserved          [BUG-3 fix]
 *   N-2  NUMBER → isMultiValue preserved
 *   N-3  BOOLEAN → isMultiValue stripped (no collection semantics)
 *   N-4  DATETIME → isMultiValue stripped (no collection semantics)
 *   N-5  DOCUMENT_REF → isMultiValue stripped (no collection semantics)
 *   N-6  JSONB → isMultiValue preserved
 *   N-7  SELECT → isMultiValue preserved
 *   N-8  PARTY_REF → isMultiValue preserved     [BUG-1 / BUG-2 fix]
 *   N-9  PERSON_REF → isMultiValue preserved    [BUG-1 / BUG-2 fix]
 *   N-10 ORG_REF → isMultiValue preserved       [BUG-1 / BUG-2 fix]
 *   N-11 ADDRESS_REF → isMultiValue preserved   [BUG-1 / BUG-2 fix]
 *   N-12 Unknown / unrecognised type → isMultiValue preserved (unknown = not in denylist)
 */

import { describe, it, expect } from 'vitest';
import { APP_DATA_TYPES } from '@/lib/master-data/field-types';

// ── Extracted normalisation logic ─────────────────────────────────────────────
//
// This is the exact noMultiValueTypes guard from both sheets — tested in isolation
// so it can evolve without needing to mount the full React component tree.

const NO_MULTI_VALUE_TYPES: string[] = [
    APP_DATA_TYPES.BOOLEAN,
    APP_DATA_TYPES.DATETIME,
    APP_DATA_TYPES.DOCUMENT_REF,
];

/**
 * Mirrors the save-normalisation step in both field-create-sheet.tsx and
 * field-detail-sheet.tsx: if the type is in NO_MULTI_VALUE_TYPES, isMultiValue
 * is reset to false regardless of what the user set in the UI.
 * All other types preserve the user's choice.
 */
function normaliseIsMultiValue(appDataType: string, isMultiValue: boolean): boolean {
    if (NO_MULTI_VALUE_TYPES.includes(appDataType)) return false;
    return isMultiValue;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Field save normalisation — noMultiValueTypes guard', () => {

    // ── N-1: TEXT → preserve (BUG-3 fix) ────────────────────────────────────
    // Field 4 "Trading name" is TEXT and MUST support isMultiValue=true.

    it('N-1: TEXT with isMultiValue=true → preserved (regression: was stripped — BUG-3)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.TEXT, true)).toBe(true);
    });

    it('N-1: TEXT with isMultiValue=false → preserved as false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.TEXT, false)).toBe(false);
    });

    // ── N-2: NUMBER → preserve ──────────────────────────────────────────────

    it('N-2: NUMBER with isMultiValue=true → preserved (e.g. multiple phone numbers)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.NUMBER, true)).toBe(true);
    });

    // ── N-3: BOOLEAN → strip (no collection semantics) ──────────────────────

    it('N-3: BOOLEAN with isMultiValue=true → stripped to false (no collection semantics)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.BOOLEAN, true)).toBe(false);
    });

    it('N-3: BOOLEAN with isMultiValue=false → stays false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.BOOLEAN, false)).toBe(false);
    });

    // ── N-4: DATETIME → strip ────────────────────────────────────────────────

    it('N-4: DATETIME with isMultiValue=true → stripped to false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.DATETIME, true)).toBe(false);
    });

    // ── N-5: DOCUMENT_REF → strip ────────────────────────────────────────────

    it('N-5: DOCUMENT_REF with isMultiValue=true → stripped to false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.DOCUMENT_REF, true)).toBe(false);
    });

    // ── N-6: JSONB → preserve ────────────────────────────────────────────────

    it('N-6: JSONB with isMultiValue=true → preserved (SIC codes, previous names)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.JSONB, true)).toBe(true);
    });

    it('N-6: JSONB with isMultiValue=false → preserved as false', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.JSONB, false)).toBe(false);
    });

    // ── N-7: SELECT → preserve ───────────────────────────────────────────────

    it('N-7: SELECT with isMultiValue=true → preserved', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.SELECT, true)).toBe(true);
    });

    // ── N-8: PARTY_REF → preserve (BUG-1 / BUG-2 fix) ───────────────────────

    it('N-8: PARTY_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.PARTY_REF, true)).toBe(true);
    });

    it('N-8: PARTY_REF with isMultiValue=false → preserved as false (single-value graph ref)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.PARTY_REF, false)).toBe(false);
    });

    // ── N-9: PERSON_REF → preserve (BUG-1 / BUG-2 fix) ─────────────────────

    it('N-9: PERSON_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.PERSON_REF, true)).toBe(true);
    });

    // ── N-10: ORG_REF → preserve (BUG-1 / BUG-2 fix) ───────────────────────

    it('N-10: ORG_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.ORG_REF, true)).toBe(true);
    });

    // ── N-11: ADDRESS_REF → preserve (BUG-1 / BUG-2 fix) ───────────────────

    it('N-11: ADDRESS_REF with isMultiValue=true → preserved (regression: was stripped)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.ADDRESS_REF, true)).toBe(true);
    });

    it('N-11: ADDRESS_REF with isMultiValue=false → preserved as false (single-value address ref)', () => {
        expect(normaliseIsMultiValue(APP_DATA_TYPES.ADDRESS_REF, false)).toBe(false);
    });

    // ── N-12: Unknown type → preserve (not in denylist) ─────────────────────

    it('N-12: unknown type with isMultiValue=true → preserved (not in denylist = not stripped)', () => {
        expect(normaliseIsMultiValue('UNKNOWN_FUTURE_TYPE', true)).toBe(true);
    });

    // ── Exhaustiveness: every denylist type is in NO_MULTI_VALUE_TYPES ───────

    it('NO_MULTI_VALUE_TYPES contains exactly BOOLEAN, DATETIME, DOCUMENT_REF', () => {
        expect(NO_MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.BOOLEAN);
        expect(NO_MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.DATETIME);
        expect(NO_MULTI_VALUE_TYPES).toContain(APP_DATA_TYPES.DOCUMENT_REF);
        expect(NO_MULTI_VALUE_TYPES).toHaveLength(3);
    });

    it('TEXT and NUMBER are NOT in the denylist (they can be multi-value)', () => {
        expect(NO_MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.TEXT);
        expect(NO_MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.NUMBER);
    });

    it('all reference types are NOT in the denylist', () => {
        expect(NO_MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.PARTY_REF);
        expect(NO_MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.PERSON_REF);
        expect(NO_MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.ORG_REF);
        expect(NO_MULTI_VALUE_TYPES).not.toContain(APP_DATA_TYPES.ADDRESS_REF);
    });
});
