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
 *   1. Add an entry to RA_DISPLAY_NAMES with its canonical mappingSourceKey as the key.
 *   2. If the authority has legacy RA codes or registryKey strings in old FieldClaim rows,
 *      add them to LEGACY_SOURCE_REF_ALIASES pointing at the canonical key.
 *   3. The rest of the UI picks it up automatically via getSourceDisplayName.
 */

/** Maps mappingSourceKey → human-readable display label.
 * Keys MUST be RegistryAuthority.mappingSourceKey values (canonical group identifiers).
 * Do NOT use raw GLEIF RA codes as keys here — add aliases to LEGACY_SOURCE_REF_ALIASES instead.
 */
export const RA_DISPLAY_NAMES: Record<string, string> = {
    // Key = canonical mappingSourceKey.  Value = short human name only (no RA code — appended by getSourceDisplayName).
    COMPANIES_HOUSE: "Companies House",       // groups RA000585 / RA000586 / RA000587
    RA000192:        "RNCS / Infogreffe",      // France
    RA000242:        "Handelsregister",         // Germany – Frankfurt
    // Add future mappingSourceKeys here:
};

/**
 * Maps legacy / pre-migration sourceReference values → canonical mappingSourceKey.
 *
 * These are values that may appear on old FieldClaim.sourceReference rows written
 * before the mappingSourceKey migration, or in legacy registryKey strings.
 * Normalising here keeps RA_DISPLAY_NAMES and all consumers clean.
 *
 * To add a new authority with legacy aliases:
 *   Map each legacy value → the canonical mappingSourceKey in RA_DISPLAY_NAMES.
 */
export const LEGACY_SOURCE_REF_ALIASES: Record<string, string> = {
    // Companies House — GLEIF RA codes and old registryKey stored on FieldClaims
    RA000585: "COMPANIES_HOUSE",    // England & Wales
    RA000586: "COMPANIES_HOUSE",    // Scotland (reserved)
    RA000587: "COMPANIES_HOUSE",    // Northern Ireland
    GB_COMPANIES_HOUSE: "COMPANIES_HOUSE",  // legacy registryKey value (pre-v2)
};

/**
 * Normalises a sourceReference to its canonical mappingSourceKey.
 * Returns the input unchanged if it is already canonical or unknown.
 */
export function normalizeSourceRef(sourceReference: string): string {
    return LEGACY_SOURCE_REF_ALIASES[sourceReference] ?? sourceReference;
}

/**
 * Returns a human-readable label for a (sourceType, sourceReference) pair.
 * Handles alias normalisation internally — callers do not need to pre-process values.
 *
 * @param sourceType      - e.g. "GLEIF", "REGISTRATION_AUTHORITY"
 * @param sourceReference - canonical mappingSourceKey or any legacy alias
 */
export function getSourceDisplayName(
    sourceType: string,
    sourceReference?: string | null
): string {
    if (sourceType === "GLEIF") return "GLEIF";

    if (sourceType === "REGISTRATION_AUTHORITY" || sourceType === "COMPANIES_HOUSE") {
        // Normalise legacy aliases (e.g. RA000585 → COMPANIES_HOUSE) before lookup
        const canonical = sourceReference ? normalizeSourceRef(sourceReference) : null;
        const name = canonical ? RA_DISPLAY_NAMES[canonical] : null;
        if (name && canonical) {
            // Only append the code if it's a standard RA code. 
            // This prevents redundant displays like "Companies House - COMPANIES_HOUSE"
            if (canonical.match(/^RA\d{6}$/)) {
                return `${name} - ${canonical}`;
            }
            return name;
        }
        // Fallback for unknown mappingSourceKeys not yet in RA_DISPLAY_NAMES
        if (canonical) {
            if (canonical.match(/^RA\d{6}$/)) return `Registry - ${canonical}`;
            return `Registry (${canonical})`;
        }
        // Null sourceReference should not occur after migration
        return "Registration Authority (unknown)";
    }

    // Friendly labels for all other source types.
    // Keys MUST match SourceType enum values exactly.
    // Do NOT add GLEIF or REGISTRATION_AUTHORITY here — those are handled above.
    const MISC_DISPLAY: Record<string, string> = {
        USER_INPUT:     "User input",
        AI_EXTRACTION:  "AI extraction",
        SYSTEM:         "System",
        SYSTEM_DERIVED: "System",
        MASTER_RECORD:  "Master record",
        MULTI_SOURCE:   "Multiple sources",
        NATIONAL_REGISTRY: "Registry",
        UNKNOWN:        "Unknown",
    };

    return MISC_DISPLAY[sourceType] ?? sourceType.replace(/_/g, " ").toLowerCase();
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
        label: "Companies House",
        sourceType: "REGISTRATION_AUTHORITY",
        // mappingSourceKey — resolves to RA000585/586/587 via RegistryAuthority.mappingSourceKey
        sourceReference: "COMPANIES_HOUSE",
        supportsLiveBrowser: true,
    },
    {
        value: "FR_RA000192",
        label: "RNCS / Infogreffe - RA000192",
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
