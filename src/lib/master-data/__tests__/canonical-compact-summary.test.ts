import { describe, it, expect } from 'vitest';
import { getCompactCanonicalSummary } from '../field-interpreter';
import { FieldDisplayModel } from '../field-display-model';

describe('getCompactCanonicalSummary (Canonical shared compact value renderer)', () => {
    it('1. returns empty string for empty / no-data models', () => {
        const model: FieldDisplayModel = {
            fieldNo: 1,
            label: 'Tax ID',
            state: 'NO_DATA',
            value: { kind: 'empty' },
            source: null,
            isEditable: false,
            isMultiValue: false,
            allowAttachments: false
        };
        expect(getCompactCanonicalSummary(model)).toBe('');
    });

    it('2. returns scalar display string for scalar fields', () => {
        const model: FieldDisplayModel = {
            fieldNo: 22,
            label: 'Company Registration Number',
            state: 'POPULATED',
            value: { kind: 'scalar', display: '12345678', rawValue: '12345678' },
            source: null,
            isEditable: false,
            isMultiValue: false,
            allowAttachments: false
        };
        expect(getCompactCanonicalSummary(model)).toBe('12345678');
    });

    it('3. returns party summary / party label for single party fields (e.g. Ultimate Parent)', () => {
        const model: FieldDisplayModel = {
            fieldNo: 40,
            label: 'Ultimate Parent Company',
            state: 'POPULATED',
            value: {
                kind: 'party',
                data: { partyType: 'ORGANISATION', legalName: 'Acme Holdings Limited' } as any,
                summary: 'Acme Holdings Limited',
                partyLabel: 'Acme Holdings Limited'
            },
            source: null,
            isEditable: false,
            isMultiValue: false,
            allowAttachments: false
        };
        expect(getCompactCanonicalSummary(model)).toBe('Acme Holdings Limited');
    });

    it('4. returns formatted address for address fields', () => {
        const model: FieldDisplayModel = {
            fieldNo: 15,
            label: 'Registered Office Address',
            state: 'POPULATED',
            value: {
                kind: 'address',
                data: { locality: 'London', postalCode: 'SW1A 1AA', addressLines: ['10 Downing Street'] } as any,
                summary: '10 Downing Street, London, SW1A 1AA'
            },
            source: null,
            isEditable: false,
            isMultiValue: false,
            allowAttachments: false
        };
        expect(getCompactCanonicalSummary(model)).toBe('10 Downing Street, London, SW1A 1AA');
    });

    it('5. returns human-friendly count for collection of directors (e.g. "3 directors") and never "Structured data" or "[Structured value]"', () => {
        const model: FieldDisplayModel = {
            fieldNo: 23,
            label: 'Directors',
            state: 'POPULATED',
            value: {
                kind: 'collection',
                items: [
                    { value: { kind: 'scalar', display: 'Alice Smith', rawValue: {} } },
                    { value: { kind: 'scalar', display: 'Bob Jones', rawValue: {} } },
                    { value: { kind: 'scalar', display: 'Charlie Brown', rawValue: {} } },
                ]
            },
            source: null,
            isEditable: false,
            isMultiValue: true,
            allowAttachments: false
        };
        const summary = getCompactCanonicalSummary(model, { label: 'Directors' });
        expect(summary).toBe('3 directors');
        expect(summary).not.toContain('Structured data');
        expect(summary).not.toContain('[Structured value]');
    });

    it('6. returns single item summary when collection has exactly 1 item', () => {
        const model: FieldDisplayModel = {
            fieldNo: 23,
            label: 'Directors',
            state: 'POPULATED',
            value: {
                kind: 'collection',
                items: [
                    { value: { kind: 'party', data: {} as any, summary: 'Alice Smith (Director)', partyLabel: 'Alice Smith' } }
                ]
            },
            source: null,
            isEditable: false,
            isMultiValue: true,
            allowAttachments: false
        };
        expect(getCompactCanonicalSummary(model, { label: 'Directors' })).toBe('Alice Smith (Director)');
    });

    it('7. returns generic count fallback for unrecognised collection labels (e.g. "5 items")', () => {
        const model: FieldDisplayModel = {
            fieldNo: 999,
            label: 'Custom Group Items',
            state: 'POPULATED',
            value: {
                kind: 'collection',
                items: [
                    { value: { kind: 'scalar', display: 'Item 1', rawValue: 1 } },
                    { value: { kind: 'scalar', display: 'Item 2', rawValue: 2 } },
                ]
            },
            source: null,
            isEditable: false,
            isMultiValue: true,
            allowAttachments: false
        };
        expect(getCompactCanonicalSummary(model, { label: 'Custom Group Items' })).toBe('2 items');
    });
});
