/**
 * Schemas.test.ts
 * 
 * Unit tests for module schemas (IdentityProfile, Stakeholder, AuthorizedTrader).
 */

import { describe, it, expect } from 'vitest';
import { IdentityProfileDataSchema } from '../schemas/IdentityProfileSchema';
import { StakeholderDataSchema } from '../schemas/StakeholderSchema';
import { AuthorizedTraderDataSchema } from '../schemas/AuthorizedTraderSchema';
import { DocumentRegistrySchema } from '../schemas/DocumentRegistrySchema';

describe('Module Schemas', () => {
    describe('IdentityProfileDataSchema', () => {
        it('should validate valid identity profile data', () => {
            const validData = {
                legalName: 'Test Company Ltd',
                leiCode: '12345678901234567890',
                regAddressCountry: 'GB',
            };

            const result = IdentityProfileDataSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should allow partial data (draft-safe)', () => {
            const partialData = {
                legalName: 'Test Company Ltd',
            };

            const result = IdentityProfileDataSchema.safeParse(partialData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid LEI length', () => {
            const invalidData = {
                leiCode: '123', // Too short
            };

            const result = IdentityProfileDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid country code length', () => {
            const invalidData = {
                regAddressCountry: 'GBR', // Should be 2-letter ISO code
            };

            const result = IdentityProfileDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('StakeholderDataSchema', () => {
        it('should validate individual stakeholder', () => {
            const individualData = {
                stakeholderType: 'INDIVIDUAL' as const,
                role: 'DIRECTOR' as const,
                fullName: 'John Doe',
                dateOfBirth: new Date('1980-01-01').toISOString(),
                nationalities: ['GB', 'US'],
            };

            const result = StakeholderDataSchema.safeParse(individualData);
            expect(result.success).toBe(true);
        });

        it('should validate corporate stakeholder', () => {
            const corporateData = {
                stakeholderType: 'CORPORATE' as const,
                role: 'UBO' as const,
                legalName: 'Parent Company Ltd',
                leiCode: '12345678901234567890',
            };

            const result = StakeholderDataSchema.safeParse(corporateData);
            expect(result.success).toBe(true);
        });

        it('should reject individual without individual fields', () => {
            const invalidData = {
                stakeholderType: 'INDIVIDUAL' as const,
                role: 'DIRECTOR' as const,
                legalName: 'Should not be here',
            };

            const result = StakeholderDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject corporate without corporate fields', () => {
            const invalidData = {
                stakeholderType: 'CORPORATE' as const,
                role: 'UBO' as const,
                fullName: 'Should not be here',
            };

            const result = StakeholderDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate nationalities as ISO country codes', () => {
            const validData = {
                stakeholderType: 'INDIVIDUAL' as const,
                role: 'DIRECTOR' as const,
                fullName: 'John Doe',
                nationalities: ['GB', 'US', 'FR'],
            };

            const result = StakeholderDataSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid nationality codes', () => {
            const invalidData = {
                stakeholderType: 'INDIVIDUAL' as const,
                role: 'DIRECTOR' as const,
                fullName: 'John Doe',
                nationalities: ['GBR'], // Should be 2-letter
            };

            const result = StakeholderDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('AuthorizedTraderDataSchema', () => {
        it('should validate trader with document authority', () => {
            const validData = {
                fullName: 'Jane Trader',
                email: 'jane@example.com',
                phone: '+44 20 1234 5678',
                authorityDocumentId: '123e4567-e89b-12d3-a456-426614174000',
            };

            const result = AuthorizedTraderDataSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate trader with attestation authority', () => {
            const validData = {
                fullName: 'Jane Trader',
                email: 'jane@example.com',
                authorityAttestationText: 'I hereby confirm trading authority...',
            };

            const result = AuthorizedTraderDataSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject trader without any authority proof (Field 100)', () => {
            const invalidData = {
                fullName: 'Jane Trader',
                email: 'jane@example.com',
                // Missing both authorityDocumentId and authorityAttestationText
            };

            const result = AuthorizedTraderDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.message).toContain('Field 100');
            }
        });

        it('should reject invalid email', () => {
            const invalidData = {
                fullName: 'Jane Trader',
                email: 'not-an-email',
                authorityDocumentId: '123e4567-e89b-12d3-a456-426614174000',
            };

            const result = AuthorizedTraderDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate products array', () => {
            const validData = {
                fullName: 'Jane Trader',
                email: 'jane@example.com',
                products: ['FX', 'Interest Rate Swaps', 'Commodities'],
                authorityDocumentId: '123e4567-e89b-12d3-a456-426614174000',
            };

            const result = AuthorizedTraderDataSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
    });

    describe('DocumentRegistrySchema', () => {
        it('should validate valid document registry entry', () => {
            const validData = {
                legalEntityId: '123e4567-e89b-12d3-a456-426614174000',
                ownerType: 'LEGAL_ENTITY' as const,
                ownerId: '123e4567-e89b-12d3-a456-426614174001',
                fieldNo: 56,
                filePath: 's3://bucket/path/to/file.pdf',
                fileName: 'constitutional_docs.pdf',
                mimeType: 'application/pdf',
                uploadedBy: '123e4567-e89b-12d3-a456-426614174002',
            };

            const result = DocumentRegistrySchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid owner type', () => {
            const invalidData = {
                legalEntityId: '123e4567-e89b-12d3-a456-426614174000',
                ownerType: 'INVALID_TYPE',
                ownerId: '123e4567-e89b-12d3-a456-426614174001',
                fieldNo: 56,
                filePath: 's3://bucket/path/to/file.pdf',
                fileName: 'file.pdf',
                mimeType: 'application/pdf',
                uploadedBy: '123e4567-e89b-12d3-a456-426614174002',
            };

            const result = DocumentRegistrySchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUIDs', () => {
            const invalidData = {
                legalEntityId: 'not-a-uuid',
                ownerType: 'LEGAL_ENTITY' as const,
                ownerId: '123e4567-e89b-12d3-a456-426614174001',
                fieldNo: 56,
                filePath: 's3://bucket/path/to/file.pdf',
                fileName: 'file.pdf',
                mimeType: 'application/pdf',
                uploadedBy: '123e4567-e89b-12d3-a456-426614174002',
            };

            const result = DocumentRegistrySchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid field_no', () => {
            const invalidData = {
                legalEntityId: '123e4567-e89b-12d3-a456-426614174000',
                ownerType: 'LEGAL_ENTITY' as const,
                ownerId: '123e4567-e89b-12d3-a456-426614174001',
                fieldNo: -1,
                filePath: 's3://bucket/path/to/file.pdf',
                fileName: 'file.pdf',
                mimeType: 'application/pdf',
                uploadedBy: '123e4567-e89b-12d3-a456-426614174002',
            };

            const result = DocumentRegistrySchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });
});
