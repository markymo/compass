/**
 * code-systems.ts
 *
 * Registry of controlled-vocabulary code systems used by structured collection
 * fields (STRUCTURED_COLLECTION with codeSystem set in COMPLEX_FIELD_CONFIG).
 *
 * Each entry drives:
 *   - UX copy (button labels, placeholder, empty state)
 *   - instanceId prefix (must match TO_CODE_LIST transform and addCodeListEntry)
 *   - Future: data source routing in getCodeSystemEntries
 *
 * Design principles:
 *   - No schema migration required — config only.
 *   - Adding a new code system requires: a new key here, a data file in
 *     src/domain/registry/utils/, and a dispatch branch in getCodeSystemEntries.
 *   - The client never receives raw JSON — it receives serialised entries from
 *     the getCodeSystemEntries server action.
 */

export interface CodeSystemConfig {
    /** Stable identifier. Must match the value in StructuredCollectionConfig.codeSystem. */
    id: string;

    /** Human-readable label shown in picker footer. e.g. "UK SIC 2007" */
    label: string;

    /** Button copy. e.g. "Add SIC code" */
    addButtonLabel: string;

    /** Search input placeholder. e.g. "Search by code or description…" */
    searchPlaceholder: string;

    /** Empty state when no codes are assigned. */
    emptyStateText: string;

    /** Shown in Command when search returns no results. */
    noResultsText: string;

    /**
     * Prefix used to build a stable instanceId.
     * instanceId = `${instanceIdPrefix}${code}` — e.g. "sic_35110"
     * MUST match the prefix used in the TO_CODE_LIST transform.
     */
    instanceIdPrefix: string;
}

export const CODE_SYSTEMS: Record<string, CodeSystemConfig> = {

    SIC_2007_UK: {
        id: 'SIC_2007_UK',
        label: 'UK SIC 2007',
        addButtonLabel: 'Add SIC code',
        searchPlaceholder: 'Search by code or description\u2026',
        emptyStateText: 'No industry classifications recorded',
        noResultsText: 'No SIC codes match your search',
        instanceIdPrefix: 'sic_',
    },

    // Future entries — add data file + getCodeSystemEntries dispatch branch first:
    // NAF_2008:   { id: 'NAF_2008',   label: 'NAF 2008 (France)', ... }
    // WZ_2008:    { id: 'WZ_2008',    label: 'WZ 2008 (Germany)', ... }
    // NAICS_2022: { id: 'NAICS_2022', label: 'NAICS 2022', ... }
    // ISO_3166_1: { id: 'ISO_3166_1', label: 'ISO 3166-1 Countries', ... }

};

/**
 * Returns the config for a given code system ID, or null if not registered.
 * Use this instead of direct CODE_SYSTEMS access to get a type-safe null-check.
 */
export function getCodeSystemConfig(id: string): CodeSystemConfig | null {
    return CODE_SYSTEMS[id] ?? null;
}
