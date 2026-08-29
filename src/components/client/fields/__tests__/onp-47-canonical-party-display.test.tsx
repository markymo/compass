import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PersonOrContactValueViewer } from '../PersonOrContactValueViewer';
import { resolveFieldForDisplay } from '@/lib/master-data/field-interpreter';
import { getPartyDisplayProjection, PartyValue } from '@/lib/master-data/party-value';
import { toExportText } from '@/lib/export/toExportText';

// Contract: PARTY-01 — Canonical party display exposes all saved party data
// Linear: ONP-47

describe('PARTY-01 / ONP-47 — Canonical Party Display Exposes All Saved Party Data', () => {

    const fullyEditedParty: PartyValue = {
        contactType: 'PERSON',
        partyType: 'INDIVIDUAL',
        displayName: 'Dr Eleanor Jane Vance',
        title: 'Dr',
        forenames: 'Eleanor Jane',
        surname: 'Vance',
        email: 'eleanor.vance@hillhouse.example',
        phones: [
            { type: 'MOBILE', number: '+44 7700 900123' },
            { type: 'LANDLINE', number: '+44 20 7946 0999' }
        ],
        nationality: ['British', 'Irish'],
        countryOfResidence: 'United Kingdom',
        placeOfBirth: 'Edinburgh',
        dateOfBirth: { year: 1980, month: 4, day: 15 },
        correspondenceAddress: {
            line1: '42 Hillcrest Avenue',
            city: 'Bath',
            postalCode: 'BA1 1AA',
            country: 'GB'
        },
        roles: [
            {
                roleType: 'DIRECTOR',
                roleTitle: 'Managing Director',
                appointedOn: '2018-03-15',
                resignedOn: null,
                isActiveRole: true,
                identityVerification: 'IDENTITY_VERIFIED'
            }
        ],
        sourceIdentifiers: [
            { scheme: 'PASSPORT', value: 'GB987654321' }
        ],
        isActiveParty: true,
        isActivePersonOrContact: true,
        visibility: { scope: 'CLIENT_LE' }
    };

    it('1. Detailed read-only layout renders all edited fields without edit mode (Email, Phones, Nationality, Country, Address, Roles, Identifiers)', () => {
        const html = renderToString(
            <PersonOrContactValueViewer
                value={fullyEditedParty}
                layout="detailed"
            />
        );

        // Name breakdown
        expect(html).toContain('Eleanor Jane Vance');
        expect(html).toContain('Eleanor Jane');
        expect(html).toContain('Vance');

        // Contact info
        expect(html).toContain('eleanor.vance@hillhouse.example');
        expect(html).toContain('+44 7700 900123');
        expect(html).toContain('+44 20 7946 0999');

        // Individual attributes
        expect(html).toContain('British, Irish');
        expect(html).toContain('United Kingdom');
        expect(html).toContain('Edinburgh');
        expect(html).toContain('15 April 1980');
        expect(html).toContain('BA1 1AA');

        // Roles & status
        expect(html).toContain('Managing Director');
        expect(html).toContain('Appointed 2018-03-15');

        // Source identifiers
        expect(html).toContain('PASSPORT');
        expect(html).toContain('GB987654321');
    });

    it('2. Row layout projects primary name, secondary attributes (roles, email, DOB), and correspondence address', () => {
        const html = renderToString(
            <PersonOrContactValueViewer
                value={fullyEditedParty}
                layout="row"
            />
        );

        expect(html).toContain('Eleanor Jane Vance');
        expect(html).toContain('Managing Director (Appointed 2018-03-15)');
        expect(html).toContain('eleanor.vance@hillhouse.example');
        expect(html).toContain('BA1 1AA');
    });

    it('3. getPartyDisplayProjection projects name, roles, email, DOB and address for canonical downstream use', () => {
        const proj = getPartyDisplayProjection(fullyEditedParty);
        expect(proj.primaryText).toBe('Eleanor Jane Vance');
        expect(proj.secondaryParts).toContain('Managing Director (Appointed 2018-03-15)');
        expect(proj.secondaryParts).toContain('eleanor.vance@hillhouse.example');
        expect(proj.addressText).toBe('BA1 1AA');
    });

    it('4. Master Record field resolution (resolveFieldForDisplay) correctly wraps and provides canonical model for edited party', () => {
        const metadata = {
            fieldNo: 104,
            label: 'Key Contact Person',
            appDataType: 'PARTY',
            isMultiValue: false
        };

        const resolved = resolveFieldForDisplay(fullyEditedParty, null, metadata);
        expect(resolved.state).toBe('POPULATED');
        expect(resolved.value.kind).toBe('party');
        if (resolved.value.kind === 'party') {
            expect(resolved.value.partyLabel).toBe('Eleanor Jane Vance');
            expect(resolved.value.data.email).toBe('eleanor.vance@hillhouse.example');
            expect(resolved.value.data.phones).toHaveLength(2);
            expect(resolved.value.data.correspondenceAddress?.postalCode).toBe('BA1 1AA');
        }
    });

    it('5. Downstream text export (toExportText) includes the canonical party information', () => {
        const metadata = {
            fieldNo: 104,
            label: 'Key Contact Person',
            appDataType: 'PARTY',
            isMultiValue: false
        };

        const resolved = resolveFieldForDisplay(fullyEditedParty, null, metadata);
        const exportText = toExportText(resolved);
        expect(exportText).toContain('Eleanor Jane Vance');
        expect(exportText).toContain('eleanor.vance@hillhouse.example');
    });
});
