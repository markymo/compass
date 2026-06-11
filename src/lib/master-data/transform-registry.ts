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
}

export const TRANSFORM_DEFINITIONS: TransformDefinition[] = [
    {
        key: 'DIRECT',
        label: 'Direct',
        description:
            'Copies the source value unchanged; for objects, extracts a primitive via common keys (name, value, text).',
    },
    {
        key: 'DATE_TO_ISO',
        label: 'Date → ISO (YYYY-MM-DD)',
        description: 'Parses any date-like string and formats it as YYYY-MM-DD.',
    },
    {
        key: 'DATETIME_TO_ISO',
        label: 'DateTime → ISO',
        description: 'Parses any date/time string and formats it as a full ISO 8601 timestamp.',
    },
    {
        key: 'COUNTRY_TO_NAME',
        label: 'Country Code → Country Name',
        description:
            'Converts an ISO 3166-1 alpha-2 country code (e.g. GB) into a human-readable country name (e.g. United Kingdom).',
    },
    {
        key: 'COUNTRY_TO_ISO2',
        label: 'Country Name → ISO Code',
        description:
            'Converts a country name (e.g. United Kingdom) or ISO code into the canonical two-letter ISO 3166-1 alpha-2 code (e.g. GB).',
    },
    {
        key: 'ENUM_MAP',
        label: 'Enum Map',
        description:
            'Looks the source value up in a fixed key/value map supplied in transformConfig.map; unrecognised values are passed through with a confidence penalty.',
    },
    {
        key: 'FIRST_ARRAY_ITEM',
        label: 'First Array Item',
        description: 'Takes the first element of a source array and returns it as a string.',
    },
    {
        key: 'JOIN_ARRAY',
        label: 'Join Array',
        description:
            'Joins all elements of a source array into a single string, separated by the value in transformConfig.separator (default: ", ").',
    },
    {
        key: 'TO_ADDRESS_OBJECT',
        label: 'To Address Object',
        description:
            'Maps a GLEIF or Companies House address shape into a structured address DTO that is then persisted as a linked Address record.',
    },
    {
        key: 'TO_PARTY_OBJECT',
        label: 'To Party Object',
        description:
            'Maps a single officer or stakeholder object into a typed person or corporate entity DTO.',
    },
    {
        key: 'TO_PARTY_LIST',
        label: 'To Party List',
        description:
            'Maps an array of officers or persons with significant control into a collection of person/entity DTOs, one FieldClaim per item.',
    },
    {
        key: 'TO_NAME_HISTORY_LIST',
        label: 'To Name History List',
        description:
            'Maps an array of previous names (Companies House or GLEIF format) into a dated name-history collection, one FieldClaim per entry.',
    },
    {
        key: 'TO_CODE_LIST',
        label: 'To Code List',
        description:
            'Maps an array of industry codes (e.g. SIC codes) into structured { code, label } objects, looking up descriptions from the configured code system.',
    },
    {
        key: 'RA_CODE_TO_NAME',
        label: 'RA Code → Authority Name',
        description:
            'Converts a GLEIF Registration Authority code (e.g. RA000192) into the authority name stored in the Registry Authorities table (e.g. Registre du Commerce et des Sociétés).',
    },
];

/**
 * Lookup map from transform key to definition (O(1) access).
 * Populated once at module load.
 */
export const TRANSFORM_DEFINITION_MAP: Record<string, TransformDefinition> =
    Object.fromEntries(TRANSFORM_DEFINITIONS.map((d) => [d.key, d]));

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
