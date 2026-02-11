/**
 * ProvenanceTypes.ts
 * 
 * Type definitions for provenance tracking in the KYC data model.
 * All Field-No-mapped columns must have corresponding meta entries.
 */

export type ProvenanceSource = 'GLEIF' | 'COMPANIES_HOUSE' | 'USER_INPUT' | 'SYSTEM';

export type ProvenanceMetadata = {
    field_no: number;
    source: ProvenanceSource;
    evidence_id?: string; // UUID reference to evidence_store
    timestamp: string; // ISO 8601 datetime
    verified_by?: string; // User UUID
    confidence?: number; // 0-1 confidence score
};

/**
 * Meta object structure: keys are Prisma field names (camelCase)
 * Example: { "legalName": { field_no: 3, source: "GLEIF", ... } }
 */
export type Meta = Record<string, ProvenanceMetadata>;

/**
 * Wraps data with provenance metadata
 */
export type WithProvenance<T> = T & {
    meta: Meta;
};
