/**
 * binding-form-helpers.ts
 *
 * Pure helpers for converting between a DB MasterFieldGraphBinding row and
 * the bindingForm state used in the admin UI.
 *
 * Extracted from field-detail-sheet.tsx so they can be unit-tested without
 * a component harness.
 */

import type { GraphPickerConfig, ProjectionMode } from "./picker-config";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape of bindingForm state in field-detail-sheet.tsx */
export interface BindingForm {
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType: string;
    filterActiveOnly: boolean;
    writeBackEdgeType: string;
    writeBackIsActive: boolean;
    pickerLabel: string;
    allowCreate: boolean;
    displayFields: string[];
    subFields: string[];
    searchFields: string[];
    pickerPlaceholder: string;
    /** Governance mode — always set in the form; DEFAULT is the safe default. */
    projectionMode: ProjectionMode;
    /** Used only when projectionMode === "CUSTOM". Empty [] = expose nothing. */
    projectionFields: string[];
}

/** The shape returned by getGraphBindingsForField / field.graphBindings */
export interface BindingRow {
    id: string;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType: string | null;
    filterActiveOnly: boolean;
    writeBackEdgeType: string | null;
    writeBackIsActive: boolean;
    pickerLabel: string | null;
    allowCreate: boolean;
    pickerConfig: GraphPickerConfig | Record<string, unknown> | null;
}

// ── Default blank form ────────────────────────────────────────────────────────

/**
 * Default form state used for "Add Binding" mode and reset-on-close.
 * projectionMode DEFAULT is the safe, fail-safe starting point.
 */
export const BLANK_BINDING_FORM: BindingForm = {
    graphNodeType: "PERSON",
    filterEdgeType: "",
    filterActiveOnly: true,
    writeBackEdgeType: "",
    writeBackIsActive: true,
    pickerLabel: "",
    allowCreate: true,
    displayFields: [],
    subFields: [],
    searchFields: [],
    pickerPlaceholder: "",
    projectionMode: "DEFAULT",
    projectionFields: [],
};

// ── bindingToBindingForm ──────────────────────────────────────────────────────

/**
 * Converts a DB binding row into the bindingForm state shape.
 *
 * - Null strings become empty strings.
 * - null pickerConfig → all field arrays empty, placeholder empty, mode DEFAULT.
 * - Missing projectionMode in stored config → DEFAULT (fail-safe).
 * - projectionFields only meaningful for CUSTOM mode; default to [].
 */
export function bindingToBindingForm(b: BindingRow): BindingForm {
    const cfg = (b.pickerConfig ?? {}) as GraphPickerConfig;
    return {
        graphNodeType:     b.graphNodeType,
        filterEdgeType:    b.filterEdgeType    ?? "",
        filterActiveOnly:  b.filterActiveOnly,
        writeBackEdgeType: b.writeBackEdgeType ?? "",
        writeBackIsActive: b.writeBackIsActive,
        pickerLabel:       b.pickerLabel       ?? "",
        allowCreate:       b.allowCreate,
        displayFields:     cfg.displayFields    ?? [],
        subFields:         cfg.subFields        ?? [],
        searchFields:      cfg.searchFields     ?? [],
        pickerPlaceholder: cfg.pickerPlaceholder ?? "",
        projectionMode:    cfg.projectionMode   ?? "DEFAULT",
        projectionFields:  cfg.projectionFields  ?? [],
    };
}

// ── bindingFormToPickerConfig ─────────────────────────────────────────────────

/**
 * Serialises the pickerConfig-related fields from a BindingForm into a
 * GraphPickerConfig payload (or null if nothing meaningful is configured).
 *
 * - Empty picker UX arrays (displayFields, subFields, searchFields) are omitted.
 * - Blank placeholder is omitted.
 * - projectionMode DEFAULT with no other picker UX config → null (same as no config).
 * - projectionMode CUSTOM or NONE is always emitted (explicit governance choice).
 * - projectionFields only emitted when projectionMode === CUSTOM.
 *
 * The server's sanitizePickerConfig() is the authoritative validator.
 */
export function bindingFormToPickerConfig(form: BindingForm): GraphPickerConfig | null {
    const cfg: GraphPickerConfig = {};

    // Picker UX fields
    if (form.displayFields.length > 0)            cfg.displayFields     = form.displayFields;
    if (form.subFields.length > 0)                cfg.subFields         = form.subFields;
    if (form.searchFields.length > 0)             cfg.searchFields      = form.searchFields;
    if (form.pickerPlaceholder.trim().length > 0) cfg.pickerPlaceholder = form.pickerPlaceholder.trim();

    // Governance
    if (form.projectionMode !== "DEFAULT") {
        // Explicit governance choice — always store the mode
        cfg.projectionMode = form.projectionMode;
        if (form.projectionMode === "CUSTOM") {
            // Always store projectionFields for CUSTOM ([] = expose nothing)
            cfg.projectionFields = form.projectionFields;
        }
    }

    // If the only thing set is projectionMode DEFAULT (implicit), the config is empty
    return Object.keys(cfg).length > 0 ? cfg : null;
}
