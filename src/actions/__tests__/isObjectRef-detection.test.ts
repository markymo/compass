/**
 * isObjectRef-detection.test.ts
 *
 * Regression tests for the isObjectRef / isPartyRef detection logic
 * in field-detail-panel.tsx.
 *
 * Root cause of bug (fixed):
 *   isPartyRef was defined as `data?.dataType === 'PARTY_REF'` only.
 *   PERSON_REF and ORG_REF were NOT included, so any admin-created field
 *   with appDataType=PERSON_REF or ORG_REF would have isObjectRef=false
 *   and the GraphNodePicker would never render — even when a valid
 *   MasterFieldGraphBinding existed for that field.
 *
 * This file tests the corrected logic:
 *   isPartyRef = PARTY_REF | PERSON_REF | ORG_REF
 *   isAddressRef = ADDRESS_REF
 *   isObjectRef = isPartyRef || isAddressRef
 *
 * Tests:
 *   OR-1  PARTY_REF → isPartyRef=true, isObjectRef=true
 *   OR-2  PERSON_REF → isPartyRef=true, isObjectRef=true  [regression]
 *   OR-3  ORG_REF → isPartyRef=true, isObjectRef=true      [regression]
 *   OR-4  ADDRESS_REF → isAddressRef=true, isObjectRef=true
 *   OR-5  TEXT / NUMBER / JSONB / SELECT / DATETIME → isObjectRef=false
 *   OR-6  null / undefined dataType → isObjectRef=false
 *   OR-7  Arbitrary high fieldNo (e.g. 126) with PERSON_REF → detected correctly
 */

import { describe, it, expect } from 'vitest';
import { APP_DATA_TYPES } from '@/lib/master-data/field-types';

// ── Extracted detection logic (mirrors field-detail-panel.tsx lines 80-82) ────

function computeObjectRefFlags(dataType: string | null | undefined) {
    const isPartyRef = dataType === APP_DATA_TYPES.PARTY_REF
                    || dataType === APP_DATA_TYPES.PERSON_REF
                    || dataType === APP_DATA_TYPES.ORG_REF;
    const isAddressRef = dataType === APP_DATA_TYPES.ADDRESS_REF;
    const isObjectRef = isPartyRef || isAddressRef;
    return { isPartyRef, isAddressRef, isObjectRef };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isObjectRef detection — field-detail-panel flag logic', () => {

    // OR-1: PARTY_REF (original stakeholder fields 62/63/64)
    it('OR-1: PARTY_REF → isPartyRef=true, isObjectRef=true', () => {
        const { isPartyRef, isAddressRef, isObjectRef } = computeObjectRefFlags(APP_DATA_TYPES.PARTY_REF);
        expect(isPartyRef).toBe(true);
        expect(isAddressRef).toBe(false);
        expect(isObjectRef).toBe(true);
    });

    // OR-2: PERSON_REF (bug fix — was false before)
    it('OR-2: PERSON_REF → isPartyRef=true, isObjectRef=true (regression for bug where PERSON_REF was excluded)', () => {
        const { isPartyRef, isAddressRef, isObjectRef } = computeObjectRefFlags(APP_DATA_TYPES.PERSON_REF);
        expect(isPartyRef).toBe(true);
        expect(isAddressRef).toBe(false);
        expect(isObjectRef).toBe(true);
    });

    // OR-3: ORG_REF (bug fix — was false before)
    it('OR-3: ORG_REF → isPartyRef=true, isObjectRef=true (regression for bug where ORG_REF was excluded)', () => {
        const { isPartyRef, isAddressRef, isObjectRef } = computeObjectRefFlags(APP_DATA_TYPES.ORG_REF);
        expect(isPartyRef).toBe(true);
        expect(isAddressRef).toBe(false);
        expect(isObjectRef).toBe(true);
    });

    // OR-4: ADDRESS_REF
    it('OR-4: ADDRESS_REF → isAddressRef=true, isObjectRef=true', () => {
        const { isPartyRef, isAddressRef, isObjectRef } = computeObjectRefFlags(APP_DATA_TYPES.ADDRESS_REF);
        expect(isPartyRef).toBe(false);
        expect(isAddressRef).toBe(true);
        expect(isObjectRef).toBe(true);
    });

    // OR-5: Scalar types → never objectRef
    it('OR-5a: TEXT → isObjectRef=false', () => {
        expect(computeObjectRefFlags(APP_DATA_TYPES.TEXT).isObjectRef).toBe(false);
    });

    it('OR-5b: NUMBER → isObjectRef=false', () => {
        expect(computeObjectRefFlags(APP_DATA_TYPES.NUMBER).isObjectRef).toBe(false);
    });

    it('OR-5c: JSONB → isObjectRef=false (JSONB is structured data, not a graph reference)', () => {
        expect(computeObjectRefFlags(APP_DATA_TYPES.JSONB).isObjectRef).toBe(false);
    });

    it('OR-5d: SELECT → isObjectRef=false', () => {
        expect(computeObjectRefFlags(APP_DATA_TYPES.SELECT).isObjectRef).toBe(false);
    });

    it('OR-5e: DATETIME → isObjectRef=false', () => {
        expect(computeObjectRefFlags(APP_DATA_TYPES.DATETIME).isObjectRef).toBe(false);
    });

    it('OR-5f: BOOLEAN → isObjectRef=false', () => {
        expect(computeObjectRefFlags(APP_DATA_TYPES.BOOLEAN).isObjectRef).toBe(false);
    });

    // OR-6: Edge cases
    it('OR-6a: null dataType → isObjectRef=false', () => {
        expect(computeObjectRefFlags(null).isObjectRef).toBe(false);
    });

    it('OR-6b: undefined dataType → isObjectRef=false', () => {
        expect(computeObjectRefFlags(undefined).isObjectRef).toBe(false);
    });

    it('OR-6c: empty string → isObjectRef=false', () => {
        expect(computeObjectRefFlags('').isObjectRef).toBe(false);
    });

    // OR-7: Arbitrary admin-created field (field 126 scenario)
    it('OR-7: PERSON_REF field (e.g. fieldNo=126 "Named Beneficiaries") → picker is correctly detected', () => {
        // Simulates what getFieldDetail returns for field 126:
        const mockDataFromGetFieldDetail = {
            fieldNo: 126,
            fieldName: 'Named Beneficiaries ppl',
            dataType: 'PERSON_REF',  // ← key: dataType from getFieldDetail
            isRepeating: true,
        };

        const { isPartyRef, isObjectRef } = computeObjectRefFlags(mockDataFromGetFieldDetail.dataType);

        // Before the fix: isPartyRef=false, isObjectRef=false → no picker rendered
        // After the fix:  isPartyRef=true,  isObjectRef=true  → picker renders
        expect(isPartyRef).toBe(true);
        expect(isObjectRef).toBe(true);
    });

    // Exhaustiveness: all reference types are covered
    it('All four reference types produce isObjectRef=true', () => {
        const refTypes = [
            APP_DATA_TYPES.PARTY_REF,
            APP_DATA_TYPES.PERSON_REF,
            APP_DATA_TYPES.ORG_REF,
            APP_DATA_TYPES.ADDRESS_REF,
        ];
        for (const t of refTypes) {
            expect(computeObjectRefFlags(t).isObjectRef).toBe(true);
        }
    });
});
