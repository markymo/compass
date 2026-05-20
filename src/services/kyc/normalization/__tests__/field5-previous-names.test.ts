/**
 * field5-previous-names.test.ts
 *
 * Focused tests for Field 5 — Previous Names.
 *
 * Covers:
 *   T1  CH previous_company_names → normalised row objects
 *   T2  Missing dates are tolerated (no crash, dates come out undefined)
 *   T3  buildNameHistoryRowKey is deterministic
 *   T4  Re-running with the same payload produces identical rowKeys
 *   T5  GLEIF-style plain string array is handled
 *   T6  GLEIF-style { name, type } objects are handled
 *   T7  Null/empty items are filtered out; missing name skips row
 *   T8  Single non-array value is wrapped and processed
 *   T9  renderNameHistoryRow formats full date range correctly
 *  T10  renderNameHistoryRow with no dates returns null secondary
 *  T11  renderNameHistoryRow with only effectiveTo returns "Until ..."
 *  T12  renderCollectionRow falls back gracefully for unregistered fieldNo
 *  T13  Fan-out: each item gets its rowKey as instanceId
 *  T14  valueJson carries the structured row object
 */

import { describe, it, expect } from 'vitest';
import {
    applyTransform,
    buildNameHistoryRowKey,
} from '../transforms';
import {
    renderNameHistoryRow,
    renderCollectionRow,
} from '@/lib/master-data/structured-collection-renderers';

// ── T1: CH shape ──────────────────────────────────────────────────────────────

describe('TO_NAME_HISTORY_LIST', () => {

    it('T1: CH previous_company_names → normalised row objects', () => {
        const input = [
            { name: 'CENTRICA (LW) LIMITED', ceased_on: '2009-10-08', effective_from: '2006-03-03' },
            { name: 'OLD TRADING NAME LTD',  ceased_on: '2005-12-31', effective_from: '2001-01-01' },
        ];

        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        expect(result.confidencePenalty).toBe(0);
        expect(Array.isArray(result.value)).toBe(true);
        expect(result.value).toHaveLength(2);

        const first = result.value[0];
        expect(first.name).toBe('CENTRICA (LW) LIMITED');
        expect(first.effectiveFrom).toBe('2006-03-03');
        expect(first.effectiveTo).toBe('2009-10-08');
        expect(first.rowKey).toBeDefined();
        expect(typeof first.rowKey).toBe('string');
    });

    // ── T2: Missing dates ─────────────────────────────────────────────────────

    it('T2: missing dates are tolerated — effectiveFrom/To come out undefined', () => {
        const input = [{ name: 'SOME OLD NAME PLC' }];

        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        expect(result.value).toHaveLength(1);
        const row = result.value[0];
        expect(row.name).toBe('SOME OLD NAME PLC');
        expect(row.effectiveFrom).toBeUndefined();
        expect(row.effectiveTo).toBeUndefined();
        expect(row.rowKey).toMatch(/^name_some_old_name_plc_unknown$/);
    });

    // ── T3: buildNameHistoryRowKey is deterministic ───────────────────────────

    it('T3: buildNameHistoryRowKey produces identical keys for identical inputs', () => {
        const k1 = buildNameHistoryRowKey('CENTRICA (LW) LIMITED', '2006-03-03');
        const k2 = buildNameHistoryRowKey('CENTRICA (LW) LIMITED', '2006-03-03');
        expect(k1).toBe(k2);
    });

    it('T3b: buildNameHistoryRowKey uses "unknown" when date is absent', () => {
        const k = buildNameHistoryRowKey('ACME CORP', null);
        expect(k).toBe('name_acme_corp_unknown');
    });

    it('T3c: buildNameHistoryRowKey normalises special chars in name', () => {
        const k = buildNameHistoryRowKey('CENTRICA (LW) LIMITED', '2006-03-03');
        // parentheses, spaces should all become underscores or be stripped
        expect(k).not.toMatch(/[()]/);
        expect(k).not.toMatch(/ /);
        expect(k).toMatch(/^name_/);
    });

    // ── T4: Re-enrichment produces same rowKeys ───────────────────────────────

    it('T4: applying the same payload twice produces identical rowKeys', () => {
        const input = [
            { name: 'STABLE NAME LTD', effective_from: '2010-01-01', ceased_on: '2015-06-30' },
        ];

        const r1 = applyTransform(input, 'TO_NAME_HISTORY_LIST');
        const r2 = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        expect(r1.rowKeys).toEqual(r2.rowKeys);
        expect(r1.value[0].rowKey).toBe(r2.value[0].rowKey);
    });

    // ── T5: GLEIF plain string array ──────────────────────────────────────────

    it('T5: GLEIF-style plain string array is handled', () => {
        const input = ['Trading Name Alpha', 'Trading Name Beta'];

        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        expect(result.value).toHaveLength(2);
        expect(result.value[0].name).toBe('Trading Name Alpha');
        expect(result.value[0].effectiveFrom).toBeUndefined();
        expect(result.value[1].name).toBe('Trading Name Beta');
    });

    // ── T6: GLEIF { name, type } object ──────────────────────────────────────

    it('T6: GLEIF-style { name, type } objects are handled', () => {
        const input = [
            { name: 'Centrica Energy Ltd', type: 'TRADING_OR_OPERATING_NAME' },
        ];

        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        expect(result.value).toHaveLength(1);
        const row = result.value[0];
        expect(row.name).toBe('Centrica Energy Ltd');
        expect(row.nameType).toBe('TRADING_OR_OPERATING_NAME');
        expect(row.effectiveFrom).toBeUndefined();
    });

    // ── T7: Null / empty items are filtered ───────────────────────────────────

    it('T7: null items and items with no name are filtered out', () => {
        const input = [
            null,
            { name: '' },
            { name: 'Valid Name Ltd' },
            undefined,
        ];

        const result = applyTransform(input as any, 'TO_NAME_HISTORY_LIST');

        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('Valid Name Ltd');
    });

    // ── T8: Single non-array value is wrapped ─────────────────────────────────

    it('T8: a single string (not an array) is wrapped and processed', () => {
        const result = applyTransform('Single Name Plc', 'TO_NAME_HISTORY_LIST');

        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('Single Name Plc');
    });

    // ── T13: Fan-out rowKeys parallel structure ───────────────────────────────

    it('T13: rowKeys array is parallel to value array', () => {
        const input = [
            { name: 'Alpha Ltd', effective_from: '2000-01-01' },
            { name: 'Beta Ltd',  effective_from: '2005-01-01' },
            { name: 'Gamma Ltd', effective_from: '2010-01-01' },
        ];

        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        expect(result.rowKeys).toHaveLength(3);
        expect(result.rowKeys![0]).toBe(result.value[0].rowKey);
        expect(result.rowKeys![1]).toBe(result.value[1].rowKey);
        expect(result.rowKeys![2]).toBe(result.value[2].rowKey);
    });

    // ── T14: valueJson carries structured row ─────────────────────────────────

    it('T14: each item object in value array contains name, dates, rowKey', () => {
        const input = [{ name: 'ACME CORP LTD', ceased_on: '2020-12-31', effective_from: '2010-06-01' }];
        const result = applyTransform(input, 'TO_NAME_HISTORY_LIST');

        const item = result.value[0];
        expect(item).toMatchObject({
            name: 'ACME CORP LTD',
            effectiveFrom: '2010-06-01',
            effectiveTo: '2020-12-31',
        });
        expect(item.rowKey).toMatch(/^name_acme_corp_ltd_2010-06-01$/);
    });
});

// ── Renderer tests ────────────────────────────────────────────────────────────

describe('renderNameHistoryRow', () => {

    // T9: full date range
    it('T9: formats full date range correctly', () => {
        const result = renderNameHistoryRow({
            name: 'CENTRICA (LW) LIMITED',
            effectiveFrom: '2006-03-03',
            effectiveTo: '2009-10-08',
        });

        expect(result.primary).toBe('CENTRICA (LW) LIMITED');
        // Secondary should contain both dates with an arrow
        expect(result.secondary).toContain('→');
        expect(result.secondary).toContain('2006');
        expect(result.secondary).toContain('2009');
    });

    // T10: no dates → null secondary
    it('T10: no dates returns null secondary', () => {
        const result = renderNameHistoryRow({ name: 'Some Previous Name' });

        expect(result.primary).toBe('Some Previous Name');
        expect(result.secondary).toBeNull();
    });

    // T11: only effectiveTo
    it('T11: only effectiveTo → "Until ..." secondary', () => {
        const result = renderNameHistoryRow({
            name: 'Ended Name Ltd',
            effectiveTo: '2015-06-30',
        });

        expect(result.secondary).toMatch(/^Until /);
    });
});

describe('renderCollectionRow', () => {

    // T12: graceful fallback for unregistered fieldNo
    it('T12: falls back gracefully for unregistered fieldNo', () => {
        const result = renderCollectionRow(999, { name: 'Something' });
        // Should still pick up .name from generic fallback
        expect(result.primary).toBe('Something');
        expect(result.secondary).toBeNull();
    });

    it('T12b: uses Field 5 renderer when fieldNo is 5', () => {
        const result = renderCollectionRow(5, {
            name: 'CENTRICA (LW) LIMITED',
            effectiveFrom: '2006-03-03',
            effectiveTo: '2009-10-08',
        });

        expect(result.primary).toBe('CENTRICA (LW) LIMITED');
        expect(result.secondary).toContain('→');
    });
});
