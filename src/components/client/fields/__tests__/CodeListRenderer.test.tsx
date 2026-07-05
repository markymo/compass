import { describe, it, expect } from 'vitest';
import { CodeListRenderer } from '../CodeListRenderer';
import { ResolvedFieldValue } from '@/lib/master-data/field-display-model';

describe('CodeListRenderer', () => {
    it('returns null for empty items', () => {
        const value: Extract<ResolvedFieldValue, { kind: 'codeList' }> = {
            kind: 'codeList',
            items: []
        };
        const element = CodeListRenderer({ value });
        expect(element).toBeNull();
    });

    it('renders single item with code + label', () => {
        const value: Extract<ResolvedFieldValue, { kind: 'codeList' }> = {
            kind: 'codeList',
            items: [{ code: '123', label: 'Test Label' }]
        };
        const element: any = CodeListRenderer({ value });
        expect(element?.type).toBe('span');
        expect(element?.props?.children).toBe('123 — Test Label');
    });

    it('renders single item with missing label', () => {
        const value: Extract<ResolvedFieldValue, { kind: 'codeList' }> = {
            kind: 'codeList',
            // @ts-ignore
            items: [{ code: '123' }]
        };
        const element: any = CodeListRenderer({ value });
        expect(element?.props?.children).toBe('123');
    });

    it('renders single item with label same as code', () => {
        const value: Extract<ResolvedFieldValue, { kind: 'codeList' }> = {
            kind: 'codeList',
            items: [{ code: '123', label: '123' }]
        };
        const element: any = CodeListRenderer({ value });
        expect(element?.props?.children).toBe('123');
    });

    it('renders multiple items joined by semicolon', () => {
        const value: Extract<ResolvedFieldValue, { kind: 'codeList' }> = {
            kind: 'codeList',
            items: [
                { code: 'A', label: 'Alpha' },
                { code: 'B', label: 'B' },
                { code: 'C', label: 'Charlie' }
            ]
        };
        const element: any = CodeListRenderer({ value });
        expect(element?.props?.children).toBe('A — Alpha; B; C — Charlie');
    });

    it('truncates items and appends + N more when itemLimit is exceeded', () => {
        const value: Extract<ResolvedFieldValue, { kind: 'codeList' }> = {
            kind: 'codeList',
            items: [
                { code: 'A', label: 'Alpha' },
                { code: 'B', label: 'Beta' },
                { code: 'C', label: 'Charlie' },
                { code: 'D', label: 'Delta' }
            ]
        };
        const element: any = CodeListRenderer({ value, itemLimit: 2 });
        expect(element?.props?.children).toBe('A — Alpha; B — Beta; +2 more');
    });
});
