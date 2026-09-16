import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay, resolveFieldCollectionForDisplay, FieldInterpreterMetadata, extractFieldOptions } from '../field-interpreter';
import { toExportText } from '@/lib/export/toExportText';
import { getCompactCanonicalSummary } from '../field-interpreter';

describe('ONP-190 — Option-Set Display Resolution at Canonical Interpreter Layer', () => {
    const currencyOptions = [
        { value: 'GBP', label: 'GBP – Pound Sterling' },
        { value: 'EUR', label: 'EUR – Euro' },
        { value: 'USD', label: 'USD – US Dollar' },
        { value: 'JPY', label: 'JPY – Yen' }
    ];

    describe('1. Canonical scalar interpreter with options metadata', () => {
        it('resolves display label from matching option while preserving rawValue exactly', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                options: currencyOptions
            };

            const result = resolveFieldForDisplay('GBP', null, meta);

            expect(result.state).toBe('POPULATED');
            expect(result.value.kind).toBe('scalar');
            if (result.value.kind === 'scalar') {
                expect(result.value.rawValue).toBe('GBP');
                expect(result.value.display).toBe('GBP – Pound Sterling');
            }
            expect(result.textSummary).toBe('GBP – Pound Sterling');
        });

        it('safely falls back to rawValue string when option value is not found in configured options', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                options: currencyOptions
            };

            const result = resolveFieldForDisplay('UNKNOWN_CURRENCY', null, meta);

            expect(result.state).toBe('POPULATED');
            expect(result.value.kind).toBe('scalar');
            if (result.value.kind === 'scalar') {
                expect(result.value.rawValue).toBe('UNKNOWN_CURRENCY');
                expect(result.value.display).toBe('UNKNOWN_CURRENCY');
            }
            expect(result.textSummary).toBe('UNKNOWN_CURRENCY');
        });

        it('retains default behaviour for plain scalar fields with no options configured', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 3,
                label: 'Legal Name'
            };

            const result = resolveFieldForDisplay('Acme Corporation', null, meta);

            expect(result.state).toBe('POPULATED');
            expect(result.value.kind).toBe('scalar');
            if (result.value.kind === 'scalar') {
                expect(result.value.rawValue).toBe('Acme Corporation');
                expect(result.value.display).toBe('Acme Corporation');
            }
            expect(result.textSummary).toBe('Acme Corporation');
        });

        it('never replaces rawValue with label in storage / model value', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                options: currencyOptions
            };

            const result = resolveFieldForDisplay('EUR', null, meta);

            expect(result.value.kind).toBe('scalar');
            if (result.value.kind === 'scalar') {
                expect(result.value.rawValue).toBe('EUR');
                expect(result.value.rawValue).not.toBe('EUR – Euro');
            }
        });

        it('handles array options of plain strings uniformly', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 50,
                label: 'Category',
                options: ['Alpha', 'Beta', 'Gamma']
            };

            const result = resolveFieldForDisplay('Beta', null, meta);

            expect(result.value.kind).toBe('scalar');
            if (result.value.kind === 'scalar') {
                expect(result.value.rawValue).toBe('Beta');
                expect(result.value.display).toBe('Beta');
            }
        });

        it('resolves display labels inside repeating collections while preserving per-item rawValues', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                isMultiValue: true,
                options: currencyOptions
            };

            const result = resolveFieldCollectionForDisplay(
                [
                    { value: 'GBP', source: null, instanceId: 'inst-1' },
                    { value: 'USD', source: null, instanceId: 'inst-2' }
                ],
                meta
            );

            expect(result.value.kind).toBe('collection');
            if (result.value.kind === 'collection') {
                expect(result.value.items).toHaveLength(2);
                const item0 = result.value.items[0].value;
                const item1 = result.value.items[1].value;

                expect(item0.kind).toBe('scalar');
                expect(item1.kind).toBe('scalar');

                if (item0.kind === 'scalar' && item1.kind === 'scalar') {
                    expect(item0.rawValue).toBe('GBP');
                    expect(item0.display).toBe('GBP – Pound Sterling');

                    expect(item1.rawValue).toBe('USD');
                    expect(item1.display).toBe('USD – US Dollar');
                }
            }
            expect(result.textSummary).toBe('GBP – Pound Sterling; USD – US Dollar');
        });
    });

    describe('2. Downstream consumers (toExportText & getCompactCanonicalSummary)', () => {
        it('toExportText automatically exports display label for option-backed scalar', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                options: currencyOptions
            };

            const model = resolveFieldForDisplay('GBP', null, meta);
            const exportText = toExportText(model);

            expect(exportText).toBe('GBP – Pound Sterling');
        });

        it('toExportText exports bulleted display labels for option-backed collection', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                isMultiValue: true,
                options: currencyOptions
            };

            const model = resolveFieldCollectionForDisplay(
                [
                    { value: 'GBP', source: null, instanceId: 'inst-1' },
                    { value: 'EUR', source: null, instanceId: 'inst-2' }
                ],
                meta
            );
            const exportText = toExportText(model);

            expect(exportText).toBe('• GBP – Pound Sterling\n• EUR – Euro');
        });

        it('getCompactCanonicalSummary returns display label for single item', () => {
            const meta: FieldInterpreterMetadata = {
                fieldNo: 116,
                label: 'Settlement currency',
                options: currencyOptions
            };

            const model = resolveFieldForDisplay('JPY', null, meta);
            const summary = getCompactCanonicalSummary(model, { label: 'Settlement currency' });

            expect(summary).toBe('JPY – Yen');
        });
    });

    describe('3. extractFieldOptions helper', () => {
        it('extracts and normalizes options from optionSet with { label, value } array', () => {
            const def = {
                fieldNo: 116,
                fieldName: 'Settlement currency',
                optionSet: {
                    id: 'opt-set-1',
                    name: 'ISO_Currency_Code',
                    options: [
                        { label: 'GBP – Pound Sterling', value: 'GBP' },
                        { label: 'EUR – Euro', value: 'EUR' }
                    ]
                }
            };

            const extracted = extractFieldOptions(def);
            expect(extracted).toEqual([
                { label: 'GBP – Pound Sterling', value: 'GBP' },
                { label: 'EUR – Euro', value: 'EUR' }
            ]);
        });

        it('falls back to def.options when optionSet is not present', () => {
            const def = {
                fieldNo: 99,
                fieldName: 'Some Field',
                options: ['Opt A', 'Opt B']
            };

            const extracted = extractFieldOptions(def);
            expect(extracted).toEqual([
                { label: 'Opt A', value: 'Opt A' },
                { label: 'Opt B', value: 'Opt B' }
            ]);
        });

        it('returns undefined when neither optionSet nor options are present', () => {
            const def = {
                fieldNo: 3,
                fieldName: 'Legal Name'
            };

            const extracted = extractFieldOptions(def);
            expect(extracted).toBeUndefined();
        });
    });
});
