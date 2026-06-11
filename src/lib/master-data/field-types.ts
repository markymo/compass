/**
 * field-types.ts
 *
 * Central registry of known MasterFieldDefinition.appDataType values.
 *
 * This is a code-level constant — NOT yet a DB enum.
 * Purpose: eliminate scattered raw string comparisons and provide a
 * single place to add/audit data types before any schema migration.
 *
 * ── Production inventory (2026-05-19) ───────────────────────────────────────
 * Run of query 1.1 revealed the actual in-use values:
 *   TEXT        87 fields
 *   DATETIME    12 fields  ← NOT "DATE"
 *   DOCUMENT_REF  8 fields
 *   JSONB        5 fields  ← NOT "JSON"
 *   ORG_REF      4 fields  ← NOT in original registry
 *   PERSON_REF   3 fields  ← NOT "PARTY_REF"
 *
 * ADDRESS_REF has 0 production records — infrastructure exists but unused.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Do NOT convert to a Prisma enum without first confirming all values are
 * captured here and the enum migration is additive-only.
 */

// ── Canonical type values ────────────────────────────────────────────────────

export const APP_DATA_TYPES = {
    // Scalar types
    TEXT:         'TEXT',
    NUMBER:       'NUMBER',
    BOOLEAN:      'BOOLEAN',

    // Date — stored as DATETIME in production (not DATE)
    DATETIME:     'DATETIME',

    // JSON — stored as JSONB in production (not JSON)
    JSONB:        'JSONB',

    // Dropdown selection (option-set backed)
    SELECT:       'SELECT',

    // Address — stored as embedded JSON in production (new)
    ADDRESS:      'ADDRESS',

    // Reference types — require MasterFieldGraphBinding to be configured.
    // PERSON_REF: links to a Person graph node (strictly individuals)
    PERSON_REF:   'PERSON_REF',
    // PARTY_REF: links to a Person OR LegalEntity — used for stakeholder fields (62/63/64)
    //            where a director/UBO/PSC can be an individual or a corporate entity.
    //            This is the canonical production type for these fields.
    PARTY_REF:    'PARTY_REF',
    // ORG_REF: links to a LegalEntity / Organisation graph node
    ORG_REF:      'ORG_REF',
    // DOCUMENT_REF: links to a document in the Document Registry
    DOCUMENT_REF: 'DOCUMENT_REF',
    // ADDRESS_REF: links to a structured Address record (0 production records as of 2026-05-19)
    ADDRESS_REF:  'ADDRESS_REF',
} as const;

export type AppDataType = typeof APP_DATA_TYPES[keyof typeof APP_DATA_TYPES];

// ── Type sets for grouping ───────────────────────────────────────────────────

/** Types that map to simple scalar columns on FieldClaim */
export const SCALAR_TYPES = new Set<AppDataType>([
    APP_DATA_TYPES.TEXT,
    APP_DATA_TYPES.NUMBER,
    APP_DATA_TYPES.BOOLEAN,
    APP_DATA_TYPES.DATETIME,
    APP_DATA_TYPES.JSONB,
    APP_DATA_TYPES.SELECT,
    APP_DATA_TYPES.ADDRESS,
]);

/** Types that materialise relational rows (Person, Address, LegalEntity) */
export const REFERENCE_TYPES = new Set<AppDataType>([
    APP_DATA_TYPES.PERSON_REF,
    APP_DATA_TYPES.PARTY_REF,
    APP_DATA_TYPES.ORG_REF,
    APP_DATA_TYPES.DOCUMENT_REF,
    APP_DATA_TYPES.ADDRESS_REF,
]);

/** All known types — used for unknown-type warnings */
export const ALL_KNOWN_TYPES = new Set<string>(Object.values(APP_DATA_TYPES));

// ── Helper functions ─────────────────────────────────────────────────────────

/** Returns true if the value is a recognised appDataType. */
export function isKnownAppDataType(value: string): value is AppDataType {
    return ALL_KNOWN_TYPES.has(value);
}

/** Returns true for types that produce a relational reference (not a raw scalar). */
export function isReferenceType(value: string): boolean {
    return REFERENCE_TYPES.has(value as AppDataType);
}

/** Returns true for simple scalar types. */
export function isScalarType(value: string): boolean {
    return SCALAR_TYPES.has(value as AppDataType);
}

// ── Admin UI option lists ────────────────────────────────────────────────────

export interface AppDataTypeOption {
    value: AppDataType;
    label: string;
    description?: string;
}

/** Scalar types for the standard admin field create/edit dropdowns. */
export const SCALAR_UI_OPTIONS: AppDataTypeOption[] = [
    { value: APP_DATA_TYPES.TEXT,     label: 'Text (String)' },
    { value: APP_DATA_TYPES.NUMBER,   label: 'Number' },
    { value: APP_DATA_TYPES.BOOLEAN,  label: 'Boolean' },
    { value: APP_DATA_TYPES.DATETIME, label: 'Date / DateTime' },
    { value: APP_DATA_TYPES.JSONB,    label: 'JSON' },
    { value: APP_DATA_TYPES.SELECT,   label: 'Dropdown Selection' },
    { value: APP_DATA_TYPES.ADDRESS,  label: 'Address (Structured Embedded)' },
];

/** Reference types — require additional graph binding configuration. */
export const REFERENCE_UI_OPTIONS: AppDataTypeOption[] = [
    { value: APP_DATA_TYPES.PERSON_REF,   label: 'Person Reference',       description: 'Links to a Person node in the graph (individuals only)' },
    { value: APP_DATA_TYPES.PARTY_REF,    label: 'Party Reference',        description: 'Links to a Person or Legal Entity (directors, UBOs, PSCs)' },
    { value: APP_DATA_TYPES.ORG_REF,      label: 'Organisation Reference',  description: 'Links to a Legal Entity / Org node in the graph' },
    { value: APP_DATA_TYPES.DOCUMENT_REF, label: 'Document Reference',      description: 'Links to an uploaded document in the Document Registry' },
    { value: APP_DATA_TYPES.ADDRESS_REF,  label: 'Address Reference',       description: 'Links to a structured Address record' },
];

/** All UI options combined (scalar first, then reference). */
export const ALL_UI_OPTIONS: AppDataTypeOption[] = [
    ...SCALAR_UI_OPTIONS,
    ...REFERENCE_UI_OPTIONS,
];
