import { describe, it, expect } from 'vitest';
import { getExpectedDataTypeLabel } from '../field-type-resolver';

describe('getExpectedDataTypeLabel', () => {
    it('handles scalar plain text, number, date, boolean', () => {
        expect(getExpectedDataTypeLabel({ appDataType: 'TEXT' })).toBe('Text');
        expect(getExpectedDataTypeLabel({ appDataType: 'NUMBER' })).toBe('Number');
        expect(getExpectedDataTypeLabel({ appDataType: 'DATE' })).toBe('Date');
        expect(getExpectedDataTypeLabel({ appDataType: 'DATETIME' })).toBe('Date');
        expect(getExpectedDataTypeLabel({ appDataType: 'BOOLEAN' })).toBe('Yes / No');
    });

    it('handles multi-value scalar fields', () => {
        expect(getExpectedDataTypeLabel({ appDataType: 'TEXT', isMultiValue: true })).toBe('Text list');
        expect(getExpectedDataTypeLabel({ appDataType: 'NUMBER', isRepeating: true })).toBe('Number list');
        expect(getExpectedDataTypeLabel({ appDataType: 'DATE', isMultiValue: true })).toBe('Date list');
        expect(getExpectedDataTypeLabel({ appDataType: 'BOOLEAN', isMultiValue: true })).toBe('Yes / No list');
    });

    it('handles single choice and multiple choice fields', () => {
        expect(getExpectedDataTypeLabel({ appDataType: 'ENUM', options: ['A', 'B'] })).toBe('Single choice');
        expect(getExpectedDataTypeLabel({ appDataType: 'TEXT', options: ['A', 'B'], isMultiValue: false })).toBe('Single choice');
        expect(getExpectedDataTypeLabel({ appDataType: 'TEXT', options: ['A', 'B'], isMultiValue: true })).toBe('Multiple choice');
        expect(getExpectedDataTypeLabel({ appDataType: 'TEXT', codeSystem: 'SIC_2007_UK', isMultiValue: true })).toBe('Multiple choice');
    });

    describe('PARTY & PARTY_REF allowedPartyTypes combinations', () => {
        it('handles single-type restrictions (INDIVIDUAL, ORGANISATION, TEAM)', () => {
            // Individual only
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL'] }
            })).toBe('Person');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                isMultiValue: true,
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL'] }
            })).toBe('Person collection');

            // Organisation only
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY',
                profileConfig: { allowedPartyTypes: ['ORGANISATION'] }
            })).toBe('Organisation');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY',
                isRepeating: true,
                profileConfig: { allowedPartyTypes: ['ORGANISATION'] }
            })).toBe('Organisation collection');

            // Team only
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                profileConfig: { allowedPartyTypes: ['TEAM'] }
            })).toBe('Team');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                isMultiValue: true,
                profileConfig: { allowedPartyTypes: ['TEAM'] }
            })).toBe('Team collection');
        });

        it('handles two-type combinations', () => {
            // Individual + Organisation
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL', 'ORGANISATION'] }
            })).toBe('Person or organisation');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                isMultiValue: true,
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL', 'ORGANISATION'] }
            })).toBe('Person or organisation collection');

            // Individual + Team
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL', 'TEAM'] }
            })).toBe('Person or team');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                isMultiValue: true,
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL', 'TEAM'] }
            })).toBe('Person or team collection');

            // Organisation + Team
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                profileConfig: { allowedPartyTypes: ['ORGANISATION', 'TEAM'] }
            })).toBe('Organisation or team');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                isMultiValue: true,
                profileConfig: { allowedPartyTypes: ['ORGANISATION', 'TEAM'] }
            })).toBe('Organisation or team collection');
        });

        it('handles three-type and unrestricted/default party behaviour', () => {
            // Explicit 3-type allowed
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL', 'ORGANISATION', 'TEAM'] }
            })).toBe('Person, organisation or team');
            expect(getExpectedDataTypeLabel({
                appDataType: 'PARTY_REF',
                isMultiValue: true,
                profileConfig: { allowedPartyTypes: ['INDIVIDUAL', 'ORGANISATION', 'TEAM'] }
            })).toBe('Person, organisation or team collection');

            // Omitted / undefined profileConfig.allowedPartyTypes
            expect(getExpectedDataTypeLabel({ appDataType: 'PARTY_REF' })).toBe('Person, organisation or team');
            expect(getExpectedDataTypeLabel({ appDataType: 'PARTY_REF', isMultiValue: true })).toBe('Person, organisation or team collection');
            expect(getExpectedDataTypeLabel({ appDataType: 'PARTY', profileConfig: {} })).toBe('Person, organisation or team');
        });
    });

    it('handles PERSON_REF and ORG_REF specific types', () => {
        expect(getExpectedDataTypeLabel({ appDataType: 'PERSON_REF' })).toBe('Person');
        expect(getExpectedDataTypeLabel({ appDataType: 'PERSON_REF', isMultiValue: true })).toBe('Person collection');
        expect(getExpectedDataTypeLabel({ appDataType: 'ORG_REF' })).toBe('Organisation');
        expect(getExpectedDataTypeLabel({ appDataType: 'ORG_REF', isMultiValue: true })).toBe('Organisation collection');
    });

    it('handles ADDRESS, DOCUMENT, and structured types', () => {
        expect(getExpectedDataTypeLabel({ appDataType: 'ADDRESS_REF' })).toBe('Address');
        expect(getExpectedDataTypeLabel({ appDataType: 'ADDRESS_REF', isMultiValue: true })).toBe('Address collection');
        expect(getExpectedDataTypeLabel({ appDataType: 'DOCUMENT_REF' })).toBe('Document');
        expect(getExpectedDataTypeLabel({ appDataType: 'DOCUMENT_REF', isMultiValue: true })).toBe('Document collection');
        expect(getExpectedDataTypeLabel({ appDataType: 'STRUCTURED_COLLECTION', isMultiValue: true })).toBe('Structured collection');
        expect(getExpectedDataTypeLabel({ appDataType: 'COMPOSITE' })).toBe('Structured group');
    });
});
