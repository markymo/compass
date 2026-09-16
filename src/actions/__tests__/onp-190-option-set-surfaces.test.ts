import { describe, it, expect, vi } from 'vitest';
import { resolveCanonicalFieldDisplay } from '@/lib/export/export-answer-resolver';
import { toExportText } from '@/lib/export/toExportText';
import { extractFieldOptions, resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';

describe('ONP-190 — Surface Verification Tests (RED / GREEN)', () => {
    const f116Def = {
        fieldNo: 116,
        fieldName: 'Settlement currency',
        appDataType: 'TEXT',
        isMultiValue: false,
        optionSet: {
            id: 'iso-curr-1',
            name: 'ISO_Currency_Code',
            options: [
                { value: 'GBP', label: 'GBP – Pound Sterling' },
                { value: 'EUR', label: 'EUR – Euro' },
                { value: 'USD', label: 'USD – US Dollar' },
                { value: 'JPY', label: 'JPY – Yen' }
            ]
        }
    };

    it('Surface 1 & 2: Canonical display model for F116 resolves label "GBP – Pound Sterling" while preserving rawValue "GBP"', () => {
        const options = extractFieldOptions(f116Def);
        const metadata = {
            fieldNo: 116,
            label: 'Settlement currency',
            appDataType: 'TEXT',
            options
        };

        const model = resolveFieldForDisplay('GBP', { type: 'USER_INPUT' }, metadata);

        expect(model.state).toBe('POPULATED');
        expect(model.value.kind).toBe('scalar');
        if (model.value.kind === 'scalar') {
            expect(model.value.rawValue).toBe('GBP');
            expect(model.value.display).toBe('GBP – Pound Sterling');
        }
        expect(model.textSummary).toBe('GBP – Pound Sterling');
    });

    it('Surface 3: Question Bank / Workbench4 canonical model resolution for currency question', () => {
        const options = extractFieldOptions(f116Def);
        const metadata = {
            fieldNo: 116,
            label: 'Settlement currency',
            displayState: 'HAS_VALUE' as const,
            appDataType: 'TEXT',
            options
        };

        const model = resolveFieldForDisplay('JPY', { type: 'USER_INPUT' }, metadata);

        expect(model.value.kind).toBe('scalar');
        if (model.value.kind === 'scalar') {
            expect(model.value.rawValue).toBe('JPY');
            expect(model.value.display).toBe('JPY – Yen');
        }
    });

    it('Surface 4: Export / PDF canonical resolution and toExportText', async () => {
        const options = extractFieldOptions(f116Def);
        const meta = {
            fieldNo: 116,
            label: 'Settlement currency',
            displayState: 'HAS_VALUE' as const,
            appDataType: 'TEXT',
            options
        };

        const { displayModel, displayValue } = await resolveCanonicalFieldDisplay({
            derivedValue: 'GBP',
            primarySource: { type: 'USER_INPUT' },
            meta
        });

        expect(displayModel.value.kind).toBe('scalar');
        if (displayModel.value.kind === 'scalar') {
            expect(displayModel.value.rawValue).toBe('GBP');
            expect(displayModel.value.display).toBe('GBP – Pound Sterling');
        }
        expect(displayValue).toBe('GBP – Pound Sterling');
        expect(toExportText(displayModel)).toBe('GBP – Pound Sterling');
    });
});
