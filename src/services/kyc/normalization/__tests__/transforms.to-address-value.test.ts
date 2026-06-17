import { describe, it, expect } from 'vitest';
import { applyTransform } from '../transforms';

describe('TO_ADDRESS_VALUE transform', () => {

    it('ADDR-1: Companies House payload with relative paths', () => {
        const payload = {
            address_line_1: 'Flat 3B',
            address_line_2: 'The Old Mill',
            locality: 'London',
            postal_code: 'SW1A 1AA',
            country: 'United Kingdom'
        };

        const config = {
            addressLines: ['address_line_1', 'address_line_2'],
            locality: 'locality',
            region: 'region', // missing in payload
            postalCode: 'postal_code',
            countryCode: 'country'
        };

        const result = applyTransform(payload, 'TO_ADDRESS_VALUE', config);
        
        expect(result.value).toEqual({
            addressLines: ['Flat 3B', 'The Old Mill'],
            locality: 'London',
            region: null,
            postalCode: 'SW1A 1AA',
            countryCode: 'GB',
            countryName: 'United Kingdom',
            rawCountry: 'United Kingdom'
        });
        expect(result.confidencePenalty).toBe(0);
    });

    it('ADDR-2: GLEIF payload with array addressLines and relative paths', () => {
        const payload = {
            addressLines: ['123 Main St', 'Suite 400'],
            city: 'New York',
            region: 'NY',
            postalCode: '10001',
            country: 'US'
        };

        const config = {
            addressLines: ['addressLines'],
            locality: 'city',
            region: 'region',
            postalCode: 'postalCode',
            countryCode: 'country'
        };

        const result = applyTransform(payload, 'TO_ADDRESS_VALUE', config);

        expect(result.value).toEqual({
            addressLines: ['123 Main St', 'Suite 400'],
            locality: 'New York',
            region: 'NY',
            postalCode: '10001',
            countryCode: 'US',
            countryName: 'United States',
            rawCountry: 'US'
        });
        expect(result.confidencePenalty).toBe(0);
    });

    it('ADDR-3: French-style (RCS) payload with nested structure', () => {
        const payload = {
            adresse: {
                voie: '5 Rue de la Paix',
                codePostal: '75002',
                ville: 'Paris',
                pays: 'FR'
            }
        };

        // Paths relative to mapping sourcePath (so if sourcePath is "adresse", value passed to transform is the adresse object)
        const config = {
            addressLines: ['voie'],
            locality: 'ville',
            region: 'non_existent_field',
            postalCode: 'codePostal',
            countryCode: 'pays'
        };

        const result = applyTransform(payload.adresse, 'TO_ADDRESS_VALUE', config);

        expect(result.value).toEqual({
            addressLines: ['5 Rue de la Paix'],
            locality: 'Paris',
            region: null,
            postalCode: '75002',
            countryCode: 'FR',
            countryName: 'France',
            rawCountry: 'FR'
        });
        expect(result.confidencePenalty).toBe(0);
    });

    it('ADDR-4: Handles null/undefined inputs gracefully', () => {
        const result1 = applyTransform(null, 'TO_ADDRESS_VALUE', {});
        expect(result1.value).toBeNull();
        expect(result1.confidencePenalty).toBe(0);

        const result2 = applyTransform(undefined, 'TO_ADDRESS_VALUE', {});
        expect(result2.value).toBeNull();
        expect(result2.confidencePenalty).toBe(0);
    });

    it('ADDR-5: Non-object input degrades with confidence penalty of 1', () => {
        const result = applyTransform('Not an object', 'TO_ADDRESS_VALUE', {});
        expect(result.value).toBeNull();
        expect(result.confidencePenalty).toBe(1);
    });
});
