/**
 * binding-form-helpers.ts
 *
 * Pure helpers for converting between a DB MasterFieldGraphBinding row and
 * the bindingForm state used in the admin UI.
 *
 * Extracted from field-detail-sheet.tsx so they can be unit-tested without
 * a component harness.
 */

import type { GraphPickerConfig } from "./picker-config";

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
};

// ── bindingToBindingForm ──────────────────────────────────────────────────────

/**
 * Converts a DB binding row into the bindingForm state shape.
 *
 * - Null strings become empty strings.
 * - null pickerConfig → all field arrays empty, placeholder empty.
 * - Unknown pickerConfig keys (should not exist after server sanitization)
 *   are silently ignored via the `?? []` defaults.
 */
export function bindingToBindingForm(b: BindingRow): BindingForm {
    const cfg = (b.pickerConfig ?? {}) as GraphPickerConfig;
    return {
        graphNodeType:    b.graphNodeType,
        filterEdgeType:   b.filterEdgeType   ?? "",
        filterActiveOnly: b.filterActiveOnly,
        writeBackEdgeType: b.writeBackEdgeType ?? "",
        writeBackIsActive: b.writeBackIsActive,
        pickerLabel:      b.pickerLabel       ?? "",
        allowCreate:      b.allowCreate,
        displayFields:    cfg.displayFields   ?? [],
        subFields:        cfg.subFields       ?? [],
        searchFields:     cfg.searchFields    ?? [],
        pickerPlaceholder: cfg.pickerPlaceholder ?? "",
    };
}

// ── bindingFormToPickerConfig ─────────────────────────────────────────────────

/**
 * Serialises the pickerConfig-related fields from a BindingForm into a
 * GraphPickerConfig payload (or null if nothing is configured).
 *
 * Empty arrays are omitted; blank placeholder is omitted.
 * The server's sanitizePickerConfig() is the authoritative validator —
 * this helper just does the minimal client-side pruning to avoid sending {}
 * when there is nothing configured.
 */
export function bindingFormToPickerConfig(form: BindingForm): GraphPickerConfig | null {
    const cfg: GraphPickerConfig = {};
    if (form.displayFields.length > 0)          cfg.displayFields     = form.displayFields;
    if (form.subFields.length > 0)              cfg.subFields         = form.subFields;
    if (form.searchFields.length > 0)           cfg.searchFields      = form.searchFields;
    if (form.pickerPlaceholder.trim().length > 0) cfg.pickerPlaceholder = form.pickerPlaceholder.trim();

    return Object.keys(cfg).length > 0 ? cfg : null;
}
