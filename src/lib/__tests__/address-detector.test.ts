import { describe, it, expect } from 'vitest';
import { detectAddressCandidate, isAddressLikePath, buildRelativeTransformConfig } from '../address-detector';

describe('Address Detector Heuristics', () => {
    describe('isAddressLikePath', () => {
        it('should return true for address-like paths', () => {
            expect(isAddressLikePath('legalAddress')).toBe(true);
            expect(isAddressLikePath('headquartersAddress')).toBe(true);
            expect(isAddressLikePath('registered_office_address')).toBe(true);
            expect(isAddressLikePath('siege')).toBe(true);
            expect(isAddressLikePath('office')).toBe(true);
            expect(isAddressLikePath('location')).toBe(true);
        });

        it('should return false for non-address paths', () => {
            expect(isAddressLikePath('companyName')).toBe(false);
            expect(isAddressLikePath('legalForm')).toBe(false);
            expect(isAddressLikePath('status')).toBe(false);
        });
    });

    describe('detectAddressCandidate', () => {
        it('should identify GLEIF legalAddress / headquartersAddress (High Confidence)', () => {
            const gleifAddress = {
                addressLines: ["123 Main St", "Suite 100"],
                city: "London",
                region: "Greater London",
                postalCode: "EC1A 1BB",
                country: "GB"
            };

            const result = detectAddressCandidate('headquartersAddress', gleifAddress);
            expect(result.isLikelyAddress).toBe(true);
            expect(result.score).toBeGreaterThanOrEqual(12);
            expect(result.confidence).toBe('HIGH');
            expect(result.detectedFields.postalCode).toBe('EC1A 1BB');
            expect(result.detectedFields.locality).toBe('London');
            expect(result.detectedFields.countryCode).toBe('GB');
        });

        it('should identify Companies House registered_office_address (High Confidence)', () => {
            const chAddress = {
                address_line_1: "Line 1",
                address_line_2: "Line 2",
                locality: "Cardiff",
                region: "Glamorgan",
                postal_code: "CF14 3UZ",
                country: "United Kingdom"
            };

            const result = detectAddressCandidate('registered_office_address', chAddress);
            expect(result.isLikelyAddress).toBe(true);
            expect(result.score).toBeGreaterThanOrEqual(12);
            expect(result.confidence).toBe('HIGH');
            expect(result.detectedFields.postalCode).toBe('CF14 3UZ');
            expect(result.detectedFields.locality).toBe('Cardiff');
            expect(result.detectedFields.countryCode).toBe('United Kingdom');
        });

        it('should identify French siege (High/Medium Confidence)', () => {
            const frenchSiege = {
                adresse: "2 Rue de la Paix",
                libelle_commune: "Paris",
                code_postal: "75002",
                country_code: "FR"
            };

            const result = detectAddressCandidate('siege', frenchSiege);
            expect(result.isLikelyAddress).toBe(true);
            expect(result.score).toBe(18); // postal_code: 5 + country: 5 + commune: 4 + adresse: 4 = 18
            expect(result.confidence).toBe('HIGH');
            expect(result.detectedFields.postalCode).toBe('75002');
            expect(result.detectedFields.locality).toBe('Paris');
        });

        it('should rule out false positive containing country/region but not address keys (Low/Medium Confidence, but score penalized)', () => {
            const falsePositive = {
                country: "US",
                region: "CA",
                companyName: "Google LLC",
                industry: "Tech"
            };

            const result = detectAddressCandidate('companyInfo', falsePositive);
            // score: country: 5 + region: 3 = 8.
            // Since it lacks postalCode, locality, or addressLines, it gets a -3 penalty -> score becomes 5.
            expect(result.isLikelyAddress).toBe(false);
            expect(result.score).toBe(5);
            expect(result.confidence).toBe('LOW');
        });

        it('should mark borderline cases as medium confidence, requiring AI checking', () => {
            // Borderline case: has locality and region, but lacks country and postal code
            const borderlineAddress = {
                locality: "Birmingham",
                region: "West Midlands"
            };

            const result = detectAddressCandidate('office', borderlineAddress);
            // score: locality: 4 + region: 3 = 7. No penalty because it has locality.
            expect(result.isLikelyAddress).toBe(false);
            expect(result.score).toBe(7);
            expect(result.confidence).toBe('MEDIUM');
        });
    });

    describe('buildRelativeTransformConfig', () => {

        it('should build relative config for Companies House style flat object', () => {
            const nodeValue = {
                address_line_1: 'Flat 3B',
                address_line_2: 'The Old Mill',
                locality: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB'
            };
            const detectedFields = {
                addressLines: ['Flat 3B', 'The Old Mill'],
                locality: 'London',
                postalCode: 'SW1A 1AA',
                countryCode: 'GB'
            };

            const config = buildRelativeTransformConfig(nodeValue, detectedFields);
            expect(config).toEqual({
                addressLines: ['address_line_1', 'address_line_2'],
                locality: 'locality',
                region: null,
                postalCode: 'postal_code',
                countryCode: 'country'
            });
        });

        it('should build relative config for GLEIF style object with array', () => {
            const nodeValue = {
                addressLines: ['123 Main St', 'Suite 100'],
                city: 'London',
                region: 'Greater London',
                postalCode: 'EC1A 1BB',
                country: 'GB'
            };
            const detectedFields = {
                addressLines: ['123 Main St', 'Suite 100'],
                locality: 'London',
                region: 'Greater London',
                postalCode: 'EC1A 1BB',
                countryCode: 'GB'
            };

            const config = buildRelativeTransformConfig(nodeValue, detectedFields);
            expect(config).toEqual({
                addressLines: ['addressLines'],
                locality: 'city',
                region: 'region',
                postalCode: 'postalCode',
                countryCode: 'country'
            });
        });

        it('should fallback to name matching if values are not matched', () => {
            const nodeValue = {
                address_line_1: 'Different Value',
                locality: 'Different Locality',
                postal_code: 'Different Postal',
                country: 'Different Country'
            };
            const detectedFields = {};

            const config = buildRelativeTransformConfig(nodeValue, detectedFields);
            expect(config).toEqual({
                addressLines: ['address_line_1'],
                locality: 'locality',
                region: null,
                postalCode: 'postal_code',
                countryCode: 'country'
            });
        });
    });
});
