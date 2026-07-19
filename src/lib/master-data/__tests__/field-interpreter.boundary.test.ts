import { describe, it, expect } from 'vitest';
import { resolveFieldCollectionForDisplay } from '../field-interpreter';

describe('Legacy Field 62/63 Interpreter Boundary Tests', () => {
    it('should correctly interpret a legacy PERSON shape and extract the partyLabel', () => {
        const legacyPerson = {
            "address": {
                "city": "London",
                "line1": "160 City Road",
                "country": "England",
                "postalCode": "EC1V 2NX"
            },
            "lastName": "Fan",
            "firstName": "Mr Mingzhou",
            "dateOfBirth": "1978-06-01T00:00:00.000Z",
            "metadata_type": "PERSON",
            "primaryNationality": "Chinese"
        };

        const result = resolveFieldCollectionForDisplay(
            [
                {
                    value: legacyPerson,
                    sourceType: 'COMPANIES_HOUSE',
                    sourceReference: 'some-ref',
                    instanceId: 'i-1',
                    isScoped: false
                }
            ],
            {
                fieldNo: 62,
                label: "Person with Significant Control",
                appDataType: "PARTY",
                isMultiValue: true,
                displayState: "HAS_VALUE",
                isEditable: false,
                allowAttachments: false,
                clientLEId: "test-client"
            } as any
        );

        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            const firstItem = result.value.items[0];
            expect(firstItem.value.kind).toBe('party');
            if (firstItem.value.kind === 'party') {
                expect(firstItem.value.partyLabel).toBe('Mr Mingzhou Fan');
                expect(firstItem.value.data.contactType).toBe('PERSON');
                expect(firstItem.value.data.partyType).toBe('INDIVIDUAL');
            }
        }
    });

    it('should correctly interpret a legacy LEGAL_ENTITY shape and extract the partyLabel', () => {
        const legacyOrg = {
            "name": "Uk Green Investment Bank Financial Services Ltd",
            "address": {
                "city": "Edinburgh",
                "line1": "Morrison Street",
                "country": "Scotland",
                "postalCode": "EH3 8EX"
            },
            "legalForm": "Private Limited Company",
            "metadata_type": "LEGAL_ENTITY",
            "registrationNumber": "Sc460459"
        };

        const result = resolveFieldCollectionForDisplay(
            [
                {
                    value: legacyOrg,
                    sourceType: 'COMPANIES_HOUSE',
                    sourceReference: 'some-ref',
                    instanceId: 'i-2',
                    isScoped: false
                }
            ],
            {
                fieldNo: 63,
                label: "Corporate Person with Significant Control",
                appDataType: "PARTY",
                isMultiValue: true,
                displayState: "HAS_VALUE",
                isEditable: false,
                allowAttachments: false,
                clientLEId: "test-client"
            } as any
        );

        expect(result.value.kind).toBe('collection');
        if (result.value.kind === 'collection') {
            const firstItem = result.value.items[0];
            expect(firstItem.value.kind).toBe('party');
            if (firstItem.value.kind === 'party') {
                expect(firstItem.value.partyLabel).toBe('Uk Green Investment Bank Financial Services Ltd');
                expect(firstItem.value.data.contactType).toBe('CONTACT');
                expect(firstItem.value.data.partyType).toBe('ORGANISATION');
            }
        }
    });
});
