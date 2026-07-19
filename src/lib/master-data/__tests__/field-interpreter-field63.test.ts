import { describe, it, expect } from 'vitest';
import { resolveFieldCollectionForDisplay, CollectionItemEnvelope } from '../field-interpreter';

describe('Field 63 canonical collection interpretation', () => {
    const meta = {
        fieldNo: 63,
        label: 'Current Directors',
        displayState: 'POPULATED' as const,
        appDataType: 'PARTY',
        isMultiValue: true
    };

    it('renders embedded source PARTY values correctly', () => {
        const envelopes: CollectionItemEnvelope[] = [
            {
                value: { firstName: 'Jane', lastName: 'Doe', roles: [{ roleTitle: 'Director', roleType: 'DIRECTOR' }] },
                source: { type: 'REGISTRATION_AUTHORITY', reference: 'RA000585' }
            }
        ];

        const result = resolveFieldCollectionForDisplay(envelopes, meta);
        
        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            const item = result.value.items[0];
            expect(item.value.kind).toBe('party');
            if (item.value.kind === 'party') {
                expect(item.value.partyLabel).toBe('Jane Doe');
            }
            expect(item.source?.type).toBe('REGISTRATION_AUTHORITY');
        }
    });

    it('renders manual PARTY_REF values correctly', () => {
        const envelopes: CollectionItemEnvelope[] = [
            {
                value: { 
                    ccPartyId: '1234',
                    _resolvedData: {
                        ccParty: {
                            data: {
                                partyType: 'INDIVIDUAL',
                                forenames: 'John',
                                surname: 'Smith'
                            }
                        }
                    }
                },
                source: { type: 'USER_INPUT' }
            }
        ];

        const result = resolveFieldCollectionForDisplay(envelopes, meta);
        
        expect(result.state).toBe('POPULATED');
        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            const item = result.value.items[0];
            expect(item.value.kind).toBe('partyRef');
            if (item.value.kind === 'partyRef') {
                expect(item.value.partyLabel).toBe('John Smith');
            }
        }
    });

    it('produces "Multiple sources" for mixed provenance and preserves per-row provenance', () => {
        const envelopes: CollectionItemEnvelope[] = [
            {
                value: { firstName: 'Alice', lastName: 'Alpha' },
                source: { type: 'REGISTRATION_AUTHORITY', reference: 'RA000585' }
            },
            {
                value: { firstName: 'Bob', lastName: 'Beta' },
                source: { type: 'GLEIF' }
            }
        ];

        const result = resolveFieldCollectionForDisplay(envelopes, meta);
        
        // Field summary provenance should be MULTI_SOURCE
        expect(result.source?.type).toBe('MULTI_SOURCE');

        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            expect(result.value.items).toHaveLength(2);
            // Per-row provenance is preserved
            expect(result.value.items[0].source?.type).toBe('REGISTRATION_AUTHORITY');
            expect(result.value.items[1].source?.type).toBe('GLEIF');

            // No Party rows are merged or suppressed
            if (result.value.items[0].value.kind === 'party') {
                expect(result.value.items[0].value.partyLabel).toBe('Alice Alpha');
            }
            if (result.value.items[1].value.kind === 'party') {
                expect(result.value.items[1].value.partyLabel).toBe('Bob Beta');
            }
        }
    });
});
