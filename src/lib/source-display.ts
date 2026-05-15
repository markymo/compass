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

/** Maps RA code → display label. Extend here for new jurisdictions. */
export const RA_DISPLAY_NAMES: Record<string, string> = {
    RA000585: "Companies House (RA000585)",   // England & Wales
    RA000586: "Companies House (RA000586)",   // Scotland
    RA000587: "Companies House (RA000587)",   // Northern Ireland
    RA000242: "Handelsregister (RA000242)",   // Germany – Frankfurt
    // Add future RAs here:
    // RA000154: "INPI (RA000154)",            // France
    // RA000244: "CRO (RA000244)",             // Ireland
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
        // Fallback: show the RA code if we don't have a friendly name yet
        if (sourceReference) return `Registry Authority (${sourceReference})`;
        return "Registration Authority";
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
        value: "CH_RA000585",
        label: "Companies House (RA000585)",
        sourceType: "REGISTRATION_AUTHORITY",
        sourceReference: "RA000585",
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
