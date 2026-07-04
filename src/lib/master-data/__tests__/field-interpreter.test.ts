import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay, FieldInterpreterMetadata } from '../field-interpreter';

describe('field-interpreter', () => {
    const defaultMeta: FieldInterpreterMetadata = {
        fieldNo: 1,
        label: 'Test Field',
    };

    it('resolves explicitNone as EXPLICIT_NONE state with empty value', () => {
        const rawJson = JSON.stringify({ explicitNone: true });
        const result = resolveFieldForDisplay(rawJson, null, defaultMeta);

        expect(result.state).toBe('EXPLICIT_NONE');
        expect(result.value).toEqual({ kind: 'empty' });
        expect(result.textSummary).toBe('');
    });

    it('resolves explicitNone object (pre-parsed) as EXPLICIT_NONE', () => {
        const result = resolveFieldForDisplay({ explicitNone: true }, null, defaultMeta);

        expect(result.state).toBe('EXPLICIT_NONE');
        expect(result.value).toEqual({ kind: 'empty' });
    });

    it('resolves DEFAULT state with scalar display value', () => {
        const meta = { ...defaultMeta, displayState: 'DEFAULT_RESPONSE' as const, defaultText: 'Not Applicable' };
        // Value is typically null when falling back to default
        const result = resolveFieldForDisplay(null, null, meta);

        expect(result.state).toBe('DEFAULT');
        expect(result.value).toEqual({ kind: 'scalar', display: 'Not Applicable', rawValue: 'Not Applicable' });
        expect(result.textSummary).toBe('Not Applicable');
        expect(result.source?.type).toBe('DEFAULT');
    });

    it('resolves string array as collection of scalars', () => {
        const result = resolveFieldForDisplay(['A', 'B', 'C'], null, defaultMeta);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            expect(result.value.items).toHaveLength(3);
            expect(result.value.items[0].value).toEqual({ kind: 'scalar', display: 'A', rawValue: 'A' });
        }
        expect(result.textSummary).toBe('A; B; C');
    });

    it('resolves empty array as NO_DATA', () => {
        const result = resolveFieldForDisplay([], null, defaultMeta);

        expect(result.state).toBe('NO_DATA');
        expect(result.value).toEqual({ kind: 'empty' });
    });

    it('resolves Party json object as PARTY', () => {
        const party = {
            contactType: 'PERSON',
            forenames: 'John',
            surname: 'Doe',
            roles: []
        };
        const result = resolveFieldForDisplay(party, null, defaultMeta);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('party');
        if (result.value.kind === 'party') {
            expect(result.value.summary).toBe('John Doe');
            expect(result.value.data).toEqual(party);
        }
        expect(result.textSummary).toBe('John Doe');
    });

    it('resolves PARTY_REF object', () => {
        const ref = {
            ccPartyId: '12345678-abcd',
        };
        const result = resolveFieldForDisplay(ref, null, defaultMeta);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('partyRef');
        if (result.value.kind === 'partyRef') {
            expect(result.value.refId).toBe('12345678-abcd');
            expect(result.value.summary).toBe('ID:12345678…');
        }
        expect(result.textSummary).toBe('ID:12345678…');
    });

    it('resolves enriched PARTY_REF object', () => {
        const ref = {
            ccPartyId: '12345678-abcd',
            ccParty: {
                data: {
                    contactType: 'PERSON',
                    forenames: 'Jane',
                    surname: 'Smith',
                    roles: []
                }
            }
        };
        const result = resolveFieldForDisplay(ref, null, defaultMeta);

        expect(result.value.kind).toBe('partyRef');
        if (result.value.kind === 'partyRef') {
            expect(result.value.summary).toBe('Jane Smith');
        }
        expect(result.textSummary).toBe('Jane Smith');
    });

    it('resolves CodeList array', () => {
        const codes = [
            { code: 'A', label: 'Option A' },
            { code: 'B', label: 'Option B' }
        ];
        const result = resolveFieldForDisplay(codes, null, defaultMeta);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('codeList');
        expect(result.textSummary).toBe('Option A; Option B');
    });

    it('resolves Source label correctly', () => {
        const rawSource = { type: 'REGISTRATION_AUTHORITY', reference: 'RA000585', timestamp: new Date('2025-01-01T12:00:00Z') };
        const result = resolveFieldForDisplay('Hello', rawSource, defaultMeta);

        expect(result.source).toBeDefined();
        if (result.source) {
            expect(result.source.type).toBe('REGISTRATION_AUTHORITY');
            expect(result.source.reference).toBe('RA000585');
            expect(result.source.colorKey).toBe('REGISTRY');
            expect(result.source.category).toBe('REGISTRY');
            expect(result.source.label).toContain('Companies House');
            expect(result.source.timestamp).toBe('2025-01-01T12:00:00.000Z');
        }
    });
});
