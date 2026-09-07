import { describe, it, expect } from 'vitest';
import {
    isFieldPermittedByMask,
    buildPartyFieldProjection,
    getPartyDisplayProjection,
    isPartyValue,
    type PartyValue
} from '../party-value';

// Contract: PARTY-05 — Selected party fields/mappings are honoured
// Linear: ONP-48

describe('PARTY-05 / ONP-48 — Party Selected Fields & Display Mask Invariants', () => {
    const sampleParty: PartyValue = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        title: 'Dr',
        forenames: 'Eleanor',
        surname: 'Vance',
        displayName: 'Dr Eleanor Vance',
        nationality: ['British'],
        countryOfResidence: 'United Kingdom',
        dateOfBirth: { year: 1980, month: 5, day: 12 },
        roles: [
            {
                roleType: 'DIRECTOR',
                roleTitle: 'Managing Director',
                appointedOn: '2020-01-15',
                isActiveRole: true
            }
        ]
    };

    it('1. isFieldPermittedByMask correctly filters fields based on explicit mask', () => {
        const mask = ['individual.title', 'individual.forenames', 'individual.surname', 'individual.nationality'];

        expect(isFieldPermittedByMask('individual.title', mask)).toBe(true);
        expect(isFieldPermittedByMask('individual.surname', mask)).toBe(true);
        expect(isFieldPermittedByMask('individual.nationality', mask)).toBe(true);
        expect(isFieldPermittedByMask('individual.countryOfResidence', mask)).toBe(false);
        expect(isFieldPermittedByMask('individual.dateOfBirth', mask)).toBe(false);
    });

    it('2. buildPartyFieldProjection honours displayMask by excluding unselected fields', () => {
        const mask = ['individual.forenames', 'individual.surname', 'roles'];
        const projected = buildPartyFieldProjection(sampleParty, mask);

        expect(projected.forenames).toBe('Eleanor');
        expect(projected.surname).toBe('Vance');
        expect(projected.roles).toHaveLength(1);
        // Excluded by mask:
        expect(projected.title).toBeNull();
        expect(projected.nationality).toEqual([]);
        expect(projected.dateOfBirth).toBeNull();
        expect(projected.countryOfResidence).toBeNull();
    });

    it('3. buildPartyFieldProjection preserves all fields when no mask is provided', () => {
        const projected = buildPartyFieldProjection(sampleParty, undefined);

        expect(projected.title).toBe('Dr');
        expect(projected.forenames).toBe('Eleanor');
        expect(projected.surname).toBe('Vance');
        expect(projected.nationality).toEqual(['British']);
        expect(projected.dateOfBirth).toEqual({ year: 1980, month: 5, day: 12 });
        expect(projected.roles).toHaveLength(1);
    });

    it('4. getPartyDisplayProjection returns primary and secondary display parts according to mask', () => {
        const displayProj = getPartyDisplayProjection(sampleParty, undefined);

        expect(displayProj.primaryText).toContain('Eleanor Vance');
        expect(displayProj.secondaryParts.some(p => p.includes('British') || p.includes('Managing Director'))).toBe(true);
    });

    it('5. isPartyValue validates party data structures accurately', () => {
        expect(isPartyValue(sampleParty)).toBe(true);
        expect(isPartyValue({ text: 'Not a party' })).toBe(false);
        expect(isPartyValue(null)).toBe(false);
    });

    it('6. Unmapped / null / empty party value produces no fabricated party projection', () => {
        const nullDisplay = getPartyDisplayProjection(null, undefined);
        expect(nullDisplay.primaryText).toBe('');
        expect(nullDisplay.secondaryParts).toEqual([]);

        const nonPartyDisplay = getPartyDisplayProjection({ someOtherField: 'random' } as any, undefined);
        expect(nonPartyDisplay.primaryText).toBe('');
        expect(nonPartyDisplay.secondaryParts).toEqual([]);
    });
});
