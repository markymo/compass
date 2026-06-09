/**
 * binding-form-helpers.test.ts
 *
 * Unit tests for the pure helpers that convert between a DB BindingRow
 * and the bindingForm state used in field-detail-sheet.tsx.
 *
 * Covers Phase 5.2 (edit mode) and Phase 5.3b (projectionMode / projectionFields).
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
    it("BFH-1e: projectionMode defaults to DEFAULT", () => {
        expect(bindingToBindingForm(makeRow()).projectionMode).toBe("DEFAULT");
    });
    it("BFH-1f: projectionFields is []", () => {
        expect(bindingToBindingForm(makeRow()).projectionFields).toEqual([]);
    });
});

// ── BFH-2: existing pickerConfig populates correctly ─────────────────────────

describe("bindingToBindingForm — existing pickerConfig (picker UX fields)", () => {
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
    it("BFH-2f: pickerConfig without projectionMode → form projectionMode DEFAULT", () => {
        expect(bindingToBindingForm(row).projectionMode).toBe("DEFAULT");
    });
    it("BFH-2g: pickerConfig without projectionFields → form projectionFields []", () => {
        expect(bindingToBindingForm(row).projectionFields).toEqual([]);
    });
});

// ── BFH-2 (Phase 5.3b): projectionMode population ────────────────────────────

describe("bindingToBindingForm — projectionMode (Phase 5.3b)", () => {
    it("BFH-2h: stored CUSTOM mode + projectionFields populated", () => {
        const row = makeRow({
            pickerConfig: {
                projectionMode: "CUSTOM",
                projectionFields: ["firstName", "lastName", "officerRole"],
            },
        });
        const form = bindingToBindingForm(row);
        expect(form.projectionMode).toBe("CUSTOM");
        expect(form.projectionFields).toEqual(["firstName", "lastName", "officerRole"]);
    });

    it("BFH-2i: stored NONE mode", () => {
        const row = makeRow({ pickerConfig: { projectionMode: "NONE" } });
        const form = bindingToBindingForm(row);
        expect(form.projectionMode).toBe("NONE");
        expect(form.projectionFields).toEqual([]);
    });

    it("BFH-2j: stored DEFAULT mode", () => {
        const row = makeRow({
            pickerConfig: { projectionMode: "DEFAULT", displayFields: ["firstName"] },
        });
        expect(bindingToBindingForm(row).projectionMode).toBe("DEFAULT");
    });

    it("BFH-2k: CUSTOM + empty projectionFields → form projectionMode CUSTOM, fields []", () => {
        const row = makeRow({
            pickerConfig: { projectionMode: "CUSTOM", projectionFields: [] },
        });
        const form = bindingToBindingForm(row);
        expect(form.projectionMode).toBe("CUSTOM");
        expect(form.projectionFields).toEqual([]);
    });
});

// ── BFH-3: bindingFormToPickerConfig — picker UX fields ──────────────────────

describe("bindingFormToPickerConfig — populated picker UX form", () => {
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

// ── BFH-3 (Phase 5.3b): projectionMode serialisation ─────────────────────────

describe("bindingFormToPickerConfig — projectionMode (Phase 5.3b)", () => {
    it("BFH-3f: projectionMode DEFAULT → not stored (null if no other config)", () => {
        const form: BindingForm = { ...BLANK_BINDING_FORM, projectionMode: "DEFAULT" };
        expect(bindingFormToPickerConfig(form)).toBeNull();
    });

    it("BFH-3g: projectionMode NONE → stored", () => {
        const form: BindingForm = { ...BLANK_BINDING_FORM, projectionMode: "NONE" };
        const result = bindingFormToPickerConfig(form);
        expect(result).not.toBeNull();
        expect(result?.projectionMode).toBe("NONE");
        expect(result?.projectionFields).toBeUndefined();
    });

    it("BFH-3h: projectionMode CUSTOM + fields → stored with projectionFields", () => {
        const form: BindingForm = {
            ...BLANK_BINDING_FORM,
            projectionMode: "CUSTOM",
            projectionFields: ["firstName", "officerRole"],
        };
        const result = bindingFormToPickerConfig(form);
        expect(result?.projectionMode).toBe("CUSTOM");
        expect(result?.projectionFields).toEqual(["firstName", "officerRole"]);
    });

    it("BFH-3i: projectionMode CUSTOM + empty projectionFields → stored with []", () => {
        // Empty CUSTOM = explicit expose-nothing — must be stored
        const form: BindingForm = {
            ...BLANK_BINDING_FORM,
            projectionMode: "CUSTOM",
            projectionFields: [],
        };
        const result = bindingFormToPickerConfig(form);
        expect(result?.projectionMode).toBe("CUSTOM");
        expect(result?.projectionFields).toEqual([]);
    });

    it("BFH-3j: projectionMode DEFAULT alongside picker UX config → DEFAULT NOT stored", () => {
        const form: BindingForm = {
            ...BLANK_BINDING_FORM,
            displayFields: ["firstName"],
            projectionMode: "DEFAULT",
        };
        const result = bindingFormToPickerConfig(form);
        expect(result?.displayFields).toEqual(["firstName"]);
        expect(result?.projectionMode).toBeUndefined();
    });
});

// ── BFH-4: bindingFormToPickerConfig — empty form → null ─────────────────────

describe("bindingFormToPickerConfig — empty form", () => {
    it("BFH-4a: all-empty form (DEFAULT mode) → null", () => {
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

// ── BFH-5: edit round-trip ────────────────────────────────────────────────────

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
        expect(form.graphNodeType).toBe("ADDRESS");
        expect(form.filterEdgeType).toBe("RESIDENT_AT");
        expect(form.filterActiveOnly).toBe(false);
        expect(form.writeBackEdgeType).toBe("RESIDENT_AT");
        expect(form.writeBackIsActive).toBe(false);
        expect(form.pickerLabel).toBe("Select address");
        expect(form.allowCreate).toBe(false);
        // id is NOT in BindingForm — kept separately as editingBindingId in state
        expect("id" in form).toBe(false);
    });

    it("BFH-5b: projectionMode CUSTOM round-trips through form and back", () => {
        const row = makeRow({
            pickerConfig: {
                projectionMode: "CUSTOM",
                projectionFields: ["firstName", "lastName", "primaryNationality"],
            },
        });
        const form = bindingToBindingForm(row);
        expect(form.projectionMode).toBe("CUSTOM");
        expect(form.projectionFields).toEqual(["firstName", "lastName", "primaryNationality"]);

        const config = bindingFormToPickerConfig(form);
        expect(config?.projectionMode).toBe("CUSTOM");
        expect(config?.projectionFields).toEqual(["firstName", "lastName", "primaryNationality"]);
    });

    it("BFH-5c: projectionMode NONE round-trips", () => {
        const row = makeRow({ pickerConfig: { projectionMode: "NONE" } });
        const form = bindingToBindingForm(row);
        const config = bindingFormToPickerConfig(form);
        expect(config?.projectionMode).toBe("NONE");
        expect(config?.projectionFields).toBeUndefined();
    });
});

// ── BFH-6: BLANK_BINDING_FORM ─────────────────────────────────────────────────

describe("BLANK_BINDING_FORM — add mode defaults", () => {
    it("BFH-6a: contains no id field", () => {
        expect("id" in BLANK_BINDING_FORM).toBe(false);
    });
    it("BFH-6b: correct scalar defaults", () => {
        expect(BLANK_BINDING_FORM.graphNodeType).toBe("PERSON");
        expect(BLANK_BINDING_FORM.filterActiveOnly).toBe(true);
        expect(BLANK_BINDING_FORM.allowCreate).toBe(true);
    });
    it("BFH-6c: projectionMode defaults to DEFAULT", () => {
        expect(BLANK_BINDING_FORM.projectionMode).toBe("DEFAULT");
    });
    it("BFH-6d: projectionFields defaults to []", () => {
        expect(BLANK_BINDING_FORM.projectionFields).toEqual([]);
    });
    it("BFH-6e: BLANK_BINDING_FORM → null config (DEFAULT = no explicit governance config)", () => {
        expect(bindingFormToPickerConfig(BLANK_BINDING_FORM)).toBeNull();
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
