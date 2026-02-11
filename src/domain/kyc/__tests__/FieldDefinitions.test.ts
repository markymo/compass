/**
 * FieldDefinitions.test.ts
 * 
 * Unit tests for FieldDefinitions mapping and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
    FIELD_DEFINITIONS,
    getFieldDefinition,
    getFieldsByModel,
    isDocumentOnlyField,
    getFieldNosByModel,
    isValidFieldNo,
} from '../FieldDefinitions';

describe('FieldDefinitions', () => {
    describe('Coverage', () => {
        it('should cover all Field Nos 1-119 excluding 94', () => {
            const expectedFieldNos = Array.from({ length: 119 }, (_, i) => i + 1).filter((n) => n !== 94);
            const actualFieldNos = Object.keys(FIELD_DEFINITIONS).map(Number).sort((a, b) => a - b);

            expect(actualFieldNos).toEqual(expectedFieldNos);
            expect(actualFieldNos.length).toBe(118);
        });

        it('should not include Field No 94 (placeholder)', () => {
            expect(FIELD_DEFINITIONS[94]).toBeUndefined();
        });
    });

    describe('getFieldDefinition', () => {
        it('should return definition for valid Field No', () => {
            const def = getFieldDefinition(1);
            expect(def).toBeDefined();
            expect(def.fieldNo).toBe(1);
            expect(def.model).toBe('IdentityProfile');
            expect(def.field).toBe('leiValidationDate');
        });

        it('should throw error for invalid Field No', () => {
            expect(() => getFieldDefinition(999)).toThrow('Unknown Field No: 999');
            expect(() => getFieldDefinition(94)).toThrow('Unknown Field No: 94');
        });

        it('should return correct definition for LEI field', () => {
            const def = getFieldDefinition(2);
            expect(def.fieldName).toBe('LEI');
            expect(def.model).toBe('IdentityProfile');
            expect(def.field).toBe('leiCode');
            expect(def.dataType).toBe('string');
        });
    });

    describe('getFieldsByModel', () => {
        it('should return all fields for IdentityProfile', () => {
            const fields = getFieldsByModel('IdentityProfile');
            expect(fields.length).toBeGreaterThan(0);
            expect(fields.every((f) => f.model === 'IdentityProfile')).toBe(true);
        });

        it('should return all fields for Stakeholder', () => {
            const fields = getFieldsByModel('Stakeholder');
            expect(fields.length).toBeGreaterThan(0);
            expect(fields.every((f) => f.model === 'Stakeholder')).toBe(true);
            expect(fields.some((f) => f.field === 'fullName')).toBe(true);
        });

        it('should return empty array for unknown model', () => {
            const fields = getFieldsByModel('UnknownModel');
            expect(fields).toEqual([]);
        });
    });

    describe('isDocumentOnlyField', () => {
        it('should return true for document-only fields', () => {
            expect(isDocumentOnlyField(56)).toBe(true); // Constitutional docs
            expect(isDocumentOnlyField(60)).toBe(true); // Certificate of incorporation
            expect(isDocumentOnlyField(82)).toBe(true); // W-8BEN-E
            expect(isDocumentOnlyField(84)).toBe(true); // CRS
        });

        it('should return false for data fields', () => {
            expect(isDocumentOnlyField(1)).toBe(false); // LEI validation date
            expect(isDocumentOnlyField(3)).toBe(false); // Legal name
            expect(isDocumentOnlyField(96)).toBe(false); // Trader full name
        });

        it('should return false for unknown Field No', () => {
            expect(isDocumentOnlyField(999)).toBe(false);
        });
    });

    describe('getFieldNosByModel', () => {
        it('should return Field Nos for IdentityProfile', () => {
            const fieldNos = getFieldNosByModel('IdentityProfile');
            expect(fieldNos).toContain(1); // LEI validation date
            expect(fieldNos).toContain(2); // LEI
            expect(fieldNos).toContain(3); // Legal name
            expect(fieldNos.every((n) => typeof n === 'number')).toBe(true);
        });

        it('should exclude document-only fields', () => {
            const fieldNos = getFieldNosByModel('DocumentRegistry');
            // Document-only fields should have field: null, so they should be excluded
            expect(fieldNos.length).toBe(0);
        });
    });

    describe('isValidFieldNo', () => {
        it('should return true for valid Field Nos', () => {
            expect(isValidFieldNo(1)).toBe(true);
            expect(isValidFieldNo(119)).toBe(true);
            expect(isValidFieldNo(50)).toBe(true);
        });

        it('should return false for invalid Field Nos', () => {
            expect(isValidFieldNo(0)).toBe(false);
            expect(isValidFieldNo(94)).toBe(false); // Placeholder
            expect(isValidFieldNo(120)).toBe(false);
            expect(isValidFieldNo(-1)).toBe(false);
        });
    });

    describe('Model-specific mappings', () => {
        it('should map Stakeholder fields correctly', () => {
            const def65 = getFieldDefinition(65);
            expect(def65.model).toBe('Stakeholder');
            expect(def65.field).toBe('fullName');
            expect(def65.isRepeating).toBe(true);
        });

        it('should map AuthorizedTrader fields correctly', () => {
            const def96 = getFieldDefinition(96);
            expect(def96.model).toBe('AuthorizedTrader');
            expect(def96.field).toBe('fullName');
            expect(def96.isRepeating).toBe(true);
        });

        it('should map repeating vs non-repeating correctly', () => {
            const identityField = getFieldDefinition(3); // Legal name in IdentityProfile
            const entityNameField = getFieldDefinition(4); // Trading name in EntityName

            expect(identityField.isRepeating).toBe(false);
            expect(entityNameField.isRepeating).toBe(true);
        });
    });

    describe('Prisma naming conventions', () => {
        it('should use PascalCase for model names', () => {
            const def = getFieldDefinition(1);
            expect(def.model).toMatch(/^[A-Z][a-zA-Z]*$/);
        });

        it('should use camelCase for field names', () => {
            const def = getFieldDefinition(1);
            expect(def.field).toMatch(/^[a-z][a-zA-Z]*$/);
        });

        it('should include snake_case db references', () => {
            const def = getFieldDefinition(1);
            expect(def.dbTable).toBe('identity_profiles');
            expect(def.dbColumn).toBe('leiValidationDate');
        });
    });
});
