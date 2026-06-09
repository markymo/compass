/**
 * picker-config.ts
 *
 * Type definition and server-side validation for MasterFieldGraphBinding.pickerConfig.
 *
 * ## Design decisions
 *
 * **Sanitize-not-reject:** Invalid field keys are silently removed rather than causing
 * an error. This prevents accidental data loss if a registry field is renamed after a
 * config was saved, and keeps the save action simple (no user-facing validation messages
 * for config that isn't surfaced in UI yet).
 *
 * **Null-for-empty:** An empty or fully-stripped config is stored as null rather than {}.
 * This means "no pickerConfig" and "empty pickerConfig" are identical at runtime, avoiding
 * a distinction that would only cause confusion before Phase 3.
 *
 * **Non-object input → null:** Malformed JSON (string, number, array, etc.) is treated as
 * "no config" rather than an error, making the action safe against bad client payloads.
 *
 * ## Not yet consumed
 * pickerConfig is stored but not yet read by getGraphNodesForPicker. Phase 3 will add
 * the display template logic that reads displayFields / subFields from here.
 */

import { getDisplayableFields, getSearchableFields, type NodeType } from "./node-field-registry";

// ── Public type ────────────────────────────────────────────────────────────────

/**
 * Shape of MasterFieldGraphBinding.pickerConfig.
 *
 * All fieldKey arrays reference keys from NODE_FIELD_REGISTRY for the binding's graphNodeType.
 * Unknown keys are removed at save time — see sanitizePickerConfig().
 *
 * - displayFields:    node fields to build the picker item's primary display label from.
 * - subFields:        node fields to build the picker item's sub-label from.
 * - searchFields:     node fields included in picker client-side search.
 *                     Must be a subset of the nodeType's isSearchable fields.
 * - pickerPlaceholder: override text for the picker button when no node is selected.
 * - projectionFields: subset of node fields that this Master Data Field exposes
 *                     downstream after a node is selected (governance layer).
 *                     Stored in Phase 5.3; runtime consumption is Phase 5.4.
 *                     Must be displayable fields for the nodeType. Leave empty to
 *                     apply no restriction (all fields visible — current behaviour).
 */
export interface GraphPickerConfig {
    displayFields?:     string[];
    subFields?:         string[];
    searchFields?:      string[];
    pickerPlaceholder?: string;
    /**
     * Downstream projection / governance layer.
     * Declares which node fields this Master Data Field is allowed to expose
     * after a node is selected. Empty / absent = no restriction (Phase 5.4 default).
     */
    projectionFields?:  string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns true if a GraphPickerConfig carries no meaningful configuration.
 * Used to decide whether to store null vs. a config object.
 */
export function isEmptyPickerConfig(config: GraphPickerConfig): boolean {
    const hasDisplayFields    = config.displayFields    && config.displayFields.length    > 0;
    const hasSubFields        = config.subFields        && config.subFields.length        > 0;
    const hasSearchFields     = config.searchFields     && config.searchFields.length     > 0;
    const hasPlaceholder      = config.pickerPlaceholder && config.pickerPlaceholder.trim().length > 0;
    const hasProjectionFields = config.projectionFields && config.projectionFields.length > 0;
    return !hasDisplayFields && !hasSubFields && !hasSearchFields && !hasPlaceholder && !hasProjectionFields;
}

/**
 * sanitizePickerConfig
 *
 * Validates and cleans an incoming pickerConfig payload against NODE_FIELD_REGISTRY
 * for the given nodeType. Returns a clean config object, or null if nothing meaningful
 * remains after validation.
 *
 * Rules applied:
 *  1. Non-object input → null (handles null, string, number, array)
 *  2. displayFields    — only fieldKeys that are isDisplayable for nodeType
 *  3. subFields        — only fieldKeys that are isDisplayable for nodeType
 * 2.5. projectionFields — only fieldKeys that are isDisplayable for nodeType
 *                        (same constraint — only meaningful fields can be projected)
 *  4. searchFields   — only fieldKeys that are isSearchable for nodeType
 *  5. pickerPlaceholder — trimmed; omitted if empty after trim
 *  6. Empty arrays are omitted (not stored as [])
 *  7. Resulting empty config → null
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
            if (valid.length > 0) clean[prop] = valid; // Rule 6: omit empty
        }
    }

    // Rule 2.5: projectionFields — must be displayable (same constraint as displayFields)
    if (Array.isArray(raw.projectionFields)) {
        const valid = (raw.projectionFields as unknown[])
            .filter((k): k is string => typeof k === "string" && displayableKeys.has(k));
        if (valid.length > 0) clean.projectionFields = valid; // Rule 6: omit empty
    }

    // Rule 4: searchFields — must be searchable
    if (Array.isArray(raw.searchFields)) {
        const valid = (raw.searchFields as unknown[])
            .filter((k): k is string => typeof k === "string" && searchableKeys.has(k));
        if (valid.length > 0) clean.searchFields = valid; // Rule 6: omit empty
    }

    // Rule 5: pickerPlaceholder — trim and omit if empty
    if (typeof raw.pickerPlaceholder === "string") {
        const trimmed = raw.pickerPlaceholder.trim();
        if (trimmed.length > 0) clean.pickerPlaceholder = trimmed;
    }

    // Rule 7: empty config → null
    return isEmptyPickerConfig(clean) ? null : clean;
}
