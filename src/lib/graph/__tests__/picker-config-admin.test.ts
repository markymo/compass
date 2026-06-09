/**
 * picker-config-admin.test.ts
 *
 * Unit tests for Phase 5 pickerConfig admin form behaviour.
 *
 * Tests the logic that the FieldDetailSheet uses:
 *  - Registry-driven field lists for each node type
 *  - pickerConfig payload construction from form state
 *  - Non-searchable fields excluded from Search Fields list
 *  - Empty form state → null pickerConfig (nothing to save)
 *
 * These tests do NOT render the React component — they test
 * the pure logic that drives the UI.
 */

import { describe, it, expect } from "vitest";
import {
    getNodeFields,
    getDisplayableFields,
    getSearchableFields,
    type NodeType,
} from "../node-field-registry";
import { sanitizePickerConfig } from "../picker-config";

// ── Helpers that mirror the handleSaveBinding logic ────────────────────────────

/**
 * Build a pickerConfig payload from form state, exactly as handleSaveBinding does.
 * Returns null when no configuration has been set.
 */
function buildPickerConfigPayload(formState: {
    displayFields:     string[];
    subFields:         string[];
    searchFields:      string[];
    pickerPlaceholder: string;
}): Record<string, unknown> | null {
    const payload: Record<string, unknown> = {};
    if (formState.displayFields.length > 0)          payload.displayFields     = formState.displayFields;
    if (formState.subFields.length > 0)               payload.subFields          = formState.subFields;
    if (formState.searchFields.length > 0)            payload.searchFields       = formState.searchFields;
    if (formState.pickerPlaceholder.trim().length > 0) payload.pickerPlaceholder = formState.pickerPlaceholder.trim();
    return Object.keys(payload).length > 0 ? payload : null;
}

// ── Registry-driven field lists ────────────────────────────────────────────────

describe("PC-ADMIN: Registry-driven PERSON fields", () => {
    it("PA-7: PERSON displayable fields come from registry", () => {
        const fields = getDisplayableFields("PERSON");
        expect(fields.length).toBeGreaterThan(0);
        // All returned fields must belong to PERSON
        expect(fields.every(f => f.nodeType === "PERSON")).toBe(true);
        // All must be isDisplayable
        expect(fields.every(f => f.isDisplayable)).toBe(true);
        // Must include core person fields
        const keys = fields.map(f => f.fieldKey);
        expect(keys).toContain("firstName");
        expect(keys).toContain("lastName");
        expect(keys).toContain("primaryNationality");
    });

    it("PA-7b: PERSON searchable fields come from registry", () => {
        const fields = getSearchableFields("PERSON");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.nodeType === "PERSON")).toBe(true);
        expect(fields.every(f => f.isSearchable)).toBe(true);
        const keys = fields.map(f => f.fieldKey);
        expect(keys).toContain("firstName");
        expect(keys).toContain("lastName");
        expect(keys).toContain("officerRole");
        expect(keys).toContain("countryOfResidence");
    });

    it("PA-10: Non-searchable PERSON fields excluded from Search Fields list", () => {
        const searchableKeys = new Set(getSearchableFields("PERSON").map(f => f.fieldKey));
        // These must NOT appear in the search field list
        expect(searchableKeys.has("occupation")).toBe(false);   // not isSearchable
        expect(searchableKeys.has("dateOfBirth")).toBe(false);  // DATE type, not searchable
        expect(searchableKeys.has("middleName")).toBe(false);   // not searchable
        expect(searchableKeys.has("placeOfBirth")).toBe(false); // not searchable
        expect(searchableKeys.has("isPublicFigure")).toBe(false); // BOOLEAN, not searchable
    });

    it("PA-7c: PERSON fields sorted by order ascending", () => {
        const fields = getDisplayableFields("PERSON");
        for (let i = 1; i < fields.length; i++) {
            expect(fields[i].order).toBeGreaterThanOrEqual(fields[i - 1].order);
        }
    });
});

describe("PC-ADMIN: Registry-driven LEGAL_ENTITY fields", () => {
    it("PA-8: LEGAL_ENTITY displayable fields come from registry", () => {
        const fields = getDisplayableFields("LEGAL_ENTITY");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.nodeType === "LEGAL_ENTITY")).toBe(true);
        const keys = fields.map(f => f.fieldKey);
        expect(keys).toContain("name");
        expect(keys).toContain("localRegistrationNumber");
        expect(keys).toContain("jurisdiction");
        expect(keys).toContain("legalForm");
    });

    it("PA-8b: LEGAL_ENTITY searchable fields are a subset of displayable", () => {
        const searchable = getSearchableFields("LEGAL_ENTITY").map(f => f.fieldKey);
        expect(searchable).toContain("name");
        expect(searchable).toContain("localRegistrationNumber");
        expect(searchable).toContain("jurisdiction");
        expect(searchable).toContain("countryOfIncorporation");
        // Non-searchable fields excluded
        expect(searchable.includes("legalForm")).toBe(false);
        expect(searchable.includes("entityStatus")).toBe(false);
    });
});

describe("PC-ADMIN: Registry-driven ADDRESS fields", () => {
    it("PA-9: ADDRESS displayable fields come from registry", () => {
        const fields = getDisplayableFields("ADDRESS");
        expect(fields.length).toBeGreaterThan(0);
        const keys = fields.map(f => f.fieldKey);
        expect(keys).toContain("line1");
        expect(keys).toContain("city");
        expect(keys).toContain("country");
    });

    it("PA-9b: ADDRESS searchable fields: line1, city, country only", () => {
        const keys = getSearchableFields("ADDRESS").map(f => f.fieldKey);
        expect(keys).toContain("line1");
        expect(keys).toContain("city");
        expect(keys).toContain("country");
        // Non-searchable ADDRESS fields excluded
        expect(keys.includes("line2")).toBe(false);
        expect(keys.includes("region")).toBe(false);
        expect(keys.includes("postalCode")).toBe(false);
    });
});

// ── pickerConfig payload construction (mirrors handleSaveBinding) ──────────────

describe("PC-ADMIN: pickerConfig payload construction", () => {
    const emptyForm = {
        displayFields: [] as string[],
        subFields: [] as string[],
        searchFields: [] as string[],
        pickerPlaceholder: "",
    };

    it("PA-2: null pickerConfig when form is empty", () => {
        expect(buildPickerConfigPayload(emptyForm)).toBeNull();
    });

    it("PA-3: displayFields persisted when set", () => {
        const payload = buildPickerConfigPayload({
            ...emptyForm,
            displayFields: ["firstName", "lastName"],
        });
        expect(payload).not.toBeNull();
        expect(payload?.displayFields).toEqual(["firstName", "lastName"]);
    });

    it("PA-4: subFields persisted when set", () => {
        const payload = buildPickerConfigPayload({
            ...emptyForm,
            subFields: ["officerRole", "primaryNationality"],
        });
        expect(payload?.subFields).toEqual(["officerRole", "primaryNationality"]);
    });

    it("PA-5: searchFields persisted when set", () => {
        const payload = buildPickerConfigPayload({
            ...emptyForm,
            searchFields: ["countryOfResidence", "officerRole"],
        });
        expect(payload?.searchFields).toEqual(["countryOfResidence", "officerRole"]);
    });

    it("PA-6: placeholder persisted when set", () => {
        const payload = buildPickerConfigPayload({
            ...emptyForm,
            pickerPlaceholder: "  Search beneficiaries...  ",
        });
        expect(payload?.pickerPlaceholder).toBe("Search beneficiaries...");
    });

    it("PA-6b: whitespace-only placeholder → null payload", () => {
        expect(buildPickerConfigPayload({ ...emptyForm, pickerPlaceholder: "   " })).toBeNull();
    });

    it("PA-3+4+5+6: full payload includes all configured fields", () => {
        const payload = buildPickerConfigPayload({
            displayFields: ["firstName", "lastName"],
            subFields: ["officerRole"],
            searchFields: ["countryOfResidence"],
            pickerPlaceholder: "Select person",
        });
        expect(payload).toEqual({
            displayFields: ["firstName", "lastName"],
            subFields: ["officerRole"],
            searchFields: ["countryOfResidence"],
            pickerPlaceholder: "Select person",
        });
    });
});

// ── Server-side sanitization round-trip ───────────────────────────────────────

describe("PC-ADMIN: Server-side sanitization of admin-built payload", () => {
    it("PA-S1: admin PERSON payload survives sanitizePickerConfig round-trip", () => {
        const payload = buildPickerConfigPayload({
            displayFields: ["firstName", "lastName"],
            subFields: ["primaryNationality"],
            searchFields: ["officerRole", "countryOfResidence"],
            pickerPlaceholder: "Select person",
        });
        const sanitized = sanitizePickerConfig("PERSON", payload);
        expect(sanitized).not.toBeNull();
        expect(sanitized?.displayFields).toEqual(["firstName", "lastName"]);
        expect(sanitized?.subFields).toEqual(["primaryNationality"]);
        expect(sanitized?.searchFields).toEqual(["officerRole", "countryOfResidence"]);
        expect(sanitized?.pickerPlaceholder).toBe("Select person");
    });

    it("PA-S2: admin LEGAL_ENTITY payload survives sanitization", () => {
        const payload = buildPickerConfigPayload({
            displayFields: ["name", "jurisdiction"],
            subFields: ["legalForm", "entityStatus"],
            searchFields: ["name", "localRegistrationNumber"],
            pickerPlaceholder: "",
        });
        const sanitized = sanitizePickerConfig("LEGAL_ENTITY", payload);
        expect(sanitized?.displayFields).toEqual(["name", "jurisdiction"]);
        expect(sanitized?.searchFields).toEqual(["name", "localRegistrationNumber"]);
    });

    it("PA-S3: admin ADDRESS payload survives sanitization", () => {
        const payload = buildPickerConfigPayload({
            displayFields: ["line1", "city"],
            subFields: ["postalCode", "country"],
            searchFields: ["city", "country"],
            pickerPlaceholder: "Select address",
        });
        const sanitized = sanitizePickerConfig("ADDRESS", payload);
        expect(sanitized?.displayFields).toEqual(["line1", "city"]);
        expect(sanitized?.searchFields).toEqual(["city", "country"]);
    });

    it("PA-S4: null payload → sanitizePickerConfig returns null", () => {
        expect(sanitizePickerConfig("PERSON", null)).toBeNull();
    });

    it("PA-PA-1: empty form state → null payload → server stores null", () => {
        const payload = buildPickerConfigPayload({
            displayFields: [], subFields: [], searchFields: [], pickerPlaceholder: "",
        });
        expect(payload).toBeNull();
        expect(sanitizePickerConfig("PERSON", payload)).toBeNull();
    });
});
