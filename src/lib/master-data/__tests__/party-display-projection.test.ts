import { describe, it, expect } from 'vitest';
import { getPartyDisplayProjection, PartyValue, getIdentityVerificationLabel } from '../party-value';
import { formatPersonOrContactRow } from '../structured-value-formatters';

describe('getPartyDisplayProjection', () => {
    it('handles absent mask (treats as all permitted like UI)', () => {
        const value: PartyValue = {
            partyType: 'INDIVIDUAL',
            forenames: 'John',
            surname: 'Doe',
            roles: [{ roleTitle: 'Director', appointedOn: '2020-01-01' }],
            dateOfBirth: { year: 1980, month: 5, day: null },
            email: 'john@example.com',
            correspondenceAddress: { addressLines: ['123 Main St'] }
        };

        const proj = getPartyDisplayProjection(value, undefined);
        expect(proj.primaryText).toBe('John Doe');
        expect(proj.secondaryParts).toEqual([
            'Director (Appointed 2020-01-01)',
            'DOB: May 1980',
            'john@example.com'
        ]);
        expect(proj.addressText).toBe('123 Main St');
    });

    it('handles explicit mask filtering out DOB and Address', () => {
        const value: PartyValue = {
            partyType: 'INDIVIDUAL',
            forenames: 'John',
            surname: 'Doe',
            roles: [{ roleTitle: 'Director' }],
            dateOfBirth: { year: 1980, month: 5, day: null },
            correspondenceAddress: { addressLines: ['123 Main St'] }
        };

        // Only allow names and roles
        const mask = ['forenames', 'surname', 'roles'];
        const proj = getPartyDisplayProjection(value, mask);
        
        expect(proj.primaryText).toBe('John Doe');
        expect(proj.secondaryParts).toEqual(['Director']);
        expect(proj.addressText).toBe(''); // Filtered out by mask
    });

    it('handles empty mask gracefully', () => {
        const value: PartyValue = {
            partyType: 'INDIVIDUAL',
            forenames: 'John',
            surname: 'Doe',
            roles: [{ roleTitle: 'Director' }],
        };

        const proj = getPartyDisplayProjection(value, []);
        expect(proj.primaryText).toBe('John Doe');
        expect(proj.secondaryParts).toEqual([]);
    });

    it('resolves embedded PARTY correctly', () => {
        const value: PartyValue = {
            partyType: 'ORGANISATION',
            organisationName: 'Acme Corp',
            roles: [{ roleType: 'PSC' }]
        };

        const proj = getPartyDisplayProjection(value);
        expect(proj.primaryText).toBe('Acme Corp');
        expect(proj.secondaryParts).toEqual(['PSC']);
    });

    it('resolves enriched PARTY_REF correctly', () => {
        // Enriched PARTY_REF structure
        const value = {
            ccPartyId: 'p-123',
            _resolvedData: {
                ccParty: {
                    data: {
                        partyType: 'INDIVIDUAL',
                        displayName: 'Ref Party Name',
                        email: 'ref@example.com'
                    }
                }
            }
        };

        const proj = getPartyDisplayProjection(value);
        expect(proj.primaryText).toBe('Ref Party Name');
        expect(proj.secondaryParts).toEqual(['ref@example.com']);
    });

    it('uses multiple roles by selecting the first one (current /master behaviour)', () => {
        const value: PartyValue = {
            partyType: 'INDIVIDUAL',
            forenames: 'Jane',
            roles: [
                { roleTitle: 'First Role' },
                { roleTitle: 'Second Role' }
            ]
        };

        const proj = getPartyDisplayProjection(value);
        expect(proj.secondaryParts).toEqual(['First Role']); // Second role is ignored per current UI logic
    });
    
    it('uses partyLabel as defensive fallback when canonical model has no displayable name', () => {
        const value = {
            partyType: 'UNKNOWN'
            // No name fields
        };
        const proj = getPartyDisplayProjection(value, undefined, 'Fallback Name');
        expect(proj.primaryText).toBe('Fallback Name');
    });

    it('projects canonical Organisation details (incorporation jurisdiction, registration number, LEI) with restrained default mask', () => {
        const orgPartyData = {
            schemaVersion: 2,
            partyType: 'ORGANISATION',
            legalName: 'JAGUAR LAND ROVER AUTOMOTIVE PLC',
            incorporatedIn: 'GB',
            registrationNumber: '06477691',
            legalForm: 'B6ES',
            sourceIdentifiers: [{ scheme: 'LEI', value: '529900L73GEWN1O5NH84' }]
        };

        const mask = ['organisation.legalName', 'organisation.registrationNumber', 'organisation.incorporatedIn', 'organisation.lei'];
        const proj = getPartyDisplayProjection(orgPartyData, mask);

        expect(proj.primaryText).toBe('JAGUAR LAND ROVER AUTOMOTIVE PLC');
        expect(proj.secondaryParts).toEqual([
            'Inc: GB',
            'Reg: 06477691',
            'LEI: 529900L73GEWN1O5NH84'
        ]);
        // Form: B6ES is omitted because organisation.legalForm is not in default mask
        expect(proj.secondaryParts).not.toContain('Form: B6ES');
    });

    it('includes legalForm in projection when organisation.legalForm is explicitly in mask', () => {
        const orgPartyData = {
            schemaVersion: 2,
            partyType: 'ORGANISATION',
            legalName: 'JAGUAR LAND ROVER AUTOMOTIVE PLC',
            incorporatedIn: 'GB',
            registrationNumber: '06477691',
            legalForm: 'B6ES',
            sourceIdentifiers: [{ scheme: 'LEI', value: '529900L73GEWN1O5NH84' }]
        };

        const mask = ['organisation.legalName', 'organisation.registrationNumber', 'organisation.incorporatedIn', 'organisation.lei', 'organisation.legalForm'];
        const proj = getPartyDisplayProjection(orgPartyData, mask);

        expect(proj.secondaryParts).toContain('Form: B6ES');
    });
});

describe('getIdentityVerificationLabel central semantics', () => {
    it('returns "Identity verified" for explicit identityVerifiedOn', () => {
        const label = getIdentityVerificationLabel({ identityVerifiedOn: '2026-01-15' });
        expect(label).toBe('Identity verified');
    });

    it('returns "Identity verified" for Chirmorie shape (start_on + 9999-12-31 end_on)', () => {
        const label = getIdentityVerificationLabel({
            appointmentVerificationStartOn: '2026-02-18',
            appointmentVerificationEndOn: '9999-12-31'
        });
        expect(label).toBe('Identity verified');
    });

    it('returns "Identity verified" for active start date without end date', () => {
        const label = getIdentityVerificationLabel({
            appointmentVerificationStartOn: '2026-02-18'
        });
        expect(label).toBe('Identity verified');
    });

    it('returns "Identity verified" for active start date with future end date', () => {
        const label = getIdentityVerificationLabel({
            appointmentVerificationStartOn: '2026-02-18',
            appointmentVerificationEndOn: '2099-12-31'
        });
        expect(label).toBe('Identity verified');
    });

    it('does NOT report verified for expired verification period', () => {
        const label = getIdentityVerificationLabel({
            appointmentVerificationStartOn: '2020-01-01',
            appointmentVerificationEndOn: '2021-01-01'
        });
        expect(label).toBeNull();
    });

    it('returns "Identity verification due [date]" for statement_due_on with no active statement', () => {
        const label = getIdentityVerificationLabel({
            appointmentVerificationStatementDueOn: '2026-08-26'
        });
        expect(label).toBe('Identity verification due 26 Aug 2026');
    });

    it('returns null for null, undefined, or empty verification details', () => {
        expect(getIdentityVerificationLabel(null)).toBeNull();
        expect(getIdentityVerificationLabel(undefined)).toBeNull();
        expect(getIdentityVerificationLabel({})).toBeNull();
    });
});

describe('Integration: identity verification display in projections & formatters', () => {
    it('includes identity verification label in getPartyDisplayProjection', () => {
        const party: PartyValue = {
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'Anna Louise',
            surname: 'Abraham',
            title: null,
            email: null,
            phones: [],
            nationality: ['British'],
            countryOfResidence: 'United Kingdom',
            dateOfBirth: null,
            placeOfBirth: null,
            roles: [{
                roleTitle: 'director',
                roleType: 'director',
                company: { onProCompanyId: null, externalId: null, externalIdScheme: null, name: null },
                isActiveRole: true,
                appointedOn: '2026-02-16',
                resignedOn: null,
                natureOfControl: [],
                identityVerification: {
                    appointmentVerificationStartOn: '2026-02-18',
                    appointmentVerificationEndOn: '9999-12-31'
                }
            }],
            sourceIdentifiers: [],
            isActiveParty: null,
            isActivePersonOrContact: null,
            visibility: { scope: 'CLIENT_LE' }
        };

        const proj = getPartyDisplayProjection(party);
        expect(proj.primaryText).toBe('Anna Louise Abraham');
        expect(proj.secondaryParts).toContain('Identity verified');
    });

    it('includes identity verification label in formatPersonOrContactRow', () => {
        const party: PartyValue = {
            contactType: 'PERSON',
            partyType: 'INDIVIDUAL',
            forenames: 'David Charles',
            surname: 'Murray',
            title: null,
            email: null,
            phones: [],
            nationality: ['British'],
            countryOfResidence: 'United Kingdom',
            dateOfBirth: null,
            placeOfBirth: null,
            roles: [{
                roleTitle: 'director',
                roleType: 'director',
                company: { onProCompanyId: null, externalId: null, externalIdScheme: null, name: null },
                isActiveRole: false,
                appointedOn: '2014-08-12',
                resignedOn: '2026-02-16',
                natureOfControl: [],
                identityVerification: {
                    appointmentVerificationStatementDueOn: '2026-08-26'
                }
            }],
            sourceIdentifiers: [],
            isActiveParty: null,
            isActivePersonOrContact: null,
            visibility: { scope: 'CLIENT_LE' }
        };

        const res = formatPersonOrContactRow(party);
        expect(res.handled).toBe(true);
        expect(res.primary).toBe('David Charles Murray');
        expect(res.secondary).toBe('director (12 Aug 2014 → 16 Feb 2026) · Identity verification due 26 Aug 2026');
    });
});
