/**
 * MetaSchema.ts
 * 
 * Zod schema for validating provenance metadata (meta column).
 * Enforces hard invariant: populated Field-No-mapped fields must have meta entries.
 */

import { z } from 'zod';
import { getFieldDefinition, getFieldsByModel, type FieldDefinition } from '../FieldDefinitions';
import type { MetaValidationError } from '../types/ValidationTypes';

export const MetaEntrySchema = z.object({
    field_no: z.number().int().positive(),
    source: z.enum(['GLEIF', 'COMPANIES_HOUSE', 'USER_INPUT', 'SYSTEM']),
    evidence_id: z.string().uuid().optional(),
    timestamp: z.string().datetime(),
    confidence: z.number().min(0).max(1).optional(),
    verified_by: z.string().uuid().optional(),
});

export const MetaSchema = z.record(z.string(), MetaEntrySchema);

export type MetaEntry = z.infer<typeof MetaEntrySchema>;
export type Meta = z.infer<typeof MetaSchema>;

/**
 * Validate meta for populated fields in a specific model.
 * 
 * Hard invariant: Any populated field that is mapped to a Field No MUST have a meta entry.
 * 
 * @param meta - The meta object to validate
 * @param data - The data object with populated fields
 * @param modelName - Prisma model name (e.g., 'IdentityProfile')
 * @param fieldDefinitions - Field definitions registry
 * @returns Array of validation errors (empty if valid)
 */
export function validateMetaForFields(
    meta: unknown,
    data: Record<string, unknown>,
    modelName: string,
    fieldDefinitions: Record<number, FieldDefinition>
): MetaValidationError[] {
    const errors: MetaValidationError[] = [];

    // Validate meta structure
    const metaResult = MetaSchema.safeParse(meta);
    if (!metaResult.success) {
        errors.push({
            field: '_meta',
            message: `Invalid meta structure: ${metaResult.error.message}`,
        });
        return errors;
    }

    const validMeta = metaResult.data;

    // Get all Field-No-mapped fields for this model
    const modelFields = Object.values(fieldDefinitions).filter(
        (def) => def.model === modelName && def.field !== null
    );

    // Check each populated field has corresponding meta entry
    for (const fieldDef of modelFields) {
        const fieldName = fieldDef.field!;
        const fieldValue = data[fieldName];

        // Skip null/undefined (unpopulated fields)
        if (fieldValue === null || fieldValue === undefined) {
            continue;
        }

        // Check meta entry exists
        const metaEntry = validMeta[fieldName];
        if (!metaEntry) {
            errors.push({
                field: fieldName,
                message: `Populated field '${fieldName}' is missing meta entry`,
                expectedFieldNo: fieldDef.fieldNo,
            });
            continue;
        }

        // Validate field_no matches definition
        if (metaEntry.field_no !== fieldDef.fieldNo) {
            errors.push({
                field: fieldName,
                message: `Meta entry for '${fieldName}' has incorrect field_no: expected ${fieldDef.fieldNo}, got ${metaEntry.field_no}`,
                expectedFieldNo: fieldDef.fieldNo,
            });
        }
    }

    return errors;
}

/**
 * Create a meta entry for a field
 */
export function createMetaEntry(
    fieldNo: number,
    source: 'GLEIF' | 'COMPANIES_HOUSE' | 'USER_INPUT' | 'SYSTEM',
    options?: {
        evidence_id?: string;
        verified_by?: string;
        confidence?: number;
    }
): MetaEntry {
    return {
        field_no: fieldNo,
        source,
        timestamp: new Date().toISOString(),
        ...options,
    };
}
