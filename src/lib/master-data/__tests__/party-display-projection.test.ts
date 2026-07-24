import { describe, it, expect } from 'vitest';
import { getPartyDisplayProjection, PartyValue } from '../party-value';

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
        // Empty mask normally means all unmasked in UI semantics, 
        // wait, isFieldPermittedByMask treats empty array as true for all fields.
        expect(proj.primaryText).toBe('John Doe');
        expect(proj.secondaryParts).toEqual(['Director']);
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
