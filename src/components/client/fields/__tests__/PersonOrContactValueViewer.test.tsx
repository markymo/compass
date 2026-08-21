import { describe, it, expect } from 'vitest';
import { PersonOrContactValueViewer } from '../PersonOrContactValueViewer';
import { PartyValue } from '@/lib/master-data/party-value';

describe('PersonOrContactValueViewer Mutation Safety', () => {
    it('does not mutate the underlying PartyValue when applying a display mask', () => {
        const fullPartyValue: PartyValue = {
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'John',
            surname: 'Doe',
            dateOfBirth: { year: 1980, month: 1, day: 1 },
            roles: [
                {
                    roleTitle: 'Director',
                    roleType: 'director',
                    company: { onProCompanyId: null, externalId: null, name: 'Test Corp' },
                    appointedOn: '2020-01-01',
                    resignedOn: null,
                    isActiveRole: true,
                    natureOfControl: []
                }
            ],
            sourceIdentifiers: [],
            phones: [],
            nationality: [],
            countryOfResidence: null,
            placeOfBirth: null,
            title: null,
            email: null,
            isActiveParty: true,
            isActivePersonOrContact: true,
            visibility: { scope: 'CLIENT_LE' }
        };

        // Create a strict clone to verify no mutation occurs
        const originalClone = JSON.parse(JSON.stringify(fullPartyValue));

        // Call the component function directly (pure JS execution)
        const result = PersonOrContactValueViewer({
            value: fullPartyValue, 
            layout: "detailed", 
            displayMask: ['forenames', 'surname']
        });

        // Verify NO MUTATION occurred to the passed object
        expect(fullPartyValue).toEqual(originalClone);

        // Optional: Ensure the function executed successfully and returned JSX
        expect(result).toBeDefined();
    });
});

import { renderToStaticMarkup } from 'react-dom/server';

describe('PersonOrContactValueViewer correspondenceAddress rendering', () => {
    const partyWithAddress: PartyValue = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        forenames: 'John',
        surname: 'Doe',
        correspondenceAddress: {
            addressLines: ["10", "Street Name"],
            locality: "London",
            postalCode: "SW1A 1AA",
            rawCountry: "England"
        },
        roles: [],
        sourceIdentifiers: [],
        phones: [],
        nationality: [],
        countryOfResidence: null,
        placeOfBirth: null,
        title: null,
        email: null,
        isActiveParty: true,
        isActivePersonOrContact: true,
        visibility: { scope: 'CLIENT_LE' }
    };

    it('renders correspondenceAddress when included in displayMask (detailed)', () => {
        const result = PersonOrContactValueViewer({
            value: partyWithAddress,
            layout: "detailed",
            displayMask: ['forenames', 'surname', 'correspondenceAddress']
        });
        
        const html = renderToStaticMarkup(result as any);
        // Assert output is formatted address string, not raw JSON
        expect(html).toContain('10, Street Name, London, SW1A 1AA, England');
        expect(html).not.toContain('"premises":'); // Not raw JSON
    });

    it('does not render correspondenceAddress when not in displayMask (detailed)', () => {
        const result = PersonOrContactValueViewer({
            value: partyWithAddress,
            layout: "detailed",
            displayMask: ['forenames', 'surname']
        });
        
        const html = renderToStaticMarkup(result as any);
        expect(html).not.toContain('10, Street Name, London, SW1A 1AA, England');
    });
    
    it('renders correspondenceAddress when included in displayMask (row)', () => {
        const result = PersonOrContactValueViewer({
            value: partyWithAddress,
            layout: "row",
            displayMask: ['forenames', 'surname', 'correspondenceAddress']
        });
        
        const html = renderToStaticMarkup(result as any);
        expect(html).toContain('10, Street Name, London, SW1A 1AA, England');
    });

    it('does not render correspondenceAddress when not in displayMask (row)', () => {
        const result = PersonOrContactValueViewer({
            value: partyWithAddress,
            layout: "row",
            displayMask: ['forenames', 'surname']
        });
        
        const html = renderToStaticMarkup(result as any);
        expect(html).not.toContain('10, Street Name, London, SW1A 1AA, England');
    });
});

describe('PersonOrContactValueViewer F64 PSC row layout truncation safety', () => {
    const pscParty: PartyValue = {
        contactType: 'ORGANISATION',
        partyType: 'LEGAL_ENTITY',
        name: 'International Holdco Limited',
        roles: [
            {
                roleTitle: 'corporate-entity-person-with-significant-control',
                roleType: 'PSC',
                appointedOn: '2026-04-30',
                resignedOn: null,
                isActiveRole: true,
                natureOfControl: [
                    'ownership-of-shares-75-to-100-percent',
                    'voting-rights-75-to-100-percent'
                ]
            }
        ],
        sourceIdentifiers: [],
        phones: [],
        nationality: [],
        countryOfResidence: null,
        placeOfBirth: null,
        title: null,
        email: null,
        isActiveParty: true,
        isActivePersonOrContact: true,
        visibility: { scope: 'CLIENT_LE' }
    };

    it('renders secondaryParts in row layout with whitespace-normal break-words without truncate CSS class', () => {
        const result = PersonOrContactValueViewer({
            value: pscParty,
            layout: 'row'
        });

        const html = renderToStaticMarkup(result as any);
        expect(html).toContain('International Holdco Limited');
        expect(html).toContain('Ownership of shares — 75% or more');
        expect(html).toContain('Ownership of voting rights — 75% or more');
        expect(html).toContain('whitespace-normal break-words');
        expect(html).not.toContain('truncate mt-0.5');
    });
});

describe('PersonOrContactValueViewer Field 104 hideStatusBadge scoping', () => {
    const activePerson: PartyValue = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        forenames: 'Christopher David',
        surname: 'Marsh',
        roles: [],
        sourceIdentifiers: [],
        phones: [],
        nationality: [],
        countryOfResidence: null,
        placeOfBirth: null,
        title: null,
        email: null,
        isActiveParty: true,
        isActivePersonOrContact: true,
        visibility: { scope: 'CLIENT_LE' }
    };

    it('suppresses Active / Inactive status badge when hideStatusBadge is true in detailed layout', () => {
        const result = PersonOrContactValueViewer({
            value: activePerson,
            layout: 'detailed',
            hideStatusBadge: true
        });

        const html = renderToStaticMarkup(result as any);
        expect(html).toContain('Christopher David');
        expect(html).toContain('Marsh');
        expect(html).not.toContain('Active');
        expect(html).not.toContain('Inactive');
    });

    it('renders Active status badge when hideStatusBadge is false or omitted in detailed layout', () => {
        const result = PersonOrContactValueViewer({
            value: activePerson,
            layout: 'detailed',
            hideStatusBadge: false
        });

        const html = renderToStaticMarkup(result as any);
        expect(html).toContain('Christopher David');
        expect(html).toContain('Marsh');
        expect(html).toContain('Active');
    });
});


