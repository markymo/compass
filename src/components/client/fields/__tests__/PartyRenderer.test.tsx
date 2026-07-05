import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PartyRenderer } from '../PartyRenderer';

describe('PartyRenderer', () => {
    const mockPartyValue = {
        contactType: 'PERSON',
        forenames: 'John',
        surname: 'Doe',
        roles: [],
        nationality: [],
        phones: [],
        sourceIdentifiers: []
    } as any;

    it('delegates kind: "party" to PersonOrContactValueViewer', () => {
        const value = {
            kind: 'party' as const,
            data: mockPartyValue,
            summary: 'John Doe',
            displayMask: ['forenames']
        };

        const element: any = PartyRenderer({ value, layout: "row", className: "test-class" });
        
        expect(element?.type).toBe('div');
        expect(element?.props?.className).toBe('test-class');
        
        const viewer = element?.props?.children;
        expect(viewer?.type?.name || viewer?.type?.displayName).toBe('PersonOrContactValueViewer');
        expect(viewer?.props?.layout).toBe('row');
        expect(viewer?.props?.displayMask).toEqual(['forenames']);
        expect(viewer?.props?.value).toBe(mockPartyValue);
    });

    it('delegates resolved kind: "partyRef" to PersonOrContactValueViewer', () => {
        const value = {
            kind: 'partyRef' as const,
            refId: '123',
            summary: 'Jane Smith',
            resolved: mockPartyValue,
            displayMask: ['surname']
        };

        const element: any = PartyRenderer({ value });
        
        expect(element?.type).toBe('div');
        
        const viewer = element?.props?.children;
        expect(viewer?.type?.name || viewer?.type?.displayName).toBe('PersonOrContactValueViewer');
        expect(viewer?.props?.layout).toBe('compact'); // default
        expect(viewer?.props?.displayMask).toEqual(['surname']);
        expect(viewer?.props?.value).toBe(mockPartyValue);
    });

    it('renders unresolved kind: "partyRef" using summary fallback', () => {
        const value = {
            kind: 'partyRef' as const,
            refId: '123',
            summary: 'ID:123...'
        };

        const element: any = PartyRenderer({ value, className: "custom-class" });
        
        expect(element?.type).toBe('span');
        expect(element?.props?.className).toContain('text-slate-400');
        expect(element?.props?.className).toContain('italic');
        expect(element?.props?.className).toContain('custom-class');
        expect(element?.props?.children).toBe('ID:123...');
    });
});

