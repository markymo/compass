/**
 * transform-registry.ts
 *
 * Central registry of all MappingTransformType values with human-readable
 * labels and one-sentence descriptions.
 *
 * This is the single source of truth for transform metadata.
 * Do NOT duplicate descriptions onto individual SourceFieldMapping rows.
 *
 * Used by:
 *  - Source mapping admin UI (dropdown labels + inline help text)
 *  - Unit tests (completeness assertions)
 */

export interface TransformDefinition {
    /** DB enum value — must exactly match MappingTransformType */
    key: string;
    /** Compact label shown in dropdowns */
    label: string;
    /** One-sentence plain-English description shown under the dropdown */
    description: string;
    /** What payload shape the transform expects to receive */
    inputExpectation?: string;
    /** What structural shape the transform produces */
    outputShape?: string;
    /** Typical field or domain use-case */
    typicalUse?: string;
    /** Operational warnings or specific hardcoded assumptions */
    caveats?: string;

    // --- Transform Contract (Validation) ---
    /** The core appDataType emitted (e.g., 'PARTY', 'TEXT') */
    outputDataType?: string;
    /** Whether it emits an embedded payload or a reference (e.g., 'EMBEDDED', 'REFERENCE') */
    outputStorageMode?: string;
    /** Whether it emits a single value ('SINGLE') or multiple instances ('MANY') */
    outputCardinality?: 'SINGLE' | 'MANY';
    /** For PARTY fields: which partyTypes it emits */
    outputPartyTypes?: ('INDIVIDUAL' | 'ORGANISATION' | 'UNKNOWN')[];
    /** For PARTY fields: which specific subtypes it emits */
    outputPartySubTypes?: string[];
    /** Which fields are guaranteed or likely to be populated in the output */
    populatedFields?: string[];
    /** The specific source shape/type required for this transform to succeed */
    requiredSourceShape?: string;
    /** Descriptive semantics of any filtering applied during transform */
    filterSemantics?: string;
}

export const TRANSFORM_DEFINITIONS: TransformDefinition[] = [
    {
        key: 'DIRECT',
        label: 'Direct',
        description: 'Takes a single source value and copies it unchanged. If the source is an object, it attempts to extract a standard text value. If it cannot be transformed, it produces an empty result.',
    },
    {
        key: 'DATE_TO_ISO',
        label: 'Date → ISO (YYYY-MM-DD)',
        description: 'Takes a single date-like string and formats it as YYYY-MM-DD. If the date cannot be understood, it produces an empty result.',
    },
    {
        key: 'DATETIME_TO_ISO',
        label: 'DateTime → ISO',
        description: 'Takes a single date and time string and formats it as a full timestamp. If the time cannot be understood, it produces an empty result.',
    },
    {
        key: 'COUNTRY_TO_NAME',
        label: 'Country Code → Country Name',
        description: 'Takes a single two-letter country code (e.g. GB) and returns the full country name. Unrecognised codes are left unchanged.',
    },
    {
        key: 'COUNTRY_TO_ISO2',
        label: 'Country Name → ISO Code',
        description: 'Takes a single country name or code and returns the standard two-letter code. Unrecognised names are left unchanged.',
    },
    {
        key: 'ENUM_MAP',
        label: 'Enum Map',
        description: 'Takes a single value and replaces it using a fixed list of allowed values. Unrecognised values are passed through but marked for review.',
    },
    {
        key: 'FIRST_ARRAY_ITEM',
        label: 'First Array Item',
        description: 'Takes a list of values and extracts only the first item as a single text value. If the list is empty, it produces an empty result.',
    },
    {
        key: 'JOIN_ARRAY',
        label: 'Join Array',
        description: 'Takes a list of values and combines them into a single text value, separated by commas. If the list is empty, it produces an empty result.',
    },
    {
        key: 'TO_ADDRESS_OBJECT',
        label: 'To Address Object (Legacy)',
        description: 'Legacy transform that converts a source address into a standalone address record. Do not use for new mappings.',
    },
    {
        key: 'TO_PARTY_OBJECT',
        label: 'To Party Object (Legacy)',
        description: 'Legacy transform that maps a single source record into a standalone Party record. Do not use for new mappings.',
    },
    {
        key: 'TO_PARTY_LIST',
        label: 'To Party List (Legacy)',
        description: 'Legacy transform that maps a list of source records into separate standalone Party records. Do not use for new mappings.',
    },
    {
        key: 'TO_NAME_HISTORY_LIST',
        label: 'To Name History List',
        description: 'Takes a list of previous names and converts them into a collection of dated name records. Each valid name becomes its own FieldClaim.',
    },
    {
        key: 'TO_CODE_LIST',
        label: 'To Code List',
        description: 'Takes a list of industry codes and converts them into structured records with descriptions. Each valid code becomes its own FieldClaim.',
    },
    {
        key: 'RA_CODE_TO_NAME',
        label: 'RA Code → Authority Name',
        description: 'Takes a single Registration Authority code (e.g. RA000192) and returns the full authority name from the Registry Authorities list. Unrecognised codes are left unchanged.',
    },
    {
        key: 'TO_PARTY_VALUE',
        label: 'To Party',
        description: 'Takes a single source record and converts it into one Party value. If the record cannot be transformed, it is skipped.',
    },
    {
        key: 'TO_PARTY_VALUE_LIST',
        label: 'To Party List',
        description: 'Takes a list of source records and converts them into separate Party values. Each valid record becomes its own FieldClaim. Invalid records are skipped.',
    },
    {
        key: 'TO_COMPANIES_HOUSE_ACTIVE_DIRECTOR_PARTY_VALUE_LIST',
        label: 'Companies House Active Directors',
        description: 'Takes a list of Companies House officers and converts them into separate Party values. This explicitly filters the list to include only active directors, excluding any who have resigned or are inactive.',
        inputExpectation: 'Companies House officers array.',
        outputShape: 'Multiple embedded PARTY FieldClaims.',
        typicalUse: 'Field 63 Current Directors.',
        caveats: 'Excludes resigned directors, secretaries and non-renderable officers. Depends on Companies House officer semantics.',
        outputDataType: 'PARTY',
        outputStorageMode: 'EMBEDDED',
        outputCardinality: 'MANY',
        outputPartyTypes: ['INDIVIDUAL'],
        outputPartySubTypes: ['PERSON'],
        populatedFields: ['forenames', 'surname', 'roles', 'dateOfBirth', 'nationality', 'sourceIdentifiers'],
        requiredSourceShape: 'Companies House officers array',
        filterSemantics: 'active directors only',
    },
    {
        key: 'TO_ADDRESS_VALUE',
        label: 'To Address',
        description: 'Takes a single source address and converts it into a structured Address value. If the address cannot be formatted, it produces an empty result.',
    }
];

/**
 * Lookup map from transform key to definition (O(1) access).
 * Populated once at module load.
 */
const rawMap = Object.fromEntries(TRANSFORM_DEFINITIONS.map((d) => [d.key, d]));
rawMap['TO_PERSON_OR_CONTACT_VALUE'] = rawMap['TO_PARTY_VALUE'];
rawMap['TO_PERSON_OR_CONTACT_LIST'] = rawMap['TO_PARTY_VALUE_LIST'];

export const TRANSFORM_DEFINITION_MAP: Record<string, TransformDefinition> = rawMap;

/**
 * Array of { value, label } suitable for <Select> / <SelectItem> use in React.
 * Compact labels only — pair with TRANSFORM_DEFINITION_MAP for descriptions.
 */
export const TRANSFORM_SELECT_OPTIONS = TRANSFORM_DEFINITIONS.map((d) => ({
    value: d.key,
    label: d.label,
}));

/**
 * Returns the description for a given transform key, or undefined if not found.
 */
export function getTransformDescription(key: string): string | undefined {
    return TRANSFORM_DEFINITION_MAP[key]?.description;
}
