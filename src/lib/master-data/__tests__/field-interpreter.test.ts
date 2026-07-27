import { describe, it, expect } from 'vitest';
import { resolveFieldForDisplay, FieldInterpreterMetadata } from '../field-interpreter';
import { getPartyDisplayProjection } from '../party-value';
import { toExportText } from '@/lib/export/toExportText';

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

    it('treats empty plain objects {} as NO_DATA', () => {
        const result = resolveFieldForDisplay({}, null, defaultMeta);
        expect(result.state).toBe('NO_DATA');
    });

    it('does NOT treat native Date objects as empty', () => {
        const dateObj = new Date('2026-07-07T12:00:00Z');
        const result = resolveFieldForDisplay(dateObj, null, defaultMeta);
        expect(result.state).toBe('POPULATED');
    });

    it('treats empty arrays [] as NO_DATA', () => {
        const result = resolveFieldForDisplay([], null, defaultMeta);
        expect(result.state).toBe('NO_DATA');
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

    it('formats DATE appDataType correctly with valid date string', () => {
        const meta = { ...defaultMeta, appDataType: 'DATE' };
        const result = resolveFieldForDisplay('2026-06-10T00:00:00Z', null, meta);

        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('10 Jun 2026');
            expect(result.value.rawValue).toBe('2026-06-10T00:00:00Z');
        }
        expect(result.textSummary).toBe('10 Jun 2026');
    });

    it('formats DATE appDataType gracefully for invalid dates', () => {
        const meta = { ...defaultMeta, appDataType: 'DATE' };
        const result = resolveFieldForDisplay('not-a-date', null, meta);

        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('not-a-date');
            expect(result.value.rawValue).toBe('not-a-date');
        }
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
        const metaWithProfile = { ...defaultMeta, profileConfig: { displayMask: ['forenames', 'surname'] } };
        const result = resolveFieldForDisplay(party, null, metaWithProfile);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('party');
        if (result.value.kind === 'party') {
            expect(result.value.summary).toBe('John Doe');
            expect(result.value.data).toEqual(party);
            expect(result.value.displayMask).toEqual(['forenames', 'surname']);
        }
        expect(result.textSummary).toBe('John Doe');
    });

    it('resolves PARTY_REF object', () => {
        const ref = {
            ccPartyId: '12345678-abcd',
        };
        const metaWithProfile = { ...defaultMeta, profileConfig: { displayMask: ['forenames'] } };
        const result = resolveFieldForDisplay(ref, null, metaWithProfile);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('partyRef');
        if (result.value.kind === 'partyRef') {
            expect(result.value.refId).toBe('12345678-abcd');
            expect(result.value.summary).toBe('ID:12345678…');
            expect(result.value.displayMask).toEqual(['forenames']);
        }
        expect(result.textSummary).toBe('ID:12345678…');
    });

    it('resolves array elements with per-item source', () => {
        const rawValue = [
            { value: 'Item 1', sourceType: 'GLEIF', sourceReference: 'REF1' },
            { value: 'Item 2' }
        ];
        const result = resolveFieldForDisplay(rawValue, null, defaultMeta);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            expect(result.value.items[0].source?.type).toBe('GLEIF');
            expect(result.value.items[0].source?.reference).toBe('REF1');
            expect(result.value.items[1].source).toBeUndefined();
        }
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
        const metaWithCodeSystem = { ...defaultMeta, codeSystem: 'TEST_CODES_2026' };
        const result = resolveFieldForDisplay(codes, null, metaWithCodeSystem);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('codeList');
        if (result.value.kind === 'codeList') {
            expect(result.value.codeSystem).toBe('TEST_CODES_2026');
        }
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
            expect(result.source.lastValidatedAt).toBe('2025-01-01T12:00:00.000Z'); // Fallback to timestamp
        }
    });

    it('resolves lastValidatedAt correctly when sourceCheckedAt is provided', () => {
        const rawSource = { 
            type: 'USER_INPUT', 
            timestamp: new Date('2025-01-01T12:00:00Z'),
            sourceCheckedAt: new Date('2025-02-01T15:30:00Z')
        };
        const result = resolveFieldForDisplay('Hello', rawSource, defaultMeta);

        expect(result.source).toBeDefined();
        if (result.source) {
            expect(result.source.timestamp).toBe('2025-01-01T12:00:00.000Z');
            expect(result.source.lastValidatedAt).toBe('2025-02-01T15:30:00.000Z');
        }
    });

    it('resolves structured collection row correctly when fieldNo is registered', () => {
        const rawValue = { 
            name: "CENTRICA (LW) LIMITED", 
            effectiveFrom: "2006-03-03T00:00:00.000Z", 
            effectiveTo: "2009-10-08T00:00:00.000Z" 
        };
        const metaWithFieldNo = { ...defaultMeta, fieldNo: 5 };
        const result = resolveFieldForDisplay(rawValue, null, metaWithFieldNo);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('CENTRICA (LW) LIMITED (3 Mar 2006 → 8 Oct 2009)');
        }
        expect(result.textSummary).toBe('CENTRICA (LW) LIMITED (3 Mar 2006 → 8 Oct 2009)');
    });

    it('resolves Field 20 structured collection row correctly (code + label)', () => {
        const rawValue = { 
            code: "35110",
            label: "Production of electricity"
        };
        const metaWithFieldNo = { ...defaultMeta, fieldNo: 20 };
        const result = resolveFieldForDisplay(rawValue, null, metaWithFieldNo);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('35110 — Production of electricity');
        }
    });

    it('resolves Field 20 structured collection row correctly (code only)', () => {
        const rawValue = { code: "35110" };
        const metaWithFieldNo = { ...defaultMeta, fieldNo: 20 };
        const result = resolveFieldForDisplay(rawValue, null, metaWithFieldNo);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('35110');
        }
    });

    it('resolves Field 20 structured collection row correctly (label only)', () => {
        const rawValue = { label: "Production of electricity" };
        const metaWithFieldNo = { ...defaultMeta, fieldNo: 20 };
        const result = resolveFieldForDisplay(rawValue, null, metaWithFieldNo);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('Production of electricity');
        }
    });


    it('falls back to [Structured value] when fieldNo formatter returns handled: false', () => {
        const rawValue = { 
            unknownKey: "value" 
        };
        const metaWithFieldNo = { ...defaultMeta, fieldNo: 999 }; // Unknown field
        const result = resolveFieldForDisplay(rawValue, null, metaWithFieldNo);

        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('scalar');
        if (result.value.kind === 'scalar') {
            expect(result.value.display).toBe('[Structured value]');
        }
        expect(result.textSummary).toBe('[Structured value]');
    });

    describe('Field 40 / Field 37 GLEIF Ultimate/Direct Parent (Legacy Party fallback)', () => {
        it('resolves Field 40 GLEIF ultimate parent payload correctly', () => {
            const rawValue = {
                lei: "529900L73GEWN1O5NH84",
                legalName: "JAGUAR LAND ROVER AUTOMOTIVE PLC",
                legalFormId: "B6ES",
                registeredAt: "RA000585"
            };
            const meta = { ...defaultMeta, fieldNo: 40, appDataType: 'PARTY' };
            const result = resolveFieldForDisplay(rawValue, null, meta);

            expect(result.state).toBe('POPULATED');
            expect(result.value.kind).toBe('party');
            if (result.value.kind === 'party') {
                expect(result.value.summary).toBe('JAGUAR LAND ROVER AUTOMOTIVE PLC');
                // The normaliser produces sourceIdentifiers, but resolveFieldForDisplay stores the raw payload in .data
            }
            expect(result.textSummary).toBe('JAGUAR LAND ROVER AUTOMOTIVE PLC');
        });

        it('resolves Field 37 direct parent payload similarly', () => {
            const rawValue = {
                lei: "12345678901234567890",
                legalName: "PARENT COMPANY PLC",
            };
            const meta = { ...defaultMeta, fieldNo: 37, appDataType: 'PARTY' };
            const result = resolveFieldForDisplay(rawValue, null, meta);

            expect(result.state).toBe('POPULATED');
            expect(result.value.kind).toBe('party');
            expect(result.textSummary).toBe('PARENT COMPANY PLC');
        });

        it('metadata-driven fallback resolves historical scalar string for Field 37 as kind party', () => {
            const scalarVal = "JAGUAR LAND ROVER AUTOMOTIVE PLC";
            const meta = { ...defaultMeta, fieldNo: 37, appDataType: 'PARTY' };
            const result = resolveFieldForDisplay(scalarVal, null, meta);

            expect(result.state).toBe('POPULATED');
            expect(result.value.kind).toBe('party');
            if (result.value.kind === 'party') {
                expect(result.value.partyLabel).toBe('JAGUAR LAND ROVER AUTOMOTIVE PLC');
            }
        });
    });

    describe('Field 63 (List of company directors) Regression Suite', () => {
        it('REGRESSION: Field 63 PARTY_REF to an Individual remains completely unchanged across interpreter, projection, and export', () => {
            const directorPartyRef = {
                ccPartyId: 'p-123',
                _resolvedData: {
                    ccParty: {
                        data: {
                            partyType: 'INDIVIDUAL',
                            forenames: 'John',
                            surname: 'Smith',
                            roles: [{ roleTitle: 'Director', appointedOn: '2020-01-01' }]
                        }
                    }
                }
            };

            const field63Meta: FieldInterpreterMetadata = {
                fieldNo: 63,
                label: 'List of company directors',
                appDataType: 'PARTY',
                profileConfig: {
                    displayMask: ['forenames', 'surname', 'roles']
                }
            };

            // 1. Interpreter resolution
            const model = resolveFieldForDisplay(directorPartyRef, null, field63Meta);
            expect(model.state).toBe('POPULATED');
            expect(model.value.kind).toBe('partyRef');
            if (model.value.kind === 'partyRef') {
                expect(model.value.summary).toBe('John Smith (Director)');
                expect(model.value.partyLabel).toBe('John Smith');
            }

            // 2. Projection contract (with roles enabled in displayMask)
            const projWithRoles = getPartyDisplayProjection(directorPartyRef, ['forenames', 'surname', 'roles']);
            expect(projWithRoles.primaryText).toBe('John Smith');
            expect(projWithRoles.secondaryParts).toEqual(['Director (Appointed 2020-01-01)']);
            expect(projWithRoles.addressText).toBe('');

            // 3. Projection contract (with roles masked out)
            const projWithoutRoles = getPartyDisplayProjection(directorPartyRef, ['forenames', 'surname']);
            expect(projWithoutRoles.primaryText).toBe('John Smith');
            expect(projWithoutRoles.secondaryParts).toEqual([]);

            // 4. Export text resolution
            const exportText = toExportText({
                state: model.state,
                value: model.value,
                defaultText: model.defaultText,
                profileConfig: field63Meta.profileConfig
            });
            expect(exportText).toBe('John Smith\nDirector (Appointed 2020-01-01)');
        });
    });
});
