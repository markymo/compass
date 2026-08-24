import { describe, it, expect } from 'vitest';
import { isFieldPermittedByCatalogue } from '../party-display-catalogue';
import { buildPartyFieldProjection, getPartySummary, getPartyDisplayProjection } from '../party-value';
import { parseAnyValue } from '../field-interpreter';

describe('Party Display Mask & Server-Side Field Projection', () => {

    const sampleIndividual = {
        id: 'party-ind-1',
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        title: 'Dr',
        forenames: 'Jane',
        surname: 'Smith',
        email: 'jane.smith@example.com',
        phones: [{ type: 'MOBILE', number: '+447700900000' }],
        dateOfBirth: { year: 1985, month: 6, day: 15 },
        nationality: ['GB'],
        countryOfResidence: 'GB',
        placeOfBirth: 'London',
        correspondenceAddress: '10 Downing Street, London',
        roles: [{ roleTitle: 'Director', roleType: 'DIRECTOR', appointedOn: '2020-01-01' }]
    };

    const sampleOrganisation = {
        id: 'party-org-1',
        contactType: 'CONTACT',
        partyType: 'ORGANISATION',
        legalName: 'Acme Global Ltd',
        organisationName: 'Acme Global Ltd',
        email: 'info@acmeglobal.com',
        registrationNumber: '12345678',
        incorporatedIn: 'GB',
        lei: '984500F7A3E2D1C0B987'
    };

    const sampleTeam = {
        id: 'party-team-1',
        contactType: 'CONTACT',
        partyType: 'TEAM',
        teamName: 'Compliance Alpha Team',
        email: 'compliance@acmeglobal.com'
    };

    describe('1. Mask Permission Semantics (undefined vs [] vs explicit)', () => {
        it('treats undefined mask as unrestricted (ALLOW ALL)', () => {
            expect(isFieldPermittedByCatalogue('forenames', undefined)).toBe(true);
            expect(isFieldPermittedByCatalogue('dateOfBirth.year', undefined)).toBe(true);
            expect(isFieldPermittedByCatalogue('party.documents', undefined)).toBe(true);
        });

        it('treats explicitly [] mask as minimum identity only (DENY ALL optional fields)', () => {
            expect(isFieldPermittedByCatalogue('forenames', [])).toBe(false);
            expect(isFieldPermittedByCatalogue('surname', [])).toBe(false);
            expect(isFieldPermittedByCatalogue('email', [])).toBe(false);
            expect(isFieldPermittedByCatalogue('dateOfBirth.year', [])).toBe(false);
            expect(isFieldPermittedByCatalogue('party.documents', [])).toBe(false);
        });

        it('treats explicit mask as allowing ONLY listed keys', () => {
            const mask = ['contact.email', 'party.documents'];
            expect(isFieldPermittedByCatalogue('email', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('party.documents', mask)).toBe(true);
            expect(isFieldPermittedByCatalogue('forenames', mask)).toBe(false);
            expect(isFieldPermittedByCatalogue('dateOfBirth.year', mask)).toBe(false);
        });
    });

    describe('2. Minimum Party Identity Invariance', () => {
        it('preserves Individual display label with displayMask: [] while redacting optional attributes', () => {
            const projected = buildPartyFieldProjection(sampleIndividual, []);
            expect(projected.displayName).toBe('Jane Smith');
            expect(projected.forenames).toBeNull();
            expect(projected.surname).toBeNull();
            expect(projected.title).toBeNull();
            expect(projected.email).toBeNull();
            expect(projected.dateOfBirth).toBeNull();
            expect(projected.correspondenceAddress).toBeNull();
            expect(projected.roles).toEqual([]);
        });

        it('preserves Organisation display label with displayMask: [] while redacting details', () => {
            const projected = buildPartyFieldProjection(sampleOrganisation, []);
            expect(projected.displayName).toBe('Acme Global Ltd');
            expect(projected.legalName).toBeUndefined();
            expect(projected.registrationNumber).toBeUndefined();
            expect(projected.email).toBeNull();
        });

        it('preserves Team display label with displayMask: [] while redacting email', () => {
            const projected = buildPartyFieldProjection(sampleTeam, []);
            expect(projected.displayName).toBe('Compliance Alpha Team');
            expect(projected.email).toBeNull();
        });
    });

    describe('3. party.documents Mask Capability', () => {
        it('permits party.documents when mask is undefined', () => {
            expect(isFieldPermittedByCatalogue('party.documents', undefined)).toBe(true);
        });

        it('denies party.documents when mask is []', () => {
            expect(isFieldPermittedByCatalogue('party.documents', [])).toBe(false);
        });

        it('denies party.documents when mask is explicit without party.documents', () => {
            expect(isFieldPermittedByCatalogue('party.documents', ['individual.forenames', 'contact.email'])).toBe(false);
        });

        it('permits party.documents when explicitly listed in mask', () => {
            expect(isFieldPermittedByCatalogue('party.documents', ['individual.forenames', 'party.documents'])).toBe(true);
        });
    });

    describe('4. Server-Side Redaction (parseAnyValue)', () => {
        it('returns projected party object with unpermitted fields redacted over the wire', () => {
            const mask = ['individual.forenames', 'individual.surname', 'contact.email'];
            const res = parseAnyValue(sampleIndividual, mask, undefined, 'PARTY');

            expect(res.kind).toBe('party');
            if (res.kind === 'party') {
                expect(res.partyLabel).toBe('Jane Smith');
                expect(res.data.forenames).toBe('Jane');
                expect(res.data.surname).toBe('Smith');
                expect(res.data.email).toBe('jane.smith@example.com');

                // PII fields redacted
                expect(res.data.dateOfBirth).toBeNull();
                expect(res.data.correspondenceAddress).toBeNull();
                expect(res.data.nationality).toEqual([]);
                expect(res.data.roles).toEqual([]);
            }
        });
    });

    describe('5. Collections Projection', () => {
        it('projects each element in a collection Party field consistently', () => {
            const mask = ['contact.email'];
            const list = [sampleIndividual, sampleOrganisation];
            const projectedList = list.map(item => buildPartyFieldProjection(item, mask));

            expect(projectedList[0].displayName).toBe('Jane Smith');
            expect(projectedList[0].email).toBe('jane.smith@example.com');
            expect(projectedList[0].dateOfBirth).toBeNull();

            expect(projectedList[1].displayName).toBe('Acme Global Ltd');
            expect(projectedList[1].email).toBe('info@acmeglobal.com');
            expect(projectedList[1].registrationNumber).toBeUndefined();
        });
    });
});
