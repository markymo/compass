import { describe, it, expect } from 'vitest';
import { normaliseCCPartyData } from '../normaliser';

describe('normaliseCCPartyData', () => {
    it('should return null for malformed inputs', () => {
        expect(normaliseCCPartyData(null)).toBeNull();
        expect(normaliseCCPartyData(undefined)).toBeNull();
        expect(normaliseCCPartyData(123)).toBeNull();
        expect(normaliseCCPartyData('string')).toBeNull();
        expect(normaliseCCPartyData([])).toBeNull();
    });

    it('should pass through valid V2 objects without mutation', () => {
        const v2Data = {
            schemaVersion: 2,
            partyType: 'TEAM',
            teamName: 'Engineering',
            knownAs: null,
            emails: ['eng@example.com'],
            phones: [],
            roles: [],
            sourceIdentifiers: [],
            isActiveParty: true,
            location: null,
            correspondenceAddressRef: null
        };

        const result = normaliseCCPartyData(v2Data);
        expect(result).not.toBeNull();
        expect(result!.generation).toBe('V2');
        expect(result!.party).toEqual(v2Data);
        expect(result!.legacy).toEqual({});
        expect(result!.diagnostics).toHaveLength(0);
        
        // Ensure not mutated (by reference check since we clone)
        expect(result!.party).not.toBe(v2Data);
    });

    it('should reject invalid legacy inputs that cannot form a valid party', () => {
        const legacyInvalid = {
            contactType: 'PERSON',
            title: 'Mr',
            knownAs: 'Bob' // 'knownAs' alone does not form a formal identity in legacy adapter
        };

        const result = normaliseCCPartyData(legacyInvalid);
        expect(result).toBeNull();
    });

    it('should adapt legacy Individual and retain legacy address', () => {
        const legacyIndividual = {
            contactType: 'PERSON',
            forenames: 'John',
            surname: 'Doe',
            email: 'john.doe@example.com',
            phones: [{ type: 'MOBILE', number: '12345' }],
            correspondenceAddress: {
                addressLine1: '123 Fake St'
            },
            isActiveParty: false
        };

        const result = normaliseCCPartyData(legacyIndividual);
        expect(result).not.toBeNull();
        expect(result!.generation).toBe('LEGACY');
        expect(result!.party.partyType).toBe('INDIVIDUAL');
        expect(result!.party.schemaVersion).toBe(2);
        
        // Should convert email to emails[]
        expect(result!.party.emails).toEqual(['john.doe@example.com']);
        expect(result!.party.phones).toHaveLength(1);
        
        // Legacy address retained in legacy block
        expect(result!.legacy.embeddedCorrespondenceAddress).toEqual({ addressLine1: '123 Fake St' });
        
        // Ensure no fake ccAddressId was created
        expect((result!.party as any).homeAddressRef).toBeNull();
        
        // Check diagnostics
        const codes = result!.diagnostics.map(d => d.code);
        expect(codes).toContain('EMAIL_CONVERTED_TO_ARRAY');
        expect(codes).toContain('LEGACY_ADDRESS_RETAINED');
        expect(codes).toContain('INFERRED_PARTY_TYPE');
    });

    it('should adapt legacy Organisation from displayName', () => {
        const legacyOrg = {
            contactType: 'CONTACT',
            partyType: 'ORGANISATION',
            displayName: 'Acme Corp',
            email: 'info@acme.com'
        };

        const result = normaliseCCPartyData(legacyOrg);
        expect(result).not.toBeNull();
        expect(result!.generation).toBe('LEGACY');
        expect(result!.party.partyType).toBe('ORGANISATION');
        expect((result!.party as any).legalName).toBe('Acme Corp');
    });

    it('should adapt legacy Team from displayName', () => {
        const legacyTeam = {
            partyType: 'TEAM',
            displayName: 'Sales Team'
        };

        const result = normaliseCCPartyData(legacyTeam);
        expect(result).not.toBeNull();
        expect(result!.generation).toBe('LEGACY');
        expect(result!.party.partyType).toBe('TEAM');
        expect((result!.party as any).teamName).toBe('Sales Team');
    });

    it('should reject legacy object if adequate formal name is missing', () => {
        const legacyMissingName = {
            contactType: 'PERSON',
            email: 'test@test.com'
        };

        const result = normaliseCCPartyData(legacyMissingName);
        expect(result).toBeNull();
    });

    it('should extract altFirstName / altLastName if forenames/surname missing', () => {
        const legacyAlt = {
            contactType: 'PERSON',
            firstName: 'Alice',
            lastName: 'Wonderland'
        };

        const result = normaliseCCPartyData(legacyAlt);
        expect(result).not.toBeNull();
        expect((result!.party as any).forenames).toBe('Alice');
        expect((result!.party as any).surname).toBe('Wonderland');
    });
});
