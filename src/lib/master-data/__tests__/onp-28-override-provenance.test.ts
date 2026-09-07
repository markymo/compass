import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay } from '../field-interpreter';

// Contract: MASTER-04 — Provenance updates on user override
// Linear: ONP-28

describe('MASTER-04 / ONP-28 — Master Field Override Provenance Resolution', () => {
    it('prefers USER_INPUT claim over EXTERNAL_REGISTRY and carries the winning timestamp', () => {
        const overrideDate = new Date('2026-08-29T12:00:00.000Z');

        const rawValue = 'Acme Override Ltd';
        const rawSource = {
            type: 'USER_INPUT',
            sourceCheckedAt: overrideDate,
            timestamp: overrideDate,
        };

        const metadata = {
            fieldNo: 2,
            label: 'Legal Entity Name',
            appDataType: 'STRING',
            isMultiValue: false,
            defaultText: '',
            displayState: 'POPULATED' as const,
        };

        const resolved = resolveFieldForDisplay(rawValue, rawSource, metadata as any);

        expect(resolved.value.display).toBe('Acme Override Ltd');
        expect(resolved.source).not.toBeNull();
        expect(resolved.source?.type).toBe('USER_INPUT');
        expect(resolved.source?.lastValidatedAt).toBe(overrideDate.toISOString());
        expect(resolved.source?.label).toBe('User input');
    });

    it('resolves historical source timestamp when not overridden', () => {
        const historicalDate = new Date('2025-01-15T10:00:00.000Z');
        const rawValue = 'Acme Historical Ltd';
        const rawSource = {
            type: 'GLEIF',
            sourceCheckedAt: historicalDate,
            timestamp: historicalDate,
        };

        const metadata = {
            fieldNo: 2,
            label: 'Legal Entity Name',
            appDataType: 'STRING',
            isMultiValue: false,
            defaultText: '',
            displayState: 'POPULATED' as const,
        };

        const resolved = resolveFieldForDisplay(rawValue, rawSource, metadata as any);

        expect(resolved.value.display).toBe('Acme Historical Ltd');
        expect(resolved.source).not.toBeNull();
        expect(resolved.source?.type).toBe('GLEIF');
        expect(resolved.source?.label).toBe('GLEIF');
        expect(resolved.source?.lastValidatedAt).toBe(historicalDate.toISOString());
    });
});
