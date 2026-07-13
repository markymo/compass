import { describe, it, expect, vi } from 'vitest';
import { FieldValueRenderer } from '../FieldValueRenderer';
import { FieldDisplayModel } from '@/lib/master-data/field-display-model';

vi.mock('../FieldAttachments', () => ({
    FieldAttachments: () => <div data-testid="mock-field-attachments" />
}));

describe('FieldValueRenderer', () => {
    const baseField: Omit<FieldDisplayModel, 'state' | 'value' | 'defaultText'> = {
        fieldNo: 1,
        label: 'Test Field',
        textSummary: '',
        source: null,
        isEditable: true,
        isMultiValue: false,
    };

    it('renders POPULATED scalar values', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'scalar', display: 'Test Value', rawValue: 'Test Value' },
            textSummary: 'Test Value'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.type).toBe('span');
        expect(element?.props?.children).toBe('Test Value');
    });

    it('returns null for POPULATED unhandled values (fallback boundary)', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'unknown_fake_kind' } as any, // simulating unhandled
            textSummary: 'Summary'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element).toBeNull();
    });

    it('renders POPULATED address values using AddressRenderer', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'address', data: {} as any, summary: 'Address' },
            textSummary: 'Address'
        };

        const element: any = FieldValueRenderer({ field, layout: 'detailed' });
        expect(element?.type?.name || element?.type?.displayName).toBe('AddressRenderer');
        expect(element?.props?.layout).toBe('detailed');
    });

    it('renders POPULATED addressRef values using AddressRenderer', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'addressRef', refId: '123', summary: 'AddressRef' },
            textSummary: 'AddressRef'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.type?.name || element?.type?.displayName).toBe('AddressRenderer');
    });

    it('renders POPULATED collection values using CollectionRenderer with appropriate layout', () => {
        const scalarField: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { 
                kind: 'collection', 
                items: [{ value: { kind: 'scalar', display: 'A', rawValue: 'A' } }] 
            },
            textSummary: 'Collection'
        };

        const scalarElement: any = FieldValueRenderer({ field: scalarField });
        expect(scalarElement?.type?.name || scalarElement?.type?.displayName).toBe('CollectionRenderer');
        expect(scalarElement?.props?.collectionLayout).toBe('inline');

        const complexField: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { 
                kind: 'collection', 
                items: [{ value: { kind: 'party', data: {} as any, summary: 'P' } }] 
            },
            textSummary: 'Collection'
        };

        const complexElement: any = FieldValueRenderer({ field: complexField });
        expect(complexElement?.type?.name || complexElement?.type?.displayName).toBe('CollectionRenderer');
        expect(complexElement?.props?.collectionLayout).toBe('block');
        
        const addressField: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { 
                kind: 'collection', 
                items: [{ value: { kind: 'address', data: {} as any, summary: 'A' } }] 
            },
            textSummary: 'Collection'
        };

        const addressElement: any = FieldValueRenderer({ field: addressField });
        expect(addressElement?.type?.name || addressElement?.type?.displayName).toBe('CollectionRenderer');
        expect(addressElement?.props?.collectionLayout).toBe('block');
        
        const addressRefField: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { 
                kind: 'collection', 
                items: [{ value: { kind: 'addressRef', refId: '123', summary: 'A' } }] 
            },
            textSummary: 'Collection'
        };

        const addressRefElement: any = FieldValueRenderer({ field: addressRefField });
        expect(addressRefElement?.type?.name || addressRefElement?.type?.displayName).toBe('CollectionRenderer');
        expect(addressRefElement?.props?.collectionLayout).toBe('block');
    });

    it('renders POPULATED codeList values using CodeListRenderer', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { 
                kind: 'codeList', 
                items: [{ code: '123' }] 
            },
            textSummary: 'CodeList'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.type?.name || element?.type?.displayName).toBe('CodeListRenderer');
    });

    it('renders POPULATED party values using PartyRenderer', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'party', data: {} as any, summary: 'Party' },
            textSummary: 'Party'
        };

        const element: any = FieldValueRenderer({ field, layout: 'row' });
        // Instead of deep snapshotting PartyRenderer, we just assert its name/type matches
        expect(element?.type?.name || element?.type?.displayName).toBe('PartyRenderer');
        expect(element?.props?.layout).toBe('row');
    });

    it('renders POPULATED partyRef values using PartyRenderer', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'partyRef', refId: '123', summary: 'PartyRef' },
            textSummary: 'PartyRef'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.type?.name || element?.type?.displayName).toBe('PartyRenderer');
    });

    it('renders EXPLICIT_NONE', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'EXPLICIT_NONE',
            value: { kind: 'empty' },
            textSummary: 'None'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.props?.className).toContain('text-slate-800');
        expect(element?.props?.className).toContain('font-medium');
        expect(element?.props?.children).toBe('None');
    });

    it('renders NO_DATA', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'NO_DATA',
            value: { kind: 'empty' },
            textSummary: 'None'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.props?.className).toContain('text-slate-800');
        expect(element?.props?.className).toContain('font-medium');
        expect(element?.props?.children).toBe('None');
    });

    it('renders UNMAPPED', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'UNMAPPED',
            value: { kind: 'empty' },
            textSummary: 'No response recorded'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.props?.className).toContain('text-slate-400');
        expect(element?.props?.className).toContain('italic');
        expect(element?.props?.children).toBe('No response recorded');
    });

    it('renders DEFAULT', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'DEFAULT',
            value: { kind: 'scalar', display: 'Default Val', rawValue: 'Default Val' },
            textSummary: 'Default Val',
            defaultText: 'Default Val'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element?.props?.className).toContain('text-blue-600');
        
        const children = element?.props?.children;
        expect(children).toHaveLength(2);
        
        // Text span
        expect(children[0]?.props?.children).toBe('Default Val');
        
        // Badge
        expect(children[1]?.type?.name || children[1]?.type?.displayName || children[1]?.props?.children).toBeDefined();
        // The badge children should be 'Field Default'
        expect(children[1]?.props?.children).toBe('Field Default');
    });
    
    it('applies custom className', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'scalar', display: 'Test Value', rawValue: 'Test Value' },
            textSummary: 'Test Value'
        };

        const element: any = FieldValueRenderer({ field, className: 'custom-class' });
        expect(element?.props?.className).toBe('custom-class');
    });
});
