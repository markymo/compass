import { describe, it, expect } from 'vitest';
import { toExportText } from '../toExportText';
import { FieldDisplayModel } from '@/lib/master-data/field-display-model';

describe('toExportText', () => {
    const baseField: any = {
        fieldNo: 1,
        label: 'Test',
        isEditable: false,
        isMultiValue: false,
        source: null,
        textSummary: 'Summary',
        category: 'Test'
    };

    describe('Explicit States', () => {
        it('handles EXPLICIT_NONE', () => {
            const field: FieldDisplayModel = { ...baseField, state: 'EXPLICIT_NONE', value: { kind: 'empty' } };
            expect(toExportText(field)).toBe('None');
        });

        it('handles NO_DATA and UNMAPPED', () => {
            const fieldNoData: FieldDisplayModel = { ...baseField, state: 'NO_DATA', value: { kind: 'empty' } };
            expect(toExportText(fieldNoData)).toBe('No response recorded');

            const fieldUnmapped: FieldDisplayModel = { ...baseField, state: 'UNMAPPED', value: { kind: 'empty' } };
            expect(toExportText(fieldUnmapped)).toBe('No response recorded');
        });

        it('handles DEFAULT', () => {
            const field: FieldDisplayModel = { ...baseField, state: 'DEFAULT', defaultText: 'A default', value: { kind: 'scalar', display: 'A default', rawValue: 'A default' } };
            expect(toExportText(field)).toBe('A default');
        });
    });

    describe('Scalars & Primitives', () => {
        it('handles empty POPULATED', () => {
            const field: FieldDisplayModel = { ...baseField, state: 'POPULATED', value: { kind: 'empty' } };
            expect(toExportText(field)).toBe('');
        });

        it('handles scalar strings and numbers', () => {
            const str: FieldDisplayModel = { ...baseField, state: 'POPULATED', value: { kind: 'scalar', display: 'Hello', rawValue: 'Hello' } };
            expect(toExportText(str)).toBe('Hello');

            const num: FieldDisplayModel = { ...baseField, state: 'POPULATED', value: { kind: 'scalar', display: '123', rawValue: 123 } };
            expect(toExportText(num)).toBe('123');
        });
    });

    describe('PARTY Handling', () => {
        it('handles PARTY without displayMask using projection', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { kind: 'party', data: { organisationName: 'Acme Corp', roles: [{ roleTitle: 'Director' }] } as any, summary: 'Acme Corp (Director)' }
            };
            expect(toExportText(field)).toBe('Acme Corp\nDirector');
        });

        it('handles PARTY with displayMask', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'party', 
                    data: { organisationName: 'Acme Corp', roles: [{ roleTitle: 'Director' }] } as any, 
                    summary: 'Ignored Summary',
                    displayMask: ['organisationName', 'roles']
                }
            };
            expect(toExportText(field)).toBe('Acme Corp\nDirector');
        });

        it('handles embedded Address objects within a displayMask', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'party', 
                    data: { 
                        organisationName: 'Acme Corp', 
                        correspondenceAddress: { addressLines: ['123 Street'], countryCode: 'US' } 
                    } as any, 
                    summary: 'Ignored',
                    displayMask: ['organisationName', 'correspondenceAddress']
                }
            };
            // The country code logic maps 'US' to 'United States'
            expect(toExportText(field)).toBe('Acme Corp\n123 Street, United States');
        });
        
        it('skips missing fields in displayMask', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'party', 
                    data: { organisationName: 'Acme Corp' } as any, 
                    summary: 'Ignored',
                    displayMask: ['organisationName', 'missingField']
                }
            };
            expect(toExportText(field)).toBe('Acme Corp');
        });
    });

    describe('ADDRESS Handling', () => {
        it('handles address with summary', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { kind: 'address', data: {} as any, summary: '456 Road, Town, France' }
            };
            expect(toExportText(field)).toBe('456 Road, Town, France');
        });
    });

    describe('Reference Resolution (PARTY_REF / ADDRESS_REF)', () => {
        it('resolves partyRef if resolved data is present', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { kind: 'partyRef', refId: '123', summary: 'Resolved Party', resolved: { companyName: 'Resolved Party' } as any }
            };
            expect(toExportText(field)).toBe('Resolved Party');
        });

        it('resolves addressRef if resolved data is present', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'addressRef', 
                    refId: '123', 
                    summary: 'Ignored', 
                    resolved: { addressLines: ['Resolved Address'] } as any 
                }
            };
            expect(toExportText(field)).toBe('Resolved Address');
        });

        it('falls back to summary if reference is unresolved', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { kind: 'partyRef', refId: '123', summary: 'Fallback Summary' }
            };
            expect(toExportText(field)).toBe('Fallback Summary');
        });
    });

    describe('Collections', () => {
        it('handles scalar collections', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'collection', 
                    items: [
                        { value: { kind: 'scalar', display: 'A', rawValue: 'A' } },
                        { value: { kind: 'scalar', display: 'B', rawValue: 'B' } }
                    ]
                }
            };
            expect(toExportText(field)).toBe('• A\n• B');
        });

        it('handles complex collections recursively', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'collection', 
                    items: [
                        { value: { kind: 'address', data: {} as any, summary: 'Addr 1' } },
                        { value: { kind: 'party', data: {} as any, summary: 'Party 1' } }
                    ]
                }
            };
            expect(toExportText(field)).toBe('• Addr 1\n• Party 1');
        });

        it('handles Field 20 structured collections correctly', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: {
                    kind: 'collection',
                    items: [
                        { value: { kind: 'scalar', display: '35110 — Production of electricity', rawValue: { code: '35110', label: 'Production of electricity' } } },
                        { value: { kind: 'scalar', display: '41100 — Development of building projects', rawValue: { code: '41100', label: 'Development of building projects' } } }
                    ]
                }
            };
            const result = toExportText(field);
            expect(result).toBe('• 35110 — Production of electricity\n• 41100 — Development of building projects');
            expect(result).not.toContain('[Structured value]');
        });
    });

    describe('Fixes', () => {
        it('INTENTIONAL FIX: code lists export as meaningful text joined by semicolons', () => {
            const field: FieldDisplayModel = {
                ...baseField,
                state: 'POPULATED',
                value: { 
                    kind: 'codeList', 
                    items: [
                        { code: 'DIR', label: 'Director' },
                        { code: 'SHR', label: 'Shareholder' }
                    ]
                }
            };
            // Previously this rendered as "[Structured value]; [Structured value]"
            expect(toExportText(field)).toBe('Director; Shareholder');
        });
    });
});
