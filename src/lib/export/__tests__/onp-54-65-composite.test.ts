import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';

// Contract: COMP-01 — A populated composite group resolves canonically from Master into mapped questionnaire/Workbench and output/export surfaces
// Linear: ONP-54, ONP-65

describe('COMP-01 / ONP-54 + ONP-65 — Composite Group Canonical Resolution Logic', () => {
    it('resolves composite member fields with individual canonical display structures and provenance', () => {
        const directorData = [
            {
                forenames: 'Arthur',
                surname: 'Pendleton-Composite',
                partyType: 'PERSON',
                roles: [{ roleTitle: 'Director', roleType: 'DIRECTOR' }]
            }
        ];

        const rawSource = {
            source: 'USER_INPUT',
            sourceCheckedAt: new Date('2026-08-29T12:00:00.000Z'),
            timestamp: new Date('2026-08-29T12:00:00.000Z'),
        };

        const resolved = resolveFieldForDisplay(
            directorData,
            rawSource,
            {
                fieldNo: 63,
                label: 'Company directors',
                appDataType: 'PARTY',
                isMultiValue: true,
                displayState: 'POPULATED' as const,
            } as any
        );

        expect(resolved.value.kind).toBe('collection');
        if (resolved.value.kind === 'collection') {
            expect(resolved.value.items).toHaveLength(1);
            expect(JSON.stringify(resolved.value.items[0])).toContain('Arthur');
            expect(JSON.stringify(resolved.value.items[0])).toContain('Pendleton-Composite');
        }
    });
});
