import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddressRenderer } from '../AddressRenderer';

describe('AddressRenderer', () => {
    const mockAddressValue = {
        addressLines: ['123 Main St'],
        locality: 'London',
        region: 'Greater London',
        postalCode: 'E1 6AN',
        countryCode: 'GBR'
    } as any;

    it('delegates kind: "address" to AddressValueViewer', () => {
        const value = {
            kind: 'address' as const,
            data: mockAddressValue,
            summary: '123 Main St, London, GBR'
        };

        const element: any = AddressRenderer({ value, layout: "detailed", className: "test-class" });
        
        expect(element?.type).toBe('div');
        expect(element?.props?.className).toBe('test-class');
        
        const viewer = element?.props?.children;
        expect(viewer?.type?.name || viewer?.type?.displayName).toBe('AddressValueViewer');
        expect(viewer?.props?.layout).toBe('detailed');
        expect(viewer?.props?.value).toBe(mockAddressValue);
    });

    it('maps "row" layout to "compact" for AddressValueViewer', () => {
        const value = {
            kind: 'address' as const,
            data: mockAddressValue,
            summary: '123 Main St, London, GBR'
        };

        const element: any = AddressRenderer({ value, layout: "row" });
        
        const viewer = element?.props?.children;
        expect(viewer?.props?.layout).toBe('compact');
    });

    it('delegates resolved kind: "addressRef" to AddressValueViewer', () => {
        const value = {
            kind: 'addressRef' as const,
            refId: '123',
            summary: 'Resolved Address Summary',
            resolved: mockAddressValue
        };

        const element: any = AddressRenderer({ value });
        
        expect(element?.type).toBe('div');
        
        const viewer = element?.props?.children;
        expect(viewer?.type?.name || viewer?.type?.displayName).toBe('AddressValueViewer');
        expect(viewer?.props?.layout).toBe('compact'); // default
        expect(viewer?.props?.value).toBe(mockAddressValue);
    });

    it('renders unresolved kind: "addressRef" using summary fallback', () => {
        const value = {
            kind: 'addressRef' as const,
            refId: '123',
            summary: 'ID:123...'
        };

        const element: any = AddressRenderer({ value, className: "custom-class" });
        
        expect(element?.type).toBe('span');
        expect(element?.props?.className).toContain('text-slate-400');
        expect(element?.props?.className).toContain('italic');
        expect(element?.props?.className).toContain('custom-class');
        expect(element?.props?.children).toBe('ID:123...');
    });
});
