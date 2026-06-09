/**
 * picker-config.test.ts
 *
 * Unit tests for sanitizePickerConfig() and isEmptyPickerConfig().
 */

import { describe, it, expect } from "vitest";
import { sanitizePickerConfig, isEmptyPickerConfig, type GraphPickerConfig } from "../picker-config";

// ── sanitizePickerConfig ──────────────────────────────────────────────────────

describe("sanitizePickerConfig — null / non-object input", () => {
    it("null → null", () => {
        expect(sanitizePickerConfig("PERSON", null)).toBeNull();
    });

    it("undefined → null", () => {
        expect(sanitizePickerConfig("PERSON", undefined)).toBeNull();
    });

    it("string → null", () => {
        expect(sanitizePickerConfig("PERSON", "firstName")).toBeNull();
    });

    it("number → null", () => {
        expect(sanitizePickerConfig("PERSON", 42)).toBeNull();
    });

    it("array → null", () => {
        expect(sanitizePickerConfig("PERSON", ["firstName"])).toBeNull();
    });

    it("empty object → null", () => {
        expect(sanitizePickerConfig("PERSON", {})).toBeNull();
    });
});

describe("sanitizePickerConfig — PERSON displayFields", () => {
    it("valid PERSON displayFields are retained", () => {
        const result = sanitizePickerConfig("PERSON", { displayFields: ["firstName", "lastName"] });
        expect(result).not.toBeNull();
        expect(result?.displayFields).toEqual(["firstName", "lastName"]);
    });

    it("invalid PERSON displayFields are removed", () => {
        // "email" and "unknownField" are not in the registry
        const result = sanitizePickerConfig("PERSON", {
            displayFields: ["firstName", "email", "unknownField"],
        });
        expect(result?.displayFields).toEqual(["firstName"]);
    });

    it("entirely invalid displayFields → field omitted", () => {
        const result = sanitizePickerConfig("PERSON", { displayFields: ["email", "phone"] });
        expect(result).toBeNull(); // nothing left → null
    });

    it("empty displayFields array → field omitted (not stored as [])", () => {
        const result = sanitizePickerConfig("PERSON", { displayFields: [] });
        expect(result).toBeNull();
    });
});

describe("sanitizePickerConfig — PERSON subFields", () => {
    it("valid PERSON subFields are retained", () => {
        const result = sanitizePickerConfig("PERSON", { subFields: ["primaryNationality"] });
        expect(result?.subFields).toEqual(["primaryNationality"]);
    });

    it("invalid PERSON subFields are removed", () => {
        const result = sanitizePickerConfig("PERSON", { subFields: ["primaryNationality", "bogusField"] });
        expect(result?.subFields).toEqual(["primaryNationality"]);
    });

    it("non-displayable PERSON fields are removed from subFields", () => {
        // All current PERSON fields are displayable — test with a made-up key
        const result = sanitizePickerConfig("PERSON", { subFields: ["nonExistent"] });
        expect(result).toBeNull();
    });
});

describe("sanitizePickerConfig — PERSON searchFields", () => {
    it("searchable PERSON field is retained in searchFields", () => {
        const result = sanitizePickerConfig("PERSON", { searchFields: ["firstName", "lastName"] });
        expect(result?.searchFields).toEqual(["firstName", "lastName"]);
    });

    it("non-searchable PERSON fields are removed from searchFields", () => {
        // dateOfBirth, occupation, title, middleName, placeOfBirth, isPublicFigure are NOT searchable
        const result = sanitizePickerConfig("PERSON", {
            searchFields: ["firstName", "dateOfBirth", "occupation", "isPublicFigure"],
        });
        expect(result?.searchFields).toEqual(["firstName"]);
    });

    it("entirely non-searchable searchFields → field omitted", () => {
        const result = sanitizePickerConfig("PERSON", {
            searchFields: ["dateOfBirth", "middleName"],
        });
        expect(result).toBeNull();
    });

    it("new searchable fields countryOfResidence and officerRole are accepted", () => {
        const result = sanitizePickerConfig("PERSON", {
            searchFields: ["countryOfResidence", "officerRole", "firstName"],
        });
        expect(result?.searchFields).toEqual(["countryOfResidence", "officerRole", "firstName"]);
    });
});

describe("sanitizePickerConfig — pickerPlaceholder", () => {
    it("valid placeholder is trimmed and retained", () => {
        const result = sanitizePickerConfig("PERSON", { pickerPlaceholder: "  Select a person  " });
        expect(result?.pickerPlaceholder).toBe("Select a person");
    });

    it("empty string placeholder → field omitted", () => {
        const result = sanitizePickerConfig("PERSON", { pickerPlaceholder: "" });
        expect(result).toBeNull();
    });

    it("whitespace-only placeholder → field omitted", () => {
        const result = sanitizePickerConfig("PERSON", { pickerPlaceholder: "   " });
        expect(result).toBeNull();
    });
});

describe("sanitizePickerConfig — LEGAL_ENTITY fields", () => {
    it("valid LEGAL_ENTITY displayFields are retained", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", {
            displayFields: ["name", "localRegistrationNumber"],
        });
        expect(result?.displayFields).toEqual(["name", "localRegistrationNumber"]);
    });

    it("new LEGAL_ENTITY fields jurisdiction and legalForm are accepted as displayFields", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", {
            displayFields: ["name", "jurisdiction", "legalForm"],
        });
        expect(result?.displayFields).toEqual(["name", "jurisdiction", "legalForm"]);
    });

    it("valid LEGAL_ENTITY searchFields: name, localRegistrationNumber, jurisdiction, countryOfIncorporation", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", {
            searchFields: ["name", "localRegistrationNumber", "jurisdiction", "countryOfIncorporation"],
        });
        expect(result?.searchFields).toHaveLength(4);
    });

    it("non-searchable LE fields removed from searchFields: legalForm, entityStatus", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", {
            searchFields: ["name", "legalForm", "entityStatus"],
        });
        expect(result?.searchFields).toEqual(["name"]);
    });

    it("PERSON fieldKey is rejected for LEGAL_ENTITY config", () => {
        // firstName is a valid PERSON key but not a LEGAL_ENTITY key
        const result = sanitizePickerConfig("LEGAL_ENTITY", { displayFields: ["firstName"] });
        expect(result).toBeNull();
    });
});

describe("sanitizePickerConfig — ADDRESS fields", () => {
    it("valid ADDRESS displayFields are retained", () => {
        const result = sanitizePickerConfig("ADDRESS", {
            displayFields: ["line1", "city", "country"],
        });
        expect(result?.displayFields).toEqual(["line1", "city", "country"]);
    });

    it("ADDRESS searchFields: line1, city, country are searchable", () => {
        const result = sanitizePickerConfig("ADDRESS", {
            searchFields: ["line1", "city", "country"],
        });
        expect(result?.searchFields).toEqual(["line1", "city", "country"]);
    });

    it("ADDRESS non-searchable fields removed from searchFields: line2, region, postalCode", () => {
        const result = sanitizePickerConfig("ADDRESS", {
            searchFields: ["line1", "line2", "region", "postalCode"],
        });
        expect(result?.searchFields).toEqual(["line1"]);
    });

    it("LEGAL_ENTITY fieldKey rejected for ADDRESS config", () => {
        const result = sanitizePickerConfig("ADDRESS", { displayFields: ["name"] });
        expect(result).toBeNull();
    });
});

describe("sanitizePickerConfig — combined / edge cases", () => {
    it("config with multiple valid fields returns all of them", () => {
        const result = sanitizePickerConfig("PERSON", {
            displayFields:     ["firstName", "lastName"],
            subFields:         ["primaryNationality"],
            searchFields:      ["firstName", "lastName"],
            pickerPlaceholder: "Select person",
        });
        expect(result).toEqual({
            displayFields:     ["firstName", "lastName"],
            subFields:         ["primaryNationality"],
            searchFields:      ["firstName", "lastName"],
            pickerPlaceholder: "Select person",
        });
    });

    it("extra unknown top-level keys are ignored", () => {
        const result = sanitizePickerConfig("PERSON", {
            displayFields: ["firstName"],
            unknownKey:    "should be ignored",
            anotherBadKey: 42,
        } as any);
        expect(result).toEqual({ displayFields: ["firstName"] });
        expect(result).not.toHaveProperty("unknownKey");
    });

    it("partially valid config — invalid fields stripped, valid retained", () => {
        const result = sanitizePickerConfig("PERSON", {
            displayFields: ["firstName", "badField"],
            searchFields:  ["lastName", "dateOfBirth"], // dateOfBirth not searchable
        });
        expect(result).toEqual({
            displayFields: ["firstName"],
            searchFields:  ["lastName"],
        });
    });
});

// ── isEmptyPickerConfig ───────────────────────────────────────────────────────

describe("isEmptyPickerConfig", () => {
    it("empty object → true", () => {
        expect(isEmptyPickerConfig({})).toBe(true);
    });

    it("empty arrays → true", () => {
        expect(isEmptyPickerConfig({ displayFields: [], subFields: [], searchFields: [] })).toBe(true);
    });

    it("whitespace-only placeholder → true", () => {
        expect(isEmptyPickerConfig({ pickerPlaceholder: "   " })).toBe(true);
    });

    it("non-empty displayFields → false", () => {
        expect(isEmptyPickerConfig({ displayFields: ["firstName"] })).toBe(false);
    });

    it("non-empty placeholder → false", () => {
        expect(isEmptyPickerConfig({ pickerPlaceholder: "Select" })).toBe(false);
    });
});
