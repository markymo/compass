/**
 * source-display.ts
 *
 * Single source of truth for mapping backend SourceType + sourceReference pairs
 * to user-facing display names.
 *
 * Admin UX principle:
 *   Admins should think in terms of "which integrated source supplies this field?"
 *   not "which internal enum does the backend use?".
 *
 * To add a new Registration Authority:
 *   1. Add an entry to RA_DISPLAY_NAMES below.
 *   2. The rest of the UI picks it up automatically.
 */

/** Maps mappingSourceKey → display label.
 * Keys here are RegistryAuthority.mappingSourceKey values (NOT GLEIF RA codes).
 * For single-RA authorities where mappingSourceKey is null, the RA code is used as fallback.
 */
export const RA_DISPLAY_NAMES: Record<string, string> = {
    COMPANIES_HOUSE: "Companies House (UK)",       // RA000585/RA000586/RA000587
    RA000192: "RNCS / Infogreffe (RA000192)",      // France
    RA000242: "Handelsregister (RA000242)",         // Germany – Frankfurt
    // Add future mappingSourceKeys here (not GLEIF RA codes):
};

/**
 * Returns a human-readable label for a source mapping row.
 *
 * @param sourceType     - e.g. "GLEIF", "REGISTRATION_AUTHORITY"
 * @param sourceReference - e.g. "RA000585", or null/undefined for global mappings
 */
export function getSourceDisplayName(
    sourceType: string,
    sourceReference?: string | null
): string {
    if (sourceType === "GLEIF") return "GLEIF";

    if (sourceType === "REGISTRATION_AUTHORITY" || sourceType === "COMPANIES_HOUSE") {
        if (sourceReference && RA_DISPLAY_NAMES[sourceReference]) {
            return RA_DISPLAY_NAMES[sourceReference];
        }
        // Fallback for unknown mappingSourceKeys not yet in RA_DISPLAY_NAMES
        if (sourceReference) return `Registry (${sourceReference})`;
        // Null sourceReference should not occur after migration
        return "Registration Authority (unknown source)";
    }

    // Pass-through for other source types (USER_INPUT, AI_EXTRACTION, etc.)
    return sourceType;
}

/**
 * Concrete, integrated source options for the Add Source Mapping modal.
 * Each option maps a UI-friendly value to the backend (sourceType, sourceReference) pair.
 *
 * Used by field-detail-sheet.tsx — keeping it here ensures the same config drives
 * both the "add" form and the "existing mappings" display.
 */
export interface SourceOption {
    /** Internal UI key — used as the <Select> value */
    value: string;
    /** User-facing label */
    label: string;
    /** Backend SourceType enum value */
    sourceType: "GLEIF" | "REGISTRATION_AUTHORITY";
    /** Backend sourceReference (RA code), or null for GLEIF */
    sourceReference: string | null;
    /** Whether this source supports the live Browse inspector */
    supportsLiveBrowser: boolean;
}

export const SOURCE_OPTIONS: SourceOption[] = [
    {
        value: "GLEIF",
        label: "GLEIF",
        sourceType: "GLEIF",
        sourceReference: null,
        supportsLiveBrowser: true,
    },
    {
        value: "COMPANIES_HOUSE",
        label: "Companies House (UK)",
        sourceType: "REGISTRATION_AUTHORITY",
        // mappingSourceKey — resolves to RA000585/586/587 via RegistryAuthority.mappingSourceKey
        sourceReference: "COMPANIES_HOUSE",
        supportsLiveBrowser: true,
    },
    {
        value: "FR_RA000192",
        label: "RNCS / Infogreffe (RA000192)",
        sourceType: "REGISTRATION_AUTHORITY",
        sourceReference: "RA000192",
        // Open API — no key required. Connector dispatched via authorityId.
        supportsLiveBrowser: true,
    },
    // Uncomment when connectors are active:
    // {
    //     value: "HR_RA000242",
    //     label: "Handelsregister (RA000242)",
    //     sourceType: "REGISTRATION_AUTHORITY",
    //     sourceReference: "RA000242",
    //     supportsLiveBrowser: false,
    // },
];
