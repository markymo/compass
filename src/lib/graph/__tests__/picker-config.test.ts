/**
 * picker-config.test.ts
 *
 * Unit tests for sanitizePickerConfig, isEmptyPickerConfig,
 * getDefaultProjectionFields, and resolveProjectionFields.
 *
 * Phase 5.3b adds: ProjectionMode, getDefaultProjectionFields, resolveProjectionFields.
 */

import { describe, it, expect } from "vitest";
import {
    sanitizePickerConfig,
    isEmptyPickerConfig,
    getDefaultProjectionFields,
    resolveProjectionFields,
    type GraphPickerConfig,
} from "../picker-config";

// ── sanitizePickerConfig — null / non-object input ────────────────────────────

describe("sanitizePickerConfig — null / non-object input", () => {
    it("null → null",      () => expect(sanitizePickerConfig("PERSON", null)).toBeNull());
    it("undefined → null", () => expect(sanitizePickerConfig("PERSON", undefined)).toBeNull());
    it("string → null",    () => expect(sanitizePickerConfig("PERSON", "foo")).toBeNull());
    it("number → null",    () => expect(sanitizePickerConfig("PERSON", 42)).toBeNull());
    it("array → null",     () => expect(sanitizePickerConfig("PERSON", [])).toBeNull());
    it("empty object → null", () => expect(sanitizePickerConfig("PERSON", {})).toBeNull());
});

// ── sanitizePickerConfig — PERSON displayFields ───────────────────────────────

describe("sanitizePickerConfig — PERSON displayFields", () => {
    it("valid PERSON displayFields are retained", () => {
        const result = sanitizePickerConfig("PERSON", { displayFields: ["firstName", "lastName"] });
        expect(result?.displayFields).toEqual(["firstName", "lastName"]);
    });

    it("unknown displayField keys are stripped", () => {
        const result = sanitizePickerConfig("PERSON", { displayFields: ["firstName", "badKey"] });
        expect(result?.displayFields).toEqual(["firstName"]);
    });

    it("all-invalid displayFields → displayFields absent", () => {
        const result = sanitizePickerConfig("PERSON", {
            displayFields: ["badKey1", "badKey2"],
            subFields: ["firstName"],
        });
        expect(result?.displayFields).toBeUndefined();
        expect(result?.subFields).toEqual(["firstName"]);
    });

    it("LEGAL_ENTITY displayFields accept LE-specific keys", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", { displayFields: ["name", "jurisdiction"] });
        expect(result?.displayFields).toEqual(["name", "jurisdiction"]);
    });

    it("LEGAL_ENTITY does not accept PERSON-specific keys", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", { displayFields: ["firstName", "name"] });
        expect(result?.displayFields).toEqual(["name"]);
    });

    it("ADDRESS displayFields accept address keys", () => {
        const result = sanitizePickerConfig("ADDRESS", { displayFields: ["line1", "postalCode"] });
        expect(result?.displayFields).toEqual(["line1", "postalCode"]);
    });
});

// ── sanitizePickerConfig — subFields ──────────────────────────────────────────

describe("sanitizePickerConfig — subFields", () => {
    it("valid subFields retained", () => {
        const result = sanitizePickerConfig("PERSON", { subFields: ["officerRole"] });
        expect(result?.subFields).toEqual(["officerRole"]);
    });

    it("non-displayable keys stripped from subFields", () => {
        const result = sanitizePickerConfig("PERSON", { subFields: ["badKey", "lastName"] });
        expect(result?.subFields).toEqual(["lastName"]);
    });

    it("all-invalid subFields → null (no other config)", () => {
        const result = sanitizePickerConfig("PERSON", { subFields: ["bad1", "bad2"] });
        expect(result).toBeNull();
    });
});

// ── sanitizePickerConfig — searchFields ───────────────────────────────────────

describe("sanitizePickerConfig — searchFields", () => {
    it("searchable keys are retained", () => {
        const result = sanitizePickerConfig("PERSON", { searchFields: ["firstName", "lastName"] });
        expect(result?.searchFields).toEqual(["firstName", "lastName"]);
    });

    it("non-searchable keys are stripped", () => {
        // dateOfBirth is displayable but typically not searchable — check actual registry
        const result = sanitizePickerConfig("PERSON", { searchFields: ["firstName", "badKey"] });
        expect(result?.searchFields).toEqual(["firstName"]);
    });
});

// ── sanitizePickerConfig — pickerPlaceholder ──────────────────────────────────

describe("sanitizePickerConfig — pickerPlaceholder", () => {
    it("placeholder is trimmed and stored", () => {
        const result = sanitizePickerConfig("PERSON", { pickerPlaceholder: "  Search...  " });
        expect(result?.pickerPlaceholder).toBe("Search...");
    });

    it("empty placeholder → null (no other config)", () => {
        const result = sanitizePickerConfig("PERSON", { pickerPlaceholder: "" });
        expect(result).toBeNull();
    });

    it("whitespace-only placeholder → null", () => {
        const result = sanitizePickerConfig("PERSON", { pickerPlaceholder: "   " });
        expect(result).toBeNull();
    });
});

// ── sanitizePickerConfig — projectionMode ─────────────────────────────────────

describe("sanitizePickerConfig — projectionMode (Phase 5.3b)", () => {
    it("DEFAULT mode is stored", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "DEFAULT",
            displayFields: ["firstName"],
        });
        expect(result?.projectionMode).toBe("DEFAULT");
    });

    it("NONE mode alone → stored (explicit choice)", () => {
        const result = sanitizePickerConfig("PERSON", { projectionMode: "NONE" });
        expect(result).not.toBeNull();
        expect(result?.projectionMode).toBe("NONE");
    });

    it("CUSTOM mode alone with empty projectionFields → stored (explicit choice)", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "CUSTOM",
            projectionFields: [],
        });
        expect(result).not.toBeNull();
        expect(result?.projectionMode).toBe("CUSTOM");
        expect(result?.projectionFields).toEqual([]);
    });

    it("invalid projectionMode is stripped", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "INVALID_VALUE" as any,
            displayFields: ["firstName"],
        });
        expect(result?.projectionMode).toBeUndefined();
        expect(result?.displayFields).toEqual(["firstName"]);
    });

    it("missing projectionMode → omitted (resolver will default to DEFAULT)", () => {
        const result = sanitizePickerConfig("PERSON", { displayFields: ["firstName"] });
        expect(result?.projectionMode).toBeUndefined();
    });

    it("projectionMode DEFAULT with no other config → null (same as no config)", () => {
        // DEFAULT is the implicit absence — no point storing it alone
        const result = sanitizePickerConfig("PERSON", { projectionMode: "DEFAULT" });
        expect(result).toBeNull();
    });
});

// ── sanitizePickerConfig — projectionFields ───────────────────────────────────

describe("sanitizePickerConfig — projectionFields (Phase 5.3b)", () => {
    it("CUSTOM: valid projectionFields retained", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "CUSTOM",
            projectionFields: ["firstName", "lastName", "officerRole", "primaryNationality"],
        });
        expect(result?.projectionFields).toEqual(["firstName", "lastName", "officerRole", "primaryNationality"]);
    });

    it("CUSTOM: invalid fieldKeys stripped", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "CUSTOM",
            projectionFields: ["firstName", "invalidKey", "badKey"],
        });
        expect(result?.projectionFields).toEqual(["firstName"]);
    });

    it("CUSTOM: cross-node-type keys stripped (LE key used with PERSON)", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "CUSTOM",
            projectionFields: ["firstName", "name", "legalForm"],
        });
        expect(result?.projectionFields).toEqual(["firstName"]);
    });

    it("CUSTOM: empty projectionFields kept (explicit expose-nothing)", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "CUSTOM",
            projectionFields: [],
        });
        // CUSTOM + [] is an explicit governance choice — must be stored
        expect(result).not.toBeNull();
        expect(result?.projectionMode).toBe("CUSTOM");
        expect(result?.projectionFields).toEqual([]);
    });

    it("NONE: projectionFields ignored (not stored)", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "NONE",
            projectionFields: ["firstName"],
        });
        // projectionFields only meaningful for CUSTOM
        expect(result?.projectionMode).toBe("NONE");
        expect(result?.projectionFields).toBeUndefined();
    });

    it("DEFAULT: projectionFields ignored (not stored)", () => {
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "DEFAULT",
            projectionFields: ["firstName"],
            displayFields: ["firstName"], // need something else to make config non-null
        });
        expect(result?.projectionFields).toBeUndefined();
    });

    it("no projectionMode: projectionFields ignored (DEFAULT context)", () => {
        // projectionFields without a mode should not be stored
        const result = sanitizePickerConfig("PERSON", {
            projectionFields: ["firstName"],
            displayFields: ["firstName"],
        });
        expect(result?.projectionFields).toBeUndefined();
    });

    it("CUSTOM: LEGAL_ENTITY valid keys retained", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", {
            projectionMode: "CUSTOM",
            projectionFields: ["name", "jurisdiction", "legalForm"],
        });
        expect(result?.projectionFields).toContain("name");
        expect(result?.projectionFields).toContain("jurisdiction");
    });
});

// ── getDefaultProjectionFields ────────────────────────────────────────────────

describe("getDefaultProjectionFields (Phase 5.3b)", () => {
    it("PERSON defaults: firstName, lastName", () => {
        expect(getDefaultProjectionFields("PERSON")).toEqual(["firstName", "lastName"]);
    });

    it("LEGAL_ENTITY defaults: name", () => {
        expect(getDefaultProjectionFields("LEGAL_ENTITY")).toEqual(["name"]);
    });

    it("ADDRESS defaults: line1, postalCode", () => {
        expect(getDefaultProjectionFields("ADDRESS")).toEqual(["line1", "postalCode"]);
    });

    it("PERSON defaults are valid registry fieldKeys", () => {
        // Smoke test — if these keys are wrong the registry would reject them
        const result = sanitizePickerConfig("PERSON", {
            projectionMode: "CUSTOM",
            projectionFields: getDefaultProjectionFields("PERSON"),
        });
        expect(result?.projectionFields).toEqual(getDefaultProjectionFields("PERSON"));
    });

    it("LEGAL_ENTITY defaults are valid registry fieldKeys", () => {
        const result = sanitizePickerConfig("LEGAL_ENTITY", {
            projectionMode: "CUSTOM",
            projectionFields: getDefaultProjectionFields("LEGAL_ENTITY"),
        });
        expect(result?.projectionFields).toContain("name");
    });

    it("ADDRESS defaults are valid registry fieldKeys", () => {
        const result = sanitizePickerConfig("ADDRESS", {
            projectionMode: "CUSTOM",
            projectionFields: getDefaultProjectionFields("ADDRESS"),
        });
        expect(result?.projectionFields).toEqual(expect.arrayContaining(["line1", "postalCode"]));
    });
});

// ── resolveProjectionFields ───────────────────────────────────────────────────

describe("resolveProjectionFields (Phase 5.3b)", () => {
    it("null config → DEFAULT fields", () => {
        expect(resolveProjectionFields("PERSON", null)).toEqual(["firstName", "lastName"]);
    });

    it("undefined config → DEFAULT fields", () => {
        expect(resolveProjectionFields("LEGAL_ENTITY", undefined)).toEqual(["name"]);
    });

    it("config without projectionMode → DEFAULT fields (fail-safe)", () => {
        const cfg: GraphPickerConfig = { displayFields: ["firstName"] };
        expect(resolveProjectionFields("PERSON", cfg)).toEqual(["firstName", "lastName"]);
    });

    it("projectionMode DEFAULT → DEFAULT fields (ignores projectionFields)", () => {
        const cfg: GraphPickerConfig = {
            projectionMode: "DEFAULT",
            projectionFields: ["officerRole", "occupation"], // should be ignored
        };
        expect(resolveProjectionFields("PERSON", cfg)).toEqual(["firstName", "lastName"]);
    });

    it("projectionMode NONE → []", () => {
        const cfg: GraphPickerConfig = { projectionMode: "NONE" };
        expect(resolveProjectionFields("PERSON", cfg)).toEqual([]);
    });

    it("projectionMode CUSTOM with fields → those fields", () => {
        const cfg: GraphPickerConfig = {
            projectionMode: "CUSTOM",
            projectionFields: ["firstName", "officerRole", "primaryNationality"],
        };
        expect(resolveProjectionFields("PERSON", cfg)).toEqual([
            "firstName", "officerRole", "primaryNationality",
        ]);
    });

    it("projectionMode CUSTOM with empty projectionFields → [] (explicit expose-nothing)", () => {
        const cfg: GraphPickerConfig = {
            projectionMode: "CUSTOM",
            projectionFields: [],
        };
        expect(resolveProjectionFields("PERSON", cfg)).toEqual([]);
    });

    it("projectionMode CUSTOM with missing projectionFields → []", () => {
        const cfg: GraphPickerConfig = { projectionMode: "CUSTOM" };
        expect(resolveProjectionFields("PERSON", cfg)).toEqual([]);
    });

    it("LEGAL_ENTITY NONE → []", () => {
        expect(resolveProjectionFields("LEGAL_ENTITY", { projectionMode: "NONE" })).toEqual([]);
    });

    it("ADDRESS DEFAULT → [line1, postalCode]", () => {
        expect(resolveProjectionFields("ADDRESS", { projectionMode: "DEFAULT" })).toEqual(["line1", "postalCode"]);
    });
});

// ── isEmptyPickerConfig ───────────────────────────────────────────────────────

describe("isEmptyPickerConfig (Phase 5.3b updates)", () => {
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

    it("projectionMode DEFAULT alone → true (no explicit choice)", () => {
        expect(isEmptyPickerConfig({ projectionMode: "DEFAULT" })).toBe(true);
    });

    it("projectionMode CUSTOM alone → false (explicit choice even with empty fields)", () => {
        expect(isEmptyPickerConfig({ projectionMode: "CUSTOM", projectionFields: [] })).toBe(false);
    });

    it("projectionMode NONE alone → false (explicit choice)", () => {
        expect(isEmptyPickerConfig({ projectionMode: "NONE" })).toBe(false);
    });

    it("non-empty projectionFields (legacy) → false", () => {
        expect(isEmptyPickerConfig({ projectionFields: ["firstName"] })).toBe(false);
    });

    it("empty projectionFields alone → true", () => {
        expect(isEmptyPickerConfig({ projectionFields: [] })).toBe(true);
    });
});
