import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay, resolveFieldCollectionForDisplay } from '../field-interpreter';

// Contract: PROV-01 — Last validated provenance is consistent across surfaces
// Linear: ONP-33

describe('PROV-01 / ONP-33 — Provenance & Last Validated Consistency Invariants', () => {
    it('1. Active claim with sourceCheckedAt sets lastValidatedAt accurately', () => {
        const testDate = new Date('2026-08-20T14:30:00.000Z');
        const rawSource = {
            type: 'COMPANIES_HOUSE',
            reference: '01234567',
            sourceCheckedAt: testDate,
            timestamp: new Date('2026-08-10T10:00:00.000Z'),
            userName: null
        };

        const result = resolveFieldForDisplay('Acme Ltd', rawSource, {
            fieldNo: 2,
            isMultiValue: false
        });

        expect(result.source).toBeDefined();
        expect(result.source?.lastValidatedAt).toBe('2026-08-20T14:30:00.000Z');
        expect(result.source?.timestamp).toBe('2026-08-10T10:00:00.000Z');
    });

    it('2. Active claim falling back to timestamp when sourceCheckedAt is absent', () => {
        const testTimestamp = new Date('2026-08-15T09:00:00.000Z');
        const rawSource = {
            type: 'USER_INPUT',
            reference: null,
            sourceCheckedAt: null,
            timestamp: testTimestamp,
            userName: 'Alice Admin'
        };

        const result = resolveFieldForDisplay('Tech Solutions', rawSource, {
            fieldNo: 78,
            isMultiValue: false
        });

        expect(result.source).toBeDefined();
        expect(result.source?.lastValidatedAt).toBe('2026-08-15T09:00:00.000Z');
    });

    it('3. Unmapped / no-source values do not produce a phantom lastValidatedAt date', () => {
        const result = resolveFieldForDisplay(null, null, {
            fieldNo: 99,
            isMultiValue: false
        });

        expect(result.source).toBeNull();
    });

    it('4. Collection items preserve consistent provenance across collection rows', () => {
        const items = [
            {
                value: { name: 'Director One', role: 'Director' },
                source: {
                    type: 'COMPANIES_HOUSE',
                    reference: '01234567',
                    timestamp: new Date('2026-08-01T12:00:00.000Z'),
                    sourceCheckedAt: new Date('2026-08-25T11:00:00.000Z')
                }
            }
        ];

        const collection = resolveFieldCollectionForDisplay(items, {
            fieldNo: 104,
            isMultiValue: true
        });

        expect(collection.value.kind).toBe('collection');
        if (collection.value.kind === 'collection') {
            expect(collection.value.items[0].source?.lastValidatedAt).toBe('2026-08-25T11:00:00.000Z');
        }
    });

    it('5. New winning claim update refreshes displayed provenance while preserving source metadata', () => {
        const initialTimestamp = new Date('2026-08-01T10:00:00.000Z');
        const updatedTimestamp = new Date('2026-08-29T16:00:00.000Z');

        const initialResult = resolveFieldForDisplay('Old Name Ltd', {
            type: 'USER_INPUT',
            reference: null,
            sourceCheckedAt: initialTimestamp,
            timestamp: initialTimestamp,
            userName: 'Initial Author'
        }, { fieldNo: 2, isMultiValue: false });

        const updatedResult = resolveFieldForDisplay('New Name Ltd', {
            type: 'USER_INPUT',
            reference: null,
            sourceCheckedAt: updatedTimestamp,
            timestamp: updatedTimestamp,
            userName: 'Second Author'
        }, { fieldNo: 2, isMultiValue: false });

        expect(initialResult.source?.lastValidatedAt).toBe('2026-08-01T10:00:00.000Z');
        expect(updatedResult.source?.lastValidatedAt).toBe('2026-08-29T16:00:00.000Z');
        expect(updatedResult.source?.label).toBe('User input');
    });
});
