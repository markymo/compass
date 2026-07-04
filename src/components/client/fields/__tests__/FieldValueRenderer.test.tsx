import { describe, it, expect } from 'vitest';
import { FieldValueRenderer } from '../FieldValueRenderer';
import { FieldDisplayModel } from '@/lib/master-data/field-display-model';

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

    it('returns null for POPULATED non-scalar values (fallback boundary)', () => {
        const field: FieldDisplayModel = {
            ...baseField,
            state: 'POPULATED',
            value: { kind: 'party', partyId: 'p1', data: {} },
            textSummary: 'Party'
        };

        const element: any = FieldValueRenderer({ field });
        expect(element).toBeNull();
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
