/**
 * field-value-formatting.test.ts
 *
 * Unit tests for itemMatchesSearch() and the formatRawFieldValue()
 * exported from the neutral shared file src/lib/graph/field-value-formatting.ts
 */

import { describe, it, expect } from "vitest";
import { formatRawFieldValue, itemMatchesSearch, type PickerItemSearchable } from "../field-value-formatting";

// ── formatRawFieldValue ────────────────────────────────────────────────────────
// (These now live here — graph-node-picker.ts re-exports from this module)

describe("formatRawFieldValue", () => {
    it("TEXT: returns string as-is", () => {
        expect(formatRawFieldValue("hello", "TEXT")).toBe("hello");
    });
    it("TEXT: trims whitespace", () => {
        expect(formatRawFieldValue("  hello  ", "TEXT")).toBe("hello");
    });
    it("TEXT: empty string → null", () => {
        expect(formatRawFieldValue("", "TEXT")).toBeNull();
    });
    it("TEXT: null → null", () => {
        expect(formatRawFieldValue(null, "TEXT")).toBeNull();
    });
    it("TEXT: object → null", () => {
        expect(formatRawFieldValue({ foo: 1 }, "TEXT")).toBeNull();
    });
    it("COUNTRY_CODE: returns string", () => {
        expect(formatRawFieldValue("GB", "COUNTRY_CODE")).toBe("GB");
    });
    it("DATE: Date object → YYYY-MM-DD", () => {
        expect(formatRawFieldValue(new Date("1952-04-30"), "DATE")).toBe("1952-04-30");
    });
    it("DATE: ISO string → YYYY-MM-DD", () => {
        expect(formatRawFieldValue("2000-06-15T00:00:00.000Z", "DATE")).toBe("2000-06-15");
    });
    it("DATE: invalid string → null", () => {
        expect(formatRawFieldValue("not-a-date", "DATE")).toBeNull();
    });
    it("DATE: null → null", () => {
        expect(formatRawFieldValue(null, "DATE")).toBeNull();
    });
    it("BOOLEAN: true → \"Yes\"", () => {
        expect(formatRawFieldValue(true, "BOOLEAN")).toBe("Yes");
    });
    it("BOOLEAN: false → \"No\"", () => {
        expect(formatRawFieldValue(false, "BOOLEAN")).toBe("No");
    });
    it("BOOLEAN: null → null", () => {
        expect(formatRawFieldValue(null, "BOOLEAN")).toBeNull();
    });
    it("NUMBER: number → string", () => {
        expect(formatRawFieldValue(42, "NUMBER")).toBe("42");
    });
    it("NUMBER: null → null", () => {
        expect(formatRawFieldValue(null, "NUMBER")).toBeNull();
    });
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makePersonItem(overrides: Partial<PickerItemSearchable> = {}): PickerItemSearchable {
    return {
        nodeType: "PERSON",
        displayLabel: "Alan Bennett",
        subLabel: "British",
        activeEdgeTypes: [],
        rawFields: {
            firstName: "Alan",
            lastName: "Bennett",
            middleName: null,
            dateOfBirth: null,
            placeOfBirth: null,
            primaryNationality: "British",
            isPublicFigure: false,
            title: null,
            officerRole: null,
            occupation: null,
            countryOfResidence: null,
        },
        ...overrides,
    };
}

function makeLeItem(overrides: Partial<PickerItemSearchable> = {}): PickerItemSearchable {
    return {
        nodeType: "LEGAL_ENTITY",
        displayLabel: "Acme Ltd",
        subLabel: "12345678",
        activeEdgeTypes: [],
        rawFields: {
            name: "Acme Ltd",
            localRegistrationNumber: "12345678",
            jurisdiction: null,
            legalForm: null,
            entityStatus: null,
            countryOfIncorporation: null,
        },
        ...overrides,
    };
}

function makeAddressItem(overrides: Partial<PickerItemSearchable> = {}): PickerItemSearchable {
    return {
        nodeType: "ADDRESS",
        displayLabel: "1 High St, London, SW1A 1AA, GB",
        subLabel: "GB",
        activeEdgeTypes: [],
        rawFields: {
            line1: "1 High St",
            line2: null,
            city: "London",
            region: null,
            postalCode: "SW1A 1AA",
            country: "GB",
        },
        ...overrides,
    };
}

// ── itemMatchesSearch — legacy behaviour (no pickerConfig) ────────────────────

describe("itemMatchesSearch — legacy behaviour (no pickerConfig)", () => {
    it("LS-1: query matches displayLabel", () => {
        const item = makePersonItem();
        expect(itemMatchesSearch(item, "alan", null)).toBe(true);
    });

    it("LS-2: query matches subLabel", () => {
        const item = makePersonItem();
        expect(itemMatchesSearch(item, "british", null)).toBe(true);
    });

    it("LS-3: query matches activeEdgeTypes", () => {
        const item = makePersonItem({ activeEdgeTypes: ["DIRECTOR", "SHAREHOLDER"] });
        expect(itemMatchesSearch(item, "director", null)).toBe(true);
        expect(itemMatchesSearch(item, "shareholder", null)).toBe(true);
    });

    it("LS-4: non-matching query returns false", () => {
        const item = makePersonItem();
        expect(itemMatchesSearch(item, "xyz-nonexistent", null)).toBe(false);
    });

    it("LS-5: empty query always returns true", () => {
        const item = makePersonItem();
        expect(itemMatchesSearch(item, "", null)).toBe(true);
    });

    it("LS-6: null pickerConfig uses legacy only", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, officerRole: "director" },
        });
        // officerRole matches 'director' but pickerConfig is null → legacy only
        // displayLabel='Alan Bennett', subLabel='British' → no match
        expect(itemMatchesSearch(item, "director", null)).toBe(false);
    });
});

// ── itemMatchesSearch — configured searchFields ───────────────────────────────

describe("itemMatchesSearch — configured searchFields", () => {
    it("SF-4: PERSON searchFields=[\"officerRole\"] matches rawFields.officerRole", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, officerRole: "director" },
        });
        const config = { searchFields: ["officerRole"] };
        expect(itemMatchesSearch(item, "director", config)).toBe(true);
    });

    it("SF-5: PERSON searchFields=[\"occupation\"] — occupation is NOT isSearchable in registry, sanitizer strips it → no match", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, occupation: "Company Director" },
        });
        const config = { searchFields: ["occupation"] };
        // occupation is not isSearchable → sanitizePickerConfig removes it
        // → no searchFields after sanitization → legacy only → no match on 'company director'
        expect(itemMatchesSearch(item, "company director", config)).toBe(false);
    });

    it("SF-5b: partial match does not apply to non-searchable occupation field", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, occupation: "Company Director" },
        });
        const config = { searchFields: ["occupation"] };
        // occupation stripped → legacy only → 'company' not in displayLabel/subLabel
        expect(itemMatchesSearch(item, "company", config)).toBe(false);
    });

    it("SF-6: PERSON searchFields=[\"countryOfResidence\"] matches country value", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, countryOfResidence: "Germany" },
        });
        const config = { searchFields: ["countryOfResidence"] };
        expect(itemMatchesSearch(item, "germany", config)).toBe(true);
    });

    it("SF-7: LEGAL_ENTITY searchFields=[\"jurisdiction\"] matches jurisdiction", () => {
        const item = makeLeItem({
            rawFields: { ...makeLeItem().rawFields, jurisdiction: "England and Wales" },
        });
        const config = { searchFields: ["jurisdiction"] };
        expect(itemMatchesSearch(item, "england", config)).toBe(true);
    });

    it("SF-8: ADDRESS searchFields=[\"postalCode\"] — postalCode is NOT isSearchable in registry → sanitizer strips it", () => {
        // The displayLabel for this item is '1 High St, London, SW1A 1AA, GB' which
        // contains 'SW1A 1AA' — so legacy search WOULD match.
        // Use a postcode that is NOT in the displayLabel to isolate rawField behaviour.
        const item = makeAddressItem({
            rawFields: { ...makeAddressItem().rawFields, postalCode: "EC1A 1BB" },
            displayLabel: "1 High St, London, GB",  // postalCode not in display
            subLabel: "GB",
        });
        const config = { searchFields: ["postalCode"] };
        // postalCode is not isSearchable → sanitizer removes it → no rawField search
        // → legacy only → 'EC1A 1BB' not in displayLabel/subLabel → no match
        expect(itemMatchesSearch(item, "ec1a", config)).toBe(false);
    });

    it("SF-8b: ADDRESS searchFields=[\"country\"] matches (country IS searchable)", () => {
        const item = makeAddressItem();
        const config = { searchFields: ["country"] };
        expect(itemMatchesSearch(item, "gb", config)).toBe(true);
    });

    it("SF-8c: ADDRESS searchFields=[\"city\"] matches (city IS searchable)", () => {
        const item = makeAddressItem();
        const config = { searchFields: ["city"] };
        expect(itemMatchesSearch(item, "london", config)).toBe(true);
    });
});

// ── itemMatchesSearch — negative and edge cases ───────────────────────────────

describe("itemMatchesSearch — negative cases and edge cases", () => {
    it("NC-9: field in rawFields but NOT in searchFields → no match", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, occupation: "Accountant" },
        });
        // searchFields only has officerRole — occupation should NOT be searched
        const config = { searchFields: ["officerRole"] };
        expect(itemMatchesSearch(item, "accountant", config)).toBe(false);
    });

    it("NC-10: invalid searchFields (not in registry for node type) are ignored", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, officerRole: "director" },
        });
        // 'email' and 'phone' are not PERSON registry fields → sanitizer strips them
        // officerRole stays but it's not in config → no searchFields → no match on 'director'
        const config = { searchFields: ["email", "phone"] };
        expect(itemMatchesSearch(item, "director", config)).toBe(false);
    });

    it("NC-11: null rawField value is ignored during search", () => {
        const item = makePersonItem(); // officerRole is null
        const config = { searchFields: ["officerRole"] };
        expect(itemMatchesSearch(item, "director", config)).toBe(false);
    });

    it("NC-12: BOOLEAN field searches as 'Yes'/'No'", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, isPublicFigure: true },
        });
        // isPublicFigure is not searchable per registry — sanitizer removes it
        // Verify it's treated as excluded
        const config = { searchFields: ["isPublicFigure"] };
        // isPublicFigure has BOOLEAN dataType but is not isSearchable → sanitizer strips it
        expect(itemMatchesSearch(item, "yes", config)).toBe(false);
    });

    it("NC-13: DATE field searches as YYYY-MM-DD", () => {
        // dateOfBirth is not isSearchable → sanitizer strips it
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, dateOfBirth: new Date("1952-04-30") },
        });
        const config = { searchFields: ["dateOfBirth"] };
        // sanitizer strips non-searchable fields → no rawField search → no match
        expect(itemMatchesSearch(item, "1952-04-30", config)).toBe(false);
    });

    it("NC-14: non-object pickerConfig → falls back to legacy search only", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, officerRole: "director" },
        });
        // String is not a valid pickerConfig → sanitizer returns null → legacy only
        expect(itemMatchesSearch(item, "director", "invalid" as any)).toBe(false);
        // But displayLabel still matches
        expect(itemMatchesSearch(item, "alan", "invalid" as any)).toBe(true);
    });

    it("NC-15: empty searchFields array → no rawField search, legacy used", () => {
        const item = makePersonItem({
            rawFields: { ...makePersonItem().rawFields, officerRole: "director" },
        });
        const config = { searchFields: [] };
        // Sanitizer omits empty array → no searchFields → legacy only
        expect(itemMatchesSearch(item, "director", config)).toBe(false);
        expect(itemMatchesSearch(item, "alan", config)).toBe(true);
    });
});

// ── itemMatchesSearch — multiple searchFields ─────────────────────────────────

describe("itemMatchesSearch — multiple searchFields", () => {
    it("MSF-1: matches first of multiple searchFields", () => {
        const item = makePersonItem({
            rawFields: {
                ...makePersonItem().rawFields,
                officerRole: "director",
                occupation: "Company Director",
                countryOfResidence: "Germany",
            },
        });
        const config = { searchFields: ["officerRole", "occupation", "countryOfResidence"] };
        expect(itemMatchesSearch(item, "director", config)).toBe(true);
    });

    it("MSF-2: matches second of multiple searchFields", () => {
        const item = makePersonItem({
            rawFields: {
                ...makePersonItem().rawFields,
                officerRole: "secretary",
                countryOfResidence: "Germany",
            },
        });
        const config = { searchFields: ["officerRole", "countryOfResidence"] };
        expect(itemMatchesSearch(item, "germany", config)).toBe(true);
    });

    it("MSF-3: LEGAL_ENTITY multiple searchFields", () => {
        const item = makeLeItem({
            rawFields: {
                ...makeLeItem().rawFields,
                jurisdiction: "France",
                countryOfIncorporation: "FR",
            },
        });
        const config = { searchFields: ["jurisdiction", "countryOfIncorporation"] };
        expect(itemMatchesSearch(item, "france", config)).toBe(true);
        expect(itemMatchesSearch(item, "fr", config)).toBe(true);
    });
});
