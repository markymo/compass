import { describe, it, expect } from 'vitest';
import { isIndividualPartyData, IndividualPartyData } from '../IndividualPartyData';
import { isTeamPartyData, TeamPartyData } from '../TeamPartyData';
import { isOrganisationPartyData, OrganisationPartyData } from '../OrganisationPartyData';
import { isCCPartyData } from '../CCPartyData';

describe('Party v2 Schema Definitions', () => {
    describe('IndividualPartyData', () => {
        it('should correctly identify a valid IndividualPartyData', () => {
            const data: IndividualPartyData = {
                schemaVersion: 2,
                partyType: 'INDIVIDUAL',
                title: 'Dr',
                forenames: 'Alice',
                surname: 'Smith',
                knownAs: 'Alice',
                emails: ['alice@example.com'],
                phones: [],
                homeAddressRef: null,
                nationality: ['GB'],
                placeOfBirth: 'London',
                dateOfBirth: { year: 1980, month: 1, day: 1 },
                roles: [],
                visibility: { scope: 'CLIENT_LE' },
                isActiveParty: true,
                sourceIdentifiers: []
            };

            expect(isIndividualPartyData(data)).toBe(true);
            expect(isCCPartyData(data)).toBe(true);
        });

        it('should reject Individual without formal name (only knownAs)', () => {
            const data: IndividualPartyData = {
                schemaVersion: 2,
                partyType: 'INDIVIDUAL',
                title: null,
                forenames: null,
                surname: null,
                knownAs: 'Alice',
                emails: [],
                phones: [],
                homeAddressRef: null,
                nationality: [],
                placeOfBirth: null,
                dateOfBirth: null,
                roles: [],
                visibility: { scope: 'CLIENT_LE' },
                isActiveParty: true,
                sourceIdentifiers: []
            };

            expect(isIndividualPartyData(data)).toBe(false);
            expect(isCCPartyData(data)).toBe(false);
        });
    });

    describe('TeamPartyData', () => {
        it('should correctly identify a valid TeamPartyData', () => {
            const data: TeamPartyData = {
                schemaVersion: 2,
                partyType: 'TEAM',
                teamName: 'Compliance Team',
                knownAs: 'Compliance',
                location: 'London Office',
                emails: ['compliance@example.com'],
                phones: [{ type: 'LANDLINE', number: '+442071234567' }],
                correspondenceAddressRef: null,
                roles: [],
                visibility: { scope: 'CLIENT_LE' },
                isActiveParty: true,
                sourceIdentifiers: []
            };

            expect(isTeamPartyData(data)).toBe(true);
            expect(isCCPartyData(data)).toBe(true);
        });

        it('should reject Team without teamName', () => {
            const data: any = {
                schemaVersion: 2,
                partyType: 'TEAM',
                teamName: '',
                knownAs: null,
                location: null,
                emails: [],
                phones: [],
                correspondenceAddressRef: null,
                roles: [],
                visibility: { scope: 'CLIENT_LE' },
                isActiveParty: true,
                sourceIdentifiers: []
            };

            expect(isTeamPartyData(data)).toBe(false);
        });
    });

    describe('OrganisationPartyData', () => {
        it('should correctly identify a valid OrganisationPartyData', () => {
            const data: OrganisationPartyData = {
                schemaVersion: 2,
                partyType: 'ORGANISATION',
                legalName: 'Acme Corp Ltd',
                knownAs: 'Acme',
                emails: [],
                phones: [],
                registeredAddressRef: { ccAddressId: 'addr-123' },
                incorporatedIn: 'GB',
                registrationNumber: '12345678',
                governingLaw: 'England and Wales',
                legalForm: 'Private Limited Company',
                roles: [],
                visibility: { scope: 'CLIENT_LE' },
                isActiveParty: true,
                sourceIdentifiers: [{ scheme: 'COMPANIES_HOUSE', value: '12345678' }]
            };

            expect(isOrganisationPartyData(data)).toBe(true);
            expect(isCCPartyData(data)).toBe(true);
        });

        it('should reject Organisation without legalName', () => {
            const data: any = {
                schemaVersion: 2,
                partyType: 'ORGANISATION',
                legalName: '   ',
                knownAs: null,
                emails: [],
                phones: [],
                registeredAddressRef: null,
                incorporatedIn: null,
                registrationNumber: null,
                governingLaw: null,
                legalForm: null,
                roles: [],
                visibility: { scope: 'CLIENT_LE' },
                isActiveParty: true,
                sourceIdentifiers: []
            };

            expect(isOrganisationPartyData(data)).toBe(false);
        });
    });

    describe('Invalid Data', () => {
        it('should reject null or undefined', () => {
            expect(isIndividualPartyData(null)).toBe(false);
            expect(isTeamPartyData(undefined)).toBe(false);
            expect(isOrganisationPartyData(null)).toBe(false);
            expect(isCCPartyData(undefined)).toBe(false);
        });

        it('should reject invalid partyTypes', () => {
            const data: any = { schemaVersion: 2, partyType: 'UNKNOWN_TYPE', emails: [], phones: [], roles: [], sourceIdentifiers: [] };
            expect(isIndividualPartyData(data)).toBe(false);
            expect(isTeamPartyData(data)).toBe(false);
            expect(isOrganisationPartyData(data)).toBe(false);
            expect(isCCPartyData(data)).toBe(false);
        });

        it('should reject invalid schemaVersion', () => {
            const data: any = { schemaVersion: 1, partyType: 'INDIVIDUAL', forenames: 'A', emails: [], phones: [], roles: [], sourceIdentifiers: [] };
            expect(isIndividualPartyData(data)).toBe(false);
            expect(isCCPartyData(data)).toBe(false);
        });
    });
});
