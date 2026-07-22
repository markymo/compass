import { describe, it, expect } from 'vitest';
import { getPartySummary, isFieldPermittedByMask, PartyValue } from '../party-value';

describe('isFieldPermittedByMask', () => {
    it('returns true if mask is empty', () => {
        expect(isFieldPermittedByMask('forenames', [])).toBe(true);
        expect(isFieldPermittedByMask('forenames', undefined)).toBe(true);
    });

    it('returns true for exact matches', () => {
        expect(isFieldPermittedByMask('forenames', ['forenames', 'surname'])).toBe(true);
    });

    it('returns false for absent matches', () => {
        expect(isFieldPermittedByMask('organisationName', ['forenames', 'surname'])).toBe(false);
    });

    it('allows children if parent is masked', () => {
        expect(isFieldPermittedByMask('roles[0].isActiveRole', ['roles'])).toBe(true);
    });

    it('allows parent container if child is masked', () => {
        expect(isFieldPermittedByMask('roles', ['roles[0].isActiveRole'])).toBe(true);
        expect(isFieldPermittedByMask('roles.0', ['roles[0].isActiveRole'])).toBe(true);
    });

    it('handles generic array wildcards', () => {
        expect(isFieldPermittedByMask('roles.0.roleTitle', ['roles.roleTitle'])).toBe(true);
        expect(isFieldPermittedByMask('roles[1].roleTitle', ['roles.roleTitle'])).toBe(true);
        // Canonical roleTitle mask permits roleTitle across array indices and generic paths
        expect(isFieldPermittedByMask('roles.roleTitle', ['roles[0].roleTitle'])).toBe(true);
    });
});

describe('getPartySummary', () => {
    const baseParty: any = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        roles: []
    };

    it('renders organisationName rather than CONTACT when permitted', () => {
        const org: any = {
            ...baseParty,
            contactType: 'CONTACT',
            partyType: 'ORGANISATION',
            organisationName: 'Basalt Infrastructure Partners'
        };
        // Permitted
        expect(getPartySummary(org, ['organisationName'])).toBe('Basalt Infrastructure Partners');
        // Unmasked
        expect(getPartySummary(org)).toBe('Basalt Infrastructure Partners');
    });

    it('falls back gracefully if organisationName is explicitly masked out', () => {
        const org: any = {
            ...baseParty,
            contactType: 'CONTACT',
            partyType: 'ORGANISATION',
            organisationName: 'Basalt Infrastructure Partners'
        };
        // Masked out
        expect(getPartySummary(org, ['roles'])).toBe('');
    });

    it('renders person name correctly', () => {
        const person: any = {
            ...baseParty,
            forenames: 'Julian Matthew',
            surname: 'Smith',
            title: 'Dr'
        };
        expect(getPartySummary(person)).toBe('Dr Julian Matthew Smith');
        expect(getPartySummary(person, ['forenames', 'surname'])).toBe('Julian Matthew Smith');
        expect(getPartySummary(person, ['surname'])).toBe('Smith');
    });

    it('uses displayName when permitted', () => {
        const org: any = {
            ...baseParty,
            partyType: 'ORGANISATION',
            organisationName: 'Legal Name',
            displayName: 'Trading Name'
        };
        expect(getPartySummary(org, ['displayName'])).toBe('Trading Name');
        expect(getPartySummary(org, ['organisationName'])).toBe('Legal Name');
        // Unmasked should prefer displayName
        expect(getPartySummary(org)).toBe('Trading Name');
    });

    it('does not include excluded properties in summary', () => {
        const person: any = {
            ...baseParty,
            forenames: 'Julian',
            surname: 'Smith',
            roles: [{ roleTitle: 'Director', isActiveRole: true }]
        };
        // Exclude roles
        expect(getPartySummary(person, ['forenames', 'surname'])).toBe('Julian Smith');
        // Include roles
        expect(getPartySummary(person, ['forenames', 'surname', 'roles'])).toBe('Julian Smith (Director)');
    });

    it('handles repeating roles correctly', () => {
        const person: any = {
            ...baseParty,
            forenames: 'Julian',
            surname: 'Smith',
            roles: [
                { roleTitle: 'Director', isActiveRole: false },
                { roleTitle: 'Shareholder', isActiveRole: true }
            ]
        };
        expect(getPartySummary(person)).toBe('Julian Smith (Shareholder)');
        
        // If we mask out roles completely
        expect(getPartySummary(person, ['forenames', 'surname'])).toBe('Julian Smith');

        // Canonical roleTitle mask permits active role title regardless of array index representation
        expect(getPartySummary(person, ['forenames', 'surname', 'roles[1].roleTitle'])).toBe('Julian Smith (Shareholder)');
        expect(getPartySummary(person, ['forenames', 'surname', 'roles.roleTitle'])).toBe('Julian Smith (Shareholder)');
        expect(getPartySummary(person, ['forenames', 'surname', 'roles[0].roleTitle'])).toBe('Julian Smith (Shareholder)');
    });

    it('does not use raw internal discriminators as fallback', () => {
        const raw: any = {
            contactType: 'CONTACT',
            partyType: 'ORGANISATION'
        };
        expect(getPartySummary(raw)).toBe('');
    });
});
