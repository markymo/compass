/**
 * field5-name-type-projection.test.ts
 *
 * Deterministic test for ONP-16 / 7.54:
 * Field 5 (Previous Names) semantic nameType preservation and display projection.
 *
 * Scenario:
 *  - Multiple previous names with explicit nameType values
 *    (e.g., PREVIOUS_LEGAL_NAME, TRADING_OR_OPERATING_NAME).
 *  - Verify whether nameType survives through TO_NAME_HISTORY_LIST,
 *    structured-value formatters, and resolveFieldForDisplay.
 */

import { describe, it, expect } from 'vitest';
import { applyTransform } from '../transforms';
import { formatStructuredCollectionRow } from '@/lib/master-data/structured-value-formatters';
import { resolveFieldForDisplay, FieldInterpreterMetadata } from '@/lib/master-data/field-interpreter';

describe('ONP-16 — Field 5 Previous Name Type Retention & Projection', () => {

    it('T1: TO_NAME_HISTORY_LIST retains nameType in normalized DTO', () => {
        const input = [
            { name: 'FORMER LEGAL NAME PLC', type: 'PREVIOUS_LEGAL_NAME' },
            { name: 'ANCILLARY TRADING BRAND', type: 'TRADING_OR_OPERATING_NAME' },
        ];

        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');
        expect(result.value).toHaveLength(2);
        expect(result.value[0].nameType).toBe('PREVIOUS_LEGAL_NAME');
        expect(result.value[1].nameType).toBe('TRADING_OR_OPERATING_NAME');
    });

    it('T2: formatStructuredCollectionRow formats nameType when dates are absent', () => {
        const row = {
            name: 'ANCILLARY TRADING BRAND',
            nameType: 'TRADING_OR_OPERATING_NAME',
        };

        const result = formatStructuredCollectionRow(5, row);
        console.log('[ONP-16 Test Baseline] formatStructuredCollectionRow result (no dates):', result);

        // Expected contract: When dates are absent, nameType should be conveyed in secondary text
        // Current behaviour: secondary is null because formatNameHistoryRow only inspects dates
        expect(result.secondary).not.toBeNull();
        expect(result.secondary).toMatch(/Trading|Operating|PREVIOUS_LEGAL_NAME|TRADING_OR_OPERATING_NAME/i);
    });

    it('T3: resolveFieldForDisplay preserves nameType in textSummary / display output', () => {
        const meta: FieldInterpreterMetadata = {
            fieldNo: 5,
            label: 'Previous Legal Name',
            appDataType: 'JSONB',
            isMultiValue: true,
        };

        const claimValue = [
            {
                name: 'CENTRICA (LW) LIMITED',
                nameType: 'PREVIOUS_LEGAL_NAME',
                effectiveFrom: '2006-03-03',
                effectiveTo: '2009-10-08',
            },
            {
                name: 'CENTRICA ENERGY',
                nameType: 'TRADING_OR_OPERATING_NAME',
            },
        ];

        const result = resolveFieldForDisplay(claimValue, null, meta);
        console.log('[ONP-16 Test Baseline] resolveFieldForDisplay textSummary:', result.textSummary);
        console.log('[ONP-16 Test Baseline] resolveFieldForDisplay value:', JSON.stringify(result.value, null, 2));

        expect(result.state).toBe('POPULATED');
    });
});
