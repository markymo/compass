/**
 * ValidationTypes.ts
 * 
 * Type definitions for validation results and errors.
 */

export type ValidationResult = {
    valid: boolean;
    errors: string[];
};

export type FieldValidationError = {
    fieldNo: number;
    fieldName: string;
    field: string; // Prisma field name
    message: string;
};

export type MetaValidationError = {
    field: string; // Prisma field name
    message: string;
    expectedFieldNo?: number;
};
