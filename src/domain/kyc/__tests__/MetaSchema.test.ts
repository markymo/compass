/**
 * MetaSchema.test.ts
 * 
 * Unit tests for meta validation logic.
 */

import { describe, it, expect } from 'vitest';
import {
    MetaEntrySchema,
    MetaSchema,
    validateMetaForFields,
    createMetaEntry,
} from '../schemas/MetaSchema';
import { FIELD_DEFINITIONS } from '../FieldDefinitions';

describe('MetaSchema', () => {
    describe('MetaEntrySchema', () => {
        it('should validate valid meta entry', () => {
            const validEntry = {
                field_no: 3,
                source: 'GLEIF' as const,
                timestamp: new Date().toISOString(),
            };

            const result = MetaEntrySchema.safeParse(validEntry);
            expect(result.success).toBe(true);
        });

        it('should reject invalid field_no', () => {
            const invalidEntry = {
                field_no: -1,
                source: 'GLEIF' as const,
                timestamp: new Date().toISOString(),
            };

            const result = MetaEntrySchema.safeParse(invalidEntry);
            expect(result.success).toBe(false);
        });

        it('should reject invalid source', () => {
            const invalidEntry = {
                field_no: 3,
                source: 'INVALID_SOURCE',
                timestamp: new Date().toISOString(),
            };

            const result = MetaEntrySchema.safeParse(invalidEntry);
            expect(result.success).toBe(false);
        });

        it('should validate optional fields', () => {
            const entryWithOptionals = {
                field_no: 3,
                source: 'USER_INPUT' as const,
                timestamp: new Date().toISOString(),
                evidence_id: '123e4567-e89b-12d3-a456-426614174000',
                confidence: 0.95,
                verified_by: '123e4567-e89b-12d3-a456-426614174001',
            };

            const result = MetaEntrySchema.safeParse(entryWithOptionals);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID for evidence_id', () => {
            const invalidEntry = {
                field_no: 3,
                source: 'GLEIF' as const,
                timestamp: new Date().toISOString(),
                evidence_id: 'not-a-uuid',
            };

            const result = MetaEntrySchema.safeParse(invalidEntry);
            expect(result.success).toBe(false);
        });

        it('should reject confidence outside 0-1 range', () => {
            const invalidEntry = {
                field_no: 3,
                source: 'GLEIF' as const,
                timestamp: new Date().toISOString(),
                confidence: 1.5,
            };

            const result = MetaEntrySchema.safeParse(invalidEntry);
            expect(result.success).toBe(false);
        });
    });

    describe('MetaSchema', () => {
        it('should validate valid meta object', () => {
            const validMeta = {
                legalName: {
                    field_no: 3,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
                leiCode: {
                    field_no: 2,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
            };

            const result = MetaSchema.safeParse(validMeta);
            expect(result.success).toBe(true);
        });

        it('should reject meta with invalid entries', () => {
            const invalidMeta = {
                legalName: {
                    field_no: -1,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
            };

            const result = MetaSchema.safeParse(invalidMeta);
            expect(result.success).toBe(false);
        });
    });

    describe('validateMetaForFields', () => {
        it('should pass when all populated fields have meta entries', () => {
            const data = {
                legalName: 'Test Company Ltd',
                leiCode: '12345678901234567890',
            };

            const meta = {
                legalName: {
                    field_no: 3,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
                leiCode: {
                    field_no: 2,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
            };

            const errors = validateMetaForFields(meta, data, 'IdentityProfile', FIELD_DEFINITIONS);
            expect(errors).toEqual([]);
        });

        it('should fail when populated field is missing meta entry', () => {
            const data = {
                legalName: 'Test Company Ltd',
                leiCode: '12345678901234567890',
            };

            const meta = {
                legalName: {
                    field_no: 3,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
                // Missing leiCode meta entry
            };

            const errors = validateMetaForFields(meta, data, 'IdentityProfile', FIELD_DEFINITIONS);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].field).toBe('leiCode');
            expect(errors[0].message).toContain('missing meta entry');
        });

        it('should fail when field_no does not match definition', () => {
            const data = {
                legalName: 'Test Company Ltd',
            };

            const meta = {
                legalName: {
                    field_no: 999, // Wrong field_no
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
            };

            const errors = validateMetaForFields(meta, data, 'IdentityProfile', FIELD_DEFINITIONS);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].field).toBe('legalName');
            expect(errors[0].message).toContain('incorrect field_no');
            expect(errors[0].expectedFieldNo).toBe(3);
        });

        it('should ignore unpopulated fields (null/undefined)', () => {
            const data = {
                legalName: 'Test Company Ltd',
                leiCode: null,
                entityStatus: undefined,
            };

            const meta = {
                legalName: {
                    field_no: 3,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
                // No meta for leiCode or entityStatus (they are null/undefined)
            };

            const errors = validateMetaForFields(meta, data, 'IdentityProfile', FIELD_DEFINITIONS);
            expect(errors).toEqual([]);
        });

        it('should be model-scoped (only validate fields for that model)', () => {
            const data = {
                legalName: 'Test Company Ltd',
            };

            const meta = {
                legalName: {
                    field_no: 3,
                    source: 'GLEIF' as const,
                    timestamp: new Date().toISOString(),
                },
            };

            // Validate against IdentityProfile (legalName is Field 3)
            const errors1 = validateMetaForFields(meta, data, 'IdentityProfile', FIELD_DEFINITIONS);
            expect(errors1).toEqual([]);

            // Validate against Stakeholder (legalName is Field 69)
            const errors2 = validateMetaForFields(meta, data, 'Stakeholder', FIELD_DEFINITIONS);
            expect(errors2.length).toBeGreaterThan(0);
            expect(errors2[0].expectedFieldNo).toBe(69);
        });

        it('should handle invalid meta structure', () => {
            const data = {
                legalName: 'Test Company Ltd',
            };

            const invalidMeta = 'not an object';

            const errors = validateMetaForFields(invalidMeta, data, 'IdentityProfile', FIELD_DEFINITIONS);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].field).toBe('_meta');
            expect(errors[0].message).toContain('Invalid meta structure');
        });
    });

    describe('createMetaEntry', () => {
        it('should create valid meta entry', () => {
            const entry = createMetaEntry(3, 'GLEIF');

            expect(entry.field_no).toBe(3);
            expect(entry.source).toBe('GLEIF');
            expect(entry.timestamp).toBeDefined();
            expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
        });

        it('should include optional fields', () => {
            const evidenceId = '123e4567-e89b-12d3-a456-426614174000';
            const userId = '123e4567-e89b-12d3-a456-426614174001';

            const entry = createMetaEntry(3, 'USER_INPUT', {
                evidence_id: evidenceId,
                verified_by: userId,
                confidence: 0.9,
            });

            expect(entry.evidence_id).toBe(evidenceId);
            expect(entry.verified_by).toBe(userId);
            expect(entry.confidence).toBe(0.9);
        });
    });
});
