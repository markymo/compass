/**
 * binding-form-helpers.test.ts
 *
 * Unit tests for the pure helpers that convert between a DB BindingRow
 * and the bindingForm state used in field-detail-sheet.tsx.
 *
 * Tests are grouped to match the Phase 5.2 requirements:
 *   BFH-1  null pickerConfig → empty form arrays
 *   BFH-2  existing pickerConfig populates displayFields/subFields/searchFields/placeholder
 *   BFH-3  bindingFormToPickerConfig — populated form serialises correctly
 *   BFH-4  bindingFormToPickerConfig — empty form → null
 *   BFH-5  edit payload includes binding id (verified via bindingToBindingForm round-trip)
 *   BFH-6  add payload has no id (verified by BLANK_BINDING_FORM shape)
 *   BFH-7  string fields: null DB values → empty strings in form
 *   BFH-8  boolean fields: preserved from DB row
 */

import { describe, it, expect } from "vitest";
import {
    bindingToBindingForm,
    bindingFormToPickerConfig,
    BLANK_BINDING_FORM,
    type BindingRow,
    type BindingForm,
} from "../binding-form-helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<BindingRow> = {}): BindingRow {
    return {
        id: "binding-1",
        graphNodeType: "PERSON",
        filterEdgeType: null,
        filterActiveOnly: true,
        writeBackEdgeType: null,
        writeBackIsActive: true,
        pickerLabel: null,
        allowCreate: true,
        pickerConfig: null,
        ...overrides,
    };
}

// ── BFH-1: null pickerConfig → empty arrays ───────────────────────────────────

describe("bindingToBindingForm — null pickerConfig", () => {
    it("BFH-1a: displayFields is []", () => {
        expect(bindingToBindingForm(makeRow()).displayFields).toEqual([]);
    });
    it("BFH-1b: subFields is []", () => {
        expect(bindingToBindingForm(makeRow()).subFields).toEqual([]);
    });
    it("BFH-1c: searchFields is []", () => {
        expect(bindingToBindingForm(makeRow()).searchFields).toEqual([]);
    });
    it("BFH-1d: pickerPlaceholder is ''", () => {
        expect(bindingToBindingForm(makeRow()).pickerPlaceholder).toBe("");
    });
});

// ── BFH-2: existing pickerConfig populates correctly ─────────────────────────

describe("bindingToBindingForm — existing pickerConfig", () => {
    const row = makeRow({
        pickerConfig: {
            displayFields: ["firstName", "lastName"],
            subFields: ["officerRole"],
            searchFields: ["primaryNationality", "officerRole"],
            pickerPlaceholder: "Search directors...",
        },
    });

    it("BFH-2a: displayFields populated", () => {
        expect(bindingToBindingForm(row).displayFields).toEqual(["firstName", "lastName"]);
    });
    it("BFH-2b: subFields populated", () => {
        expect(bindingToBindingForm(row).subFields).toEqual(["officerRole"]);
    });
    it("BFH-2c: searchFields populated", () => {
        expect(bindingToBindingForm(row).searchFields).toEqual(["primaryNationality", "officerRole"]);
    });
    it("BFH-2d: pickerPlaceholder populated", () => {
        expect(bindingToBindingForm(row).pickerPlaceholder).toBe("Search directors...");
    });
    it("BFH-2e: non-pickerConfig fields still mapped", () => {
        const r = makeRow({ graphNodeType: "LEGAL_ENTITY", filterEdgeType: "DIRECTOR", pickerLabel: "Select Director" });
        const form = bindingToBindingForm(r);
        expect(form.graphNodeType).toBe("LEGAL_ENTITY");
        expect(form.filterEdgeType).toBe("DIRECTOR");
        expect(form.pickerLabel).toBe("Select Director");
    });
});

// ── BFH-3: bindingFormToPickerConfig — populated form serialises correctly ────

describe("bindingFormToPickerConfig — populated form", () => {
    const form: BindingForm = {
        ...BLANK_BINDING_FORM,
        displayFields: ["firstName", "lastName"],
        subFields: ["officerRole"],
        searchFields: ["primaryNationality"],
        pickerPlaceholder: "Search people...",
    };

    it("BFH-3a: displayFields present", () => {
        expect(bindingFormToPickerConfig(form)?.displayFields).toEqual(["firstName", "lastName"]);
    });
    it("BFH-3b: subFields present", () => {
        expect(bindingFormToPickerConfig(form)?.subFields).toEqual(["officerRole"]);
    });
    it("BFH-3c: searchFields present", () => {
        expect(bindingFormToPickerConfig(form)?.searchFields).toEqual(["primaryNationality"]);
    });
    it("BFH-3d: pickerPlaceholder present", () => {
        expect(bindingFormToPickerConfig(form)?.pickerPlaceholder).toBe("Search people...");
    });
    it("BFH-3e: non-null result", () => {
        expect(bindingFormToPickerConfig(form)).not.toBeNull();
    });
});

// ── BFH-4: bindingFormToPickerConfig — empty form → null ─────────────────────

describe("bindingFormToPickerConfig — empty form", () => {
    it("BFH-4a: all-empty form → null", () => {
        expect(bindingFormToPickerConfig(BLANK_BINDING_FORM)).toBeNull();
    });
    it("BFH-4b: blank pickerPlaceholder (whitespace only) → null", () => {
        const form = { ...BLANK_BINDING_FORM, pickerPlaceholder: "   " };
        expect(bindingFormToPickerConfig(form)).toBeNull();
    });
    it("BFH-4c: empty arrays but non-empty placeholder → non-null", () => {
        const form = { ...BLANK_BINDING_FORM, pickerPlaceholder: "Search..." };
        expect(bindingFormToPickerConfig(form)).not.toBeNull();
        expect(bindingFormToPickerConfig(form)?.pickerPlaceholder).toBe("Search...");
    });
});

// ── BFH-5: edit round-trip — binding id is preserved by caller ───────────────

describe("edit round-trip contract", () => {
    it("BFH-5: bindingToBindingForm preserves all scalar fields for edit payload", () => {
        const row = makeRow({
            id: "test-binding-id",
            graphNodeType: "ADDRESS",
            filterEdgeType: "RESIDENT_AT",
            filterActiveOnly: false,
            writeBackEdgeType: "RESIDENT_AT",
            writeBackIsActive: false,
            pickerLabel: "Select address",
            allowCreate: false,
        });
        const form = bindingToBindingForm(row);
        // All editable fields round-trip correctly
        expect(form.graphNodeType).toBe("ADDRESS");
        expect(form.filterEdgeType).toBe("RESIDENT_AT");
        expect(form.filterActiveOnly).toBe(false);
        expect(form.writeBackEdgeType).toBe("RESIDENT_AT");
        expect(form.writeBackIsActive).toBe(false);
        expect(form.pickerLabel).toBe("Select address");
        expect(form.allowCreate).toBe(false);
        // id is NOT in BindingForm — it is kept separately as editingBindingId in state
        expect("id" in form).toBe(false);
    });
});

// ── BFH-6: add payload has no id ─────────────────────────────────────────────

describe("BLANK_BINDING_FORM — add mode", () => {
    it("BFH-6: BLANK_BINDING_FORM contains no id field", () => {
        expect("id" in BLANK_BINDING_FORM).toBe(false);
    });
    it("BFH-6b: BLANK_BINDING_FORM has correct defaults", () => {
        expect(BLANK_BINDING_FORM.graphNodeType).toBe("PERSON");
        expect(BLANK_BINDING_FORM.filterActiveOnly).toBe(true);
        expect(BLANK_BINDING_FORM.allowCreate).toBe(true);
        expect(BLANK_BINDING_FORM.displayFields).toEqual([]);
    });
});

// ── BFH-7: null DB strings → empty strings ────────────────────────────────────

describe("bindingToBindingForm — null string fields", () => {
    it("BFH-7a: null filterEdgeType → ''", () => {
        expect(bindingToBindingForm(makeRow({ filterEdgeType: null })).filterEdgeType).toBe("");
    });
    it("BFH-7b: null writeBackEdgeType → ''", () => {
        expect(bindingToBindingForm(makeRow({ writeBackEdgeType: null })).writeBackEdgeType).toBe("");
    });
    it("BFH-7c: null pickerLabel → ''", () => {
        expect(bindingToBindingForm(makeRow({ pickerLabel: null })).pickerLabel).toBe("");
    });
});

// ── BFH-8: boolean fields preserved ──────────────────────────────────────────

describe("bindingToBindingForm — boolean fields", () => {
    it("BFH-8a: filterActiveOnly=false preserved", () => {
        expect(bindingToBindingForm(makeRow({ filterActiveOnly: false })).filterActiveOnly).toBe(false);
    });
    it("BFH-8b: allowCreate=false preserved", () => {
        expect(bindingToBindingForm(makeRow({ allowCreate: false })).allowCreate).toBe(false);
    });
    it("BFH-8c: writeBackIsActive=false preserved", () => {
        expect(bindingToBindingForm(makeRow({ writeBackIsActive: false })).writeBackIsActive).toBe(false);
    });
});

// ── Phase 5.3 — projectionFields ─────────────────────────────────────────────

describe("bindingToBindingForm — projectionFields (Phase 5.3)", () => {
    it("BFH-1e: null pickerConfig → projectionFields is []", () => {
        expect(bindingToBindingForm(makeRow()).projectionFields).toEqual([]);
    });
    it("BFH-2f: existing projectionFields populated from pickerConfig", () => {
        const row = makeRow({
            pickerConfig: {
                displayFields: ["firstName", "lastName"],
                projectionFields: ["firstName", "lastName", "officerRole", "primaryNationality"],
            },
        });
        expect(bindingToBindingForm(row).projectionFields).toEqual([
            "firstName", "lastName", "officerRole", "primaryNationality",
        ]);
    });
    it("BFH-2g: pickerConfig without projectionFields → projectionFields is []", () => {
        const row = makeRow({
            pickerConfig: { displayFields: ["firstName"] },
        });
        expect(bindingToBindingForm(row).projectionFields).toEqual([]);
    });
});

describe("bindingFormToPickerConfig — projectionFields (Phase 5.3)", () => {
    it("BFH-3f: populated projectionFields serialises correctly", () => {
        const form: BindingForm = {
            ...BLANK_BINDING_FORM,
            projectionFields: ["firstName", "lastName", "officerRole"],
        };
        expect(bindingFormToPickerConfig(form)?.projectionFields).toEqual([
            "firstName", "lastName", "officerRole",
        ]);
    });
    it("BFH-3g: form with only projectionFields → non-null result", () => {
        const form = { ...BLANK_BINDING_FORM, projectionFields: ["firstName"] };
        const result = bindingFormToPickerConfig(form);
        expect(result).not.toBeNull();
        expect(result?.projectionFields).toEqual(["firstName"]);
        // No other keys set
        expect(result?.displayFields).toBeUndefined();
        expect(result?.searchFields).toBeUndefined();
    });
    it("BFH-4d: form with empty projectionFields still → null (no other config)", () => {
        // Empty projectionFields alone should not produce a non-null config
        const form = { ...BLANK_BINDING_FORM };
        expect(bindingFormToPickerConfig(form)).toBeNull();
    });
});

describe("BLANK_BINDING_FORM — projectionFields default (Phase 5.3)", () => {
    it("BFH-6c: BLANK_BINDING_FORM has projectionFields: []", () => {
        expect(BLANK_BINDING_FORM.projectionFields).toEqual([]);
    });
});

