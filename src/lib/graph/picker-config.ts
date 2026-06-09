/**
 * picker-config.ts
 *
 * Type definition, helpers, and server-side validation for
 * MasterFieldGraphBinding.pickerConfig.
 *
 * ## Design decisions
 *
 * **Sanitize-not-reject:** Invalid field keys are silently removed rather than
 * causing an error. This prevents accidental data loss if a registry field is
 * renamed after a config was saved.
 *
 * **Null-for-empty:** A config with no picker UX settings AND projectionMode
 * DEFAULT is stored as null (identical to "no config"). Only when the admin
 * has made an explicit choice (CUSTOM or NONE, or any picker UX config) is the
 * object persisted.
 *
 * **Non-object input → null:** Malformed JSON is treated as "no config".
 *
 * **Fail-safe projection:** projectionMode absent / null config → DEFAULT
 * (safe system defaults). An admin must explicitly choose NONE to suppress
 * all fields, or CUSTOM to pick their own list.
 */

import { getDisplayableFields, getSearchableFields, type NodeType } from "./node-field-registry";

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * How this Master Data Field projects node data downstream (governance layer).
 *
 * DEFAULT  – use safe system defaults (first name + last name for PERSON, etc.)
 * CUSTOM   – use exactly projectionFields[] after validation; empty array = expose nothing
 * NONE     – expose nothing (only the internal reference ID is retained)
 */
export type ProjectionMode = "DEFAULT" | "CUSTOM" | "NONE";

/** All valid projection mode values — used for runtime validation. */
export const PROJECTION_MODES: readonly ProjectionMode[] = ["DEFAULT", "CUSTOM", "NONE"];

/**
 * Shape of MasterFieldGraphBinding.pickerConfig (stored as Prisma Json?).
 *
 * Picker UX (node selection):
 *   displayFields     – node fields used to build the primary picker row label
 *   subFields         – node fields shown beneath the primary label
 *   searchFields      – additional fields matched during picker text search
 *   pickerPlaceholder – override text for the picker search input
 *
 * Governance (downstream projection):
 *   projectionMode    – DEFAULT | CUSTOM | NONE (absent → DEFAULT at runtime)
 *   projectionFields  – used only when projectionMode === "CUSTOM"
 */
export interface GraphPickerConfig {
    /** Node fields used to build the picker item's primary display label. */
    displayFields?:     string[];
    /** Node fields shown beneath the primary label in the picker. */
    subFields?:         string[];
    /** Additional node fields matched during picker search (isSearchable only). */
    searchFields?:      string[];
    /** Override text for the picker search input. */
    pickerPlaceholder?: string;
    /**
     * Governance mode for downstream projection.
     * Absent (or null config) = DEFAULT.
     */
    projectionMode?:    ProjectionMode;
    /**
     * Active when projectionMode === "CUSTOM".
     * The validated subset of displayable node fields to expose downstream.
     * Empty array is valid and means "expose nothing".
     */
    projectionFields?:  string[];
}

// ── Default projection fields ──────────────────────────────────────────────────

/**
 * Safe system-default fields exposed downstream when projectionMode is DEFAULT
 * or when no pickerConfig exists.
 *
 * These are deliberately minimal — only the fields needed to identify the node
 * in a display context without exposing sensitive data.
 */
export function getDefaultProjectionFields(nodeType: NodeType): string[] {
    switch (nodeType) {
        case "PERSON":       return ["firstName", "lastName"];
        case "LEGAL_ENTITY": return ["name"];
        case "ADDRESS":      return ["line1", "postalCode"];
        default:             return [];
    }
}

// ── resolveProjectionFields ────────────────────────────────────────────────────

/**
 * Resolves the effective set of projection fields for a given nodeType and config.
 *
 * Rules (in priority order):
 *  1. null / undefined config              → DEFAULT fields
 *  2. projectionMode absent                → DEFAULT fields
 *  3. projectionMode === "DEFAULT"         → DEFAULT fields (ignore projectionFields)
 *  4. projectionMode === "NONE"            → [] (expose nothing)
 *  5. projectionMode === "CUSTOM"          → projectionFields ?? []
 *     (empty array is a valid explicit "expose nothing")
 *  6. invalid projectionMode string        → DEFAULT fields (fail safe)
 */
export function resolveProjectionFields(
    nodeType: NodeType,
    config: GraphPickerConfig | null | undefined
): string[] {
    if (!config || !config.projectionMode) {
        return getDefaultProjectionFields(nodeType);
    }

    switch (config.projectionMode) {
        case "DEFAULT":
            return getDefaultProjectionFields(nodeType);

        case "NONE":
            return [];

        case "CUSTOM":
            // Empty custom array is an explicit "expose nothing" — return as-is.
            return config.projectionFields ?? [];

        default:
            // Invalid / future mode — fail safe
            return getDefaultProjectionFields(nodeType);
    }
}

// ── isEmptyPickerConfig ────────────────────────────────────────────────────────

/**
 * Returns true if a GraphPickerConfig carries no meaningful configuration
 * that needs to be stored.
 *
 * projectionMode DEFAULT contributes nothing (it's the absence of a choice).
 * projectionMode CUSTOM or NONE IS meaningful even with empty projectionFields,
 * because those represent explicit admin decisions.
 */
export function isEmptyPickerConfig(config: GraphPickerConfig): boolean {
    const hasDisplayFields    = (config.displayFields?.length    ?? 0) > 0;
    const hasSubFields        = (config.subFields?.length        ?? 0) > 0;
    const hasSearchFields     = (config.searchFields?.length     ?? 0) > 0;
    const hasPlaceholder      = (config.pickerPlaceholder?.trim().length ?? 0) > 0;
    const hasProjectionFields = (config.projectionFields?.length ?? 0) > 0;
    // CUSTOM or NONE are explicit choices — always store them
    const hasExplicitMode     = config.projectionMode === "CUSTOM" || config.projectionMode === "NONE";

    return !hasDisplayFields
        && !hasSubFields
        && !hasSearchFields
        && !hasPlaceholder
        && !hasProjectionFields
        && !hasExplicitMode;
}

// ── sanitizePickerConfig ───────────────────────────────────────────────────────

/**
 * Validates and cleans an incoming pickerConfig payload against NODE_FIELD_REGISTRY
 * for the given nodeType. Returns a clean config object, or null if nothing
 * meaningful remains after validation.
 *
 * Rules applied:
 *  1. Non-object input → null (handles null, string, number, array)
 *  2. displayFields     — only fieldKeys that are isDisplayable for nodeType
 *  3. subFields         — only fieldKeys that are isDisplayable for nodeType
 *  4. projectionMode    — only valid ProjectionMode values ("DEFAULT"|"CUSTOM"|"NONE")
 *                         Invalid/missing → omitted (resolveProjectionFields defaults to DEFAULT)
 *  5. projectionFields  — only when projectionMode === "CUSTOM"
 *                         Validated against displayable keys; empty array IS kept
 *                         (explicit "expose nothing via custom list")
 *  6. searchFields      — only fieldKeys that are isSearchable for nodeType
 *  7. pickerPlaceholder — trimmed; omitted if empty after trim
 *  8. Resulting empty config → null
 */
export function sanitizePickerConfig(
    nodeType: NodeType,
    input: unknown
): GraphPickerConfig | null {
    // Rule 1: must be a plain object
    if (
        input === null ||
        input === undefined ||
        typeof input !== "object" ||
        Array.isArray(input)
    ) {
        return null;
    }

    const raw = input as Record<string, unknown>;

    // Build allowed key sets from registry
    const displayableKeys = new Set(
        getDisplayableFields(nodeType).map(f => f.fieldKey)
    );
    const searchableKeys = new Set(
        getSearchableFields(nodeType).map(f => f.fieldKey)
    );

    const clean: GraphPickerConfig = {};

    // Rule 2+3: displayFields and subFields — must be displayable
    for (const prop of ["displayFields", "subFields"] as const) {
        if (Array.isArray(raw[prop])) {
            const valid = (raw[prop] as unknown[])
                .filter((k): k is string => typeof k === "string" && displayableKeys.has(k));
            if (valid.length > 0) clean[prop] = valid;
        }
    }

    // Rule 4: projectionMode — only accept valid enum values
    const rawMode = raw.projectionMode;
    const validMode = (PROJECTION_MODES as readonly string[]).includes(rawMode as string)
        ? (rawMode as ProjectionMode)
        : undefined;
    if (validMode !== undefined) {
        clean.projectionMode = validMode;
    }

    // Rule 5: projectionFields — only when CUSTOM mode; empty array is kept intentionally
    if (validMode === "CUSTOM" && Array.isArray(raw.projectionFields)) {
        const valid = (raw.projectionFields as unknown[])
            .filter((k): k is string => typeof k === "string" && displayableKeys.has(k));
        // Store even if empty — empty CUSTOM means "expose nothing explicitly"
        clean.projectionFields = valid;
    }

    // Rule 6: searchFields — must be searchable
    if (Array.isArray(raw.searchFields)) {
        const valid = (raw.searchFields as unknown[])
            .filter((k): k is string => typeof k === "string" && searchableKeys.has(k));
        if (valid.length > 0) clean.searchFields = valid;
    }

    // Rule 7: pickerPlaceholder — trim and omit if empty
    if (typeof raw.pickerPlaceholder === "string") {
        const trimmed = raw.pickerPlaceholder.trim();
        if (trimmed.length > 0) clean.pickerPlaceholder = trimmed;
    }

    // Rule 8: empty config → null
    return isEmptyPickerConfig(clean) ? null : clean;
}
