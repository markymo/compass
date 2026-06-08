import { describe, it, expect } from "vitest";
import {
    NODE_FIELD_REGISTRY,
    getNodeFields,
    getNodeField,
    getDisplayableFields,
    getSearchableFields,
    type NodeType,
} from "../node-field-registry";

// ── Registry integrity ─────────────────────────────────────────────────────

describe("NODE_FIELD_REGISTRY — integrity", () => {
    const NODE_TYPES: NodeType[] = ["PERSON", "LEGAL_ENTITY", "ADDRESS"];

    it("has no duplicate fieldKeys within any nodeType", () => {
        for (const nodeType of NODE_TYPES) {
            const keys = NODE_FIELD_REGISTRY
                .filter(f => f.nodeType === nodeType)
                .map(f => f.fieldKey);
            const unique = new Set(keys);
            expect(unique.size).toBe(keys.length);
        }
    });

    it("every SYSTEM_COLUMN storagePath starts with the expected entity prefix", () => {
        const prefixMap: Record<NodeType, string> = {
            PERSON:        "person.",
            LEGAL_ENTITY:  "legalEntity.",
            ADDRESS:       "address.",
        };
        const systemFields = NODE_FIELD_REGISTRY.filter(f => f.storageKind === "SYSTEM_COLUMN");
        for (const field of systemFields) {
            const expectedPrefix = prefixMap[field.nodeType];
            expect(
                field.storagePath.startsWith(expectedPrefix),
                `${field.nodeType}.${field.fieldKey}: storagePath "${field.storagePath}" should start with "${expectedPrefix}"`
            ).toBe(true);
        }
    });

    it("all system fields have isSystem = true, storageKind = SYSTEM_COLUMN, scope = GLOBAL", () => {
        const systemFields = NODE_FIELD_REGISTRY.filter(f => f.isSystem);
        for (const field of systemFields) {
            expect(field.storageKind).toBe("SYSTEM_COLUMN");
            expect(field.scope).toBe("GLOBAL");
        }
    });

    it("all fields have a positive order value", () => {
        for (const field of NODE_FIELD_REGISTRY) {
            expect(field.order).toBeGreaterThan(0);
        }
    });

    it("all fields have a non-empty label", () => {
        for (const field of NODE_FIELD_REGISTRY) {
            expect(field.label.trim().length).toBeGreaterThan(0);
        }
    });

    it("all fields have a non-empty fieldKey", () => {
        for (const field of NODE_FIELD_REGISTRY) {
            expect(field.fieldKey.trim().length).toBeGreaterThan(0);
        }
    });
});

// ── Expected fields per node type ─────────────────────────────────────────

describe("NODE_FIELD_REGISTRY — expected PERSON fields", () => {
    const personFields = NODE_FIELD_REGISTRY.filter(f => f.nodeType === "PERSON");
    const personKeys = personFields.map(f => f.fieldKey);

    const EXPECTED_PERSON_FIELDS = [
        "firstName",
        "middleName",
        "lastName",
        "dateOfBirth",
        "placeOfBirth",
        "primaryNationality",
        "isPublicFigure",
    ] as const;

    it("contains all 7 expected PERSON fields", () => {
        expect(personKeys.sort()).toEqual([...EXPECTED_PERSON_FIELDS].sort());
    });

    it("marks firstName, lastName, primaryNationality as searchable", () => {
        const searchable = personFields.filter(f => f.isSearchable).map(f => f.fieldKey);
        expect(searchable).toContain("firstName");
        expect(searchable).toContain("lastName");
        expect(searchable).toContain("primaryNationality");
    });

    it("marks dateOfBirth, middleName, placeOfBirth, isPublicFigure as NOT searchable", () => {
        const notSearchable = personFields.filter(f => !f.isSearchable).map(f => f.fieldKey);
        expect(notSearchable).toContain("dateOfBirth");
        expect(notSearchable).toContain("middleName");
        expect(notSearchable).toContain("placeOfBirth");
        expect(notSearchable).toContain("isPublicFigure");
    });

    it("marks PII fields correctly", () => {
        const piiFields = personFields.filter(f => f.isPii).map(f => f.fieldKey);
        expect(piiFields).toContain("firstName");
        expect(piiFields).toContain("lastName");
        expect(piiFields).toContain("dateOfBirth");
        // nationality is NOT PII by default
        const nonPii = personFields.filter(f => !f.isPii).map(f => f.fieldKey);
        expect(nonPii).toContain("primaryNationality");
        expect(nonPii).toContain("isPublicFigure");
    });

    it("isPublicFigure has dataType BOOLEAN", () => {
        const field = personFields.find(f => f.fieldKey === "isPublicFigure");
        expect(field?.dataType).toBe("BOOLEAN");
    });

    it("dateOfBirth has dataType DATE", () => {
        const field = personFields.find(f => f.fieldKey === "dateOfBirth");
        expect(field?.dataType).toBe("DATE");
    });

    it("primaryNationality has dataType COUNTRY_CODE", () => {
        const field = personFields.find(f => f.fieldKey === "primaryNationality");
        expect(field?.dataType).toBe("COUNTRY_CODE");
    });
});

describe("NODE_FIELD_REGISTRY — expected LEGAL_ENTITY fields", () => {
    const leFields = NODE_FIELD_REGISTRY.filter(f => f.nodeType === "LEGAL_ENTITY");
    const leKeys = leFields.map(f => f.fieldKey);

    it("contains all 2 expected LEGAL_ENTITY fields", () => {
        expect(leKeys.sort()).toEqual(["localRegistrationNumber", "name"].sort());
    });

    it("marks name and localRegistrationNumber as searchable", () => {
        const searchable = leFields.filter(f => f.isSearchable).map(f => f.fieldKey);
        expect(searchable).toContain("name");
        expect(searchable).toContain("localRegistrationNumber");
    });

    it("marks no LEGAL_ENTITY fields as PII", () => {
        const piiFields = leFields.filter(f => f.isPii);
        expect(piiFields).toHaveLength(0);
    });
});

describe("NODE_FIELD_REGISTRY — expected ADDRESS fields", () => {
    const addrFields = NODE_FIELD_REGISTRY.filter(f => f.nodeType === "ADDRESS");
    const addrKeys = addrFields.map(f => f.fieldKey);

    const EXPECTED_ADDRESS_FIELDS = [
        "line1", "line2", "city", "region", "postalCode", "country",
    ] as const;

    it("contains all 6 expected ADDRESS fields", () => {
        expect(addrKeys.sort()).toEqual([...EXPECTED_ADDRESS_FIELDS].sort());
    });

    it("marks line1, city, country as searchable", () => {
        const searchable = addrFields.filter(f => f.isSearchable).map(f => f.fieldKey);
        expect(searchable).toContain("line1");
        expect(searchable).toContain("city");
        expect(searchable).toContain("country");
    });

    it("marks line2, region, postalCode as NOT searchable", () => {
        const notSearchable = addrFields.filter(f => !f.isSearchable).map(f => f.fieldKey);
        expect(notSearchable).toContain("line2");
        expect(notSearchable).toContain("region");
        expect(notSearchable).toContain("postalCode");
    });

    it("country has dataType COUNTRY_CODE", () => {
        const field = addrFields.find(f => f.fieldKey === "country");
        expect(field?.dataType).toBe("COUNTRY_CODE");
    });
});

// ── getNodeFields ──────────────────────────────────────────────────────────

describe("getNodeFields", () => {
    it("returns only PERSON fields for PERSON nodeType", () => {
        const fields = getNodeFields("PERSON");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.nodeType === "PERSON")).toBe(true);
    });

    it("returns only LEGAL_ENTITY fields for LEGAL_ENTITY nodeType", () => {
        const fields = getNodeFields("LEGAL_ENTITY");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.nodeType === "LEGAL_ENTITY")).toBe(true);
    });

    it("returns only ADDRESS fields for ADDRESS nodeType", () => {
        const fields = getNodeFields("ADDRESS");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.nodeType === "ADDRESS")).toBe(true);
    });

    it("returns fields sorted by order ascending", () => {
        for (const nodeType of ["PERSON", "LEGAL_ENTITY", "ADDRESS"] as NodeType[]) {
            const fields = getNodeFields(nodeType);
            for (let i = 1; i < fields.length; i++) {
                expect(fields[i].order).toBeGreaterThanOrEqual(fields[i - 1].order);
            }
        }
    });

    it("PERSON returns 7 fields", () => {
        expect(getNodeFields("PERSON")).toHaveLength(7);
    });

    it("LEGAL_ENTITY returns 2 fields", () => {
        expect(getNodeFields("LEGAL_ENTITY")).toHaveLength(2);
    });

    it("ADDRESS returns 6 fields", () => {
        expect(getNodeFields("ADDRESS")).toHaveLength(6);
    });
});

// ── getNodeField ──────────────────────────────────────────────────────────

describe("getNodeField", () => {
    it("returns the correct field definition for a valid fieldKey", () => {
        const field = getNodeField("PERSON", "firstName");
        expect(field).toBeDefined();
        expect(field?.fieldKey).toBe("firstName");
        expect(field?.nodeType).toBe("PERSON");
        expect(field?.storagePath).toBe("person.firstName");
    });

    it("returns undefined for an unknown fieldKey", () => {
        expect(getNodeField("PERSON", "email")).toBeUndefined();
    });

    it("returns undefined when nodeType does not match even if fieldKey exists elsewhere", () => {
        // "name" exists on LEGAL_ENTITY but not on PERSON
        expect(getNodeField("PERSON", "name")).toBeUndefined();
    });

    it("returns the correct field for LEGAL_ENTITY / name", () => {
        const field = getNodeField("LEGAL_ENTITY", "name");
        expect(field?.label).toBe("Entity Name");
        expect(field?.storagePath).toBe("legalEntity.name");
    });

    it("returns the correct field for ADDRESS / country", () => {
        const field = getNodeField("ADDRESS", "country");
        expect(field?.dataType).toBe("COUNTRY_CODE");
        expect(field?.storagePath).toBe("address.country");
    });
});

// ── getDisplayableFields ───────────────────────────────────────────────────

describe("getDisplayableFields", () => {
    it("returns only displayable fields for PERSON", () => {
        const fields = getDisplayableFields("PERSON");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.isDisplayable)).toBe(true);
    });

    it("returns only fields belonging to the requested nodeType", () => {
        const fields = getDisplayableFields("ADDRESS");
        expect(fields.every(f => f.nodeType === "ADDRESS")).toBe(true);
    });

    it("returns fields sorted by order ascending", () => {
        const fields = getDisplayableFields("PERSON");
        for (let i = 1; i < fields.length; i++) {
            expect(fields[i].order).toBeGreaterThanOrEqual(fields[i - 1].order);
        }
    });

    it("all current system PERSON fields are displayable (none hidden)", () => {
        // All 7 PERSON system fields are marked isDisplayable = true in the current registry
        expect(getDisplayableFields("PERSON")).toHaveLength(7);
    });

    it("all current system ADDRESS fields are displayable", () => {
        expect(getDisplayableFields("ADDRESS")).toHaveLength(6);
    });
});

// ── getSearchableFields ────────────────────────────────────────────────────

describe("getSearchableFields", () => {
    it("returns only searchable fields for PERSON", () => {
        const fields = getSearchableFields("PERSON");
        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every(f => f.isSearchable)).toBe(true);
    });

    it("returns only fields belonging to the requested nodeType", () => {
        const fields = getSearchableFields("LEGAL_ENTITY");
        expect(fields.every(f => f.nodeType === "LEGAL_ENTITY")).toBe(true);
    });

    it("PERSON searchable fields are: firstName, lastName, primaryNationality", () => {
        const keys = getSearchableFields("PERSON").map(f => f.fieldKey).sort();
        expect(keys).toEqual(["firstName", "lastName", "primaryNationality"].sort());
    });

    it("LEGAL_ENTITY searchable fields are: name, localRegistrationNumber", () => {
        const keys = getSearchableFields("LEGAL_ENTITY").map(f => f.fieldKey).sort();
        expect(keys).toEqual(["localRegistrationNumber", "name"].sort());
    });

    it("ADDRESS searchable fields are: line1, city, country", () => {
        const keys = getSearchableFields("ADDRESS").map(f => f.fieldKey).sort();
        expect(keys).toEqual(["city", "country", "line1"].sort());
    });

    it("returns fields sorted by order ascending", () => {
        const fields = getSearchableFields("PERSON");
        for (let i = 1; i < fields.length; i++) {
            expect(fields[i].order).toBeGreaterThanOrEqual(fields[i - 1].order);
        }
    });

    it("does not include non-TEXT / non-COUNTRY_CODE fields (BOOLEAN, DATE are not searchable)", () => {
        const personSearchable = getSearchableFields("PERSON");
        const keys = personSearchable.map(f => f.fieldKey);
        expect(keys).not.toContain("isPublicFigure");
        expect(keys).not.toContain("dateOfBirth");
    });
});
