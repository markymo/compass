import { describe, it, expect } from 'vitest';
import { convertLegacyManualPartyToV2 } from '../cc-party-legacy-adapter';

describe('convertLegacyManualPartyToV2', () => {
    it('should map standard fields for an INDIVIDUAL payload', () => {
        const legacyPayload = {
            partyType: 'INDIVIDUAL',
            contactType: 'PERSON',
            title: 'Mr',
            forenames: 'John',
            surname: 'Doe',
            displayName: 'Johnny',
            nationality: ['GB', 'FR'],
            isActivePersonOrContact: true,
            email: 'john@example.com',
            phones: [
                { type: 'MOBILE', number: '123' },
                { type: 'WORK', number: '456' } // mapped to OTHER
            ],
            sourceIdentifiers: [
                { scheme: 'PASSPORT', value: 'P123' }
            ]
        };

        const result = convertLegacyManualPartyToV2(legacyPayload) as any;

        expect(result.schemaVersion).toBe(2);
        expect(result.partyType).toBe('INDIVIDUAL');
        expect(result.title).toBe('Mr');
        expect(result.forenames).toBe('John');
        expect(result.surname).toBe('Doe');
        expect(result.nationality).toEqual(['GB', 'FR']);
        expect(result.isActiveParty).toBe(true);
        expect(result.emails).toEqual(['john@example.com']);
        expect(result.phones).toEqual([
            { type: 'MOBILE', number: '123' },
            { type: 'OTHER', number: '456' }
        ]);
        expect(result.sourceIdentifiers).toEqual([
            { scheme: 'PASSPORT', value: 'P123' }
        ]);
    });

    it('should map standard fields for an ORGANISATION payload', () => {
        const legacyPayload = {
            partyType: 'ORGANISATION',
            organisationName: 'Acme Corp',
            displayName: 'Acme',
            roles: [
                {
                    roleType: 'supplier',
                    roleTitle: 'Key Supplier',
                    isActiveRole: true,
                    company: {
                        name: 'Parent Corp'
                    }
                }
            ]
        };

        const result = convertLegacyManualPartyToV2(legacyPayload) as any;

        expect(result.partyType).toBe('ORGANISATION');
        expect(result.legalName).toBe('Acme Corp');
        expect(result.roles).toHaveLength(1);
        expect(result.roles[0].company.name).toBe('Parent Corp');
        expect(result.roles[0].roleType).toBe('supplier');
    });

    it('should intentionally omit passively round-tripped embedded addresses', () => {
        const legacyPayloadWithAddresses = {
            partyType: 'INDIVIDUAL',
            forenames: 'Jane',
            homeAddress: {
                addressLine1: '123 Fake St'
            },
            correspondenceAddress: {
                addressLine1: 'PO Box 456'
            },
            registeredAddress: {
                addressLine1: '789 Business Rd'
            },
            roles: [
                {
                    roleType: 'director',
                    address: {
                        addressLine1: 'Role Address'
                    },
                    correspondenceAddress: {
                        addressLine1: 'Role Corresp'
                    }
                }
            ]
        };

        const result = convertLegacyManualPartyToV2(legacyPayloadWithAddresses) as any;

        // Verify non-address fields are retained
        expect(result.forenames).toBe('Jane');
        expect(result.partyType).toBe('INDIVIDUAL');
        expect(result.roles).toHaveLength(1);
        expect(result.roles[0].roleType).toBe('director');

        // Verify embedded addresses are explicitly omitted (not present in v2 structure)
        expect(result).not.toHaveProperty('homeAddress');
        expect(result).not.toHaveProperty('correspondenceAddress');
        expect(result).not.toHaveProperty('registeredAddress');
        expect(result.roles[0]).not.toHaveProperty('address');
        expect(result.roles[0]).not.toHaveProperty('correspondenceAddress');

        // Verify no fabricated references were created
        expect(result.homeAddressRef).toBeNull();
        expect(result.roles[0].correspondenceAddressRef).toBeNull();
    });

    it('should map address references ONLY if they are genuine string references', () => {
        const legacyPayloadWithRefs = {
            partyType: 'ORGANISATION',
            registeredAddressRef: 'ref-123', // Genuine string ref
            roles: [
                {
                    roleType: 'director',
                    correspondenceAddressRef: 'ref-456' // Genuine string ref
                }
            ]
        };

        const result = convertLegacyManualPartyToV2(legacyPayloadWithRefs) as any;
        expect(result.registeredAddressRef).toEqual({ ccAddressId: 'ref-123' });
        expect(result.roles[0].correspondenceAddressRef).toEqual({ ccAddressId: 'ref-456' });

        const legacyPayloadEmptyRef = {
            partyType: 'TEAM',
            correspondenceAddressRef: '   ' // empty string
        };

        const result2 = convertLegacyManualPartyToV2(legacyPayloadEmptyRef) as any;
        expect(result2.correspondenceAddressRef).toBeNull();
    });
});
