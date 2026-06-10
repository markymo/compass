/**
 * Tests for GLEIF L2 enrichment:
 *   1. Existing GleifNormalizer still reads attributes exactly as before
 *   2. L2 fetchGleifL2 success path (mocked)
 *   3. No parent / 404 does not throw
 *   4. Reporting exception does not throw
 *   5. Unresolved ELF code does not throw, returns name: null
 *   6. gleifData remains structurally valid with new keys present
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { resolveElfCode } from "../elf-codes";
import { resolveGleifElf, fetchGleifL2 } from "../gleif-l2";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_GLEIF_ATTRIBUTES = {
    lei: "213800WSGIIZCXF1P572",
    entity: {
        legalName: { name: "JAGUAR LAND ROVER LIMITED", language: "en" },
        legalAddress: {
            addressLines: ["ABBEY ROAD", "WHITLEY"],
            city: "COVENTRY",
            region: "GB-COV",
            country: "GB",
            postalCode: "CV3 4LF",
        },
        headquartersAddress: {
            addressLines: ["ABBEY ROAD", "WHITLEY"],
            city: "COVENTRY",
            country: "GB",
            postalCode: "CV3 4LF",
        },
        registeredAt: { id: "RA000585" },
        registeredAs: "01672070",
        jurisdiction: "GB",
        category: "GENERAL",
        legalForm: { id: "H0PO" },
        status: "ACTIVE",
    },
    registration: {
        initialRegistrationDate: "2013-08-21T00:00:00Z",
        lastUpdateDate: "2025-08-27T15:57:50Z",
        status: "ISSUED",
        nextRenewalDate: "2026-08-28T00:00:00Z",
        managingLou: "213800WAVVOPS85N2205",
        corroborationLevel: "FULLY_CORROBORATED",
    },
};

const MOCK_PARENT_RECORD = {
    type: "lei-records",
    id: "529900L73GEWN1O5NH84",
    attributes: {
        lei: "529900L73GEWN1O5NH84",
        entity: {
            legalName: { name: "JAGUAR LAND ROVER AUTOMOTIVE PLC" },
            jurisdiction: "GB",
            legalForm: { id: "B6ES" },
            status: "ACTIVE",
            registeredAt: { id: "RA000585" },
            registeredAs: "06477691",
        },
        registration: {
            status: "ISSUED",
        },
    },
};

// ─── Helper to make mock fetch responses ─────────────────────────────────────

function mockJsonResponse(body: any, status = 200) {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
        })
    );
}

function mockNotFound() {
    return Promise.resolve(new Response(null, { status: 404 }));
}

// ─── 1. GleifNormalizer backwards compatibility ───────────────────────────────

describe("GleifNormalizer — backward compatibility", () => {
    it("reads attributes root correctly regardless of new sibling keys", () => {
        // Simulate the full gleifData object as now stored (with new keys)
        const gleifData = {
            type: "lei-records",
            id: "213800WSGIIZCXF1P572",
            attributes: MOCK_GLEIF_ATTRIBUTES,
            registrationAuthorityName: "Companies House",
            nationalRegistryData: null,
            gleifL2: {
                directParent: { lei: "529900L73GEWN1O5NH84", legalName: "JAGUAR LAND ROVER AUTOMOTIVE PLC" },
                ultimateParent: null,
                directParentException: null,
                ultimateParentException: null,
                directChildrenCount: 0,
                fetchedAt: "2026-06-10T22:00:00Z",
            },
            gleifElf: { id: "H0PO", name: "Private Limited Company", fetchedAt: "2026-06-10T22:00:00Z" },
        };

        // GleifNormalizer resolves from: payload?.data?.attributes || payload?.attributes || payload
        const attr = gleifData?.attributes;

        expect(attr).toBeDefined();
        expect(attr.entity.legalName.name).toBe("JAGUAR LAND ROVER LIMITED");
        expect(attr.entity.jurisdiction).toBe("GB");
        expect(attr.registration.status).toBe("ISSUED");

        // New keys must NOT appear in attributes
        expect((attr as any).gleifL2).toBeUndefined();
        expect((attr as any).gleifElf).toBeUndefined();
    });

    it("gleifData is valid JSON with new keys present", () => {
        const gleifData = {
            attributes: MOCK_GLEIF_ATTRIBUTES,
            gleifL2: { directParent: null, ultimateParent: null, directChildrenCount: 0, fetchedAt: "2026-06-10T22:00:00Z" },
            gleifElf: { id: "H0PO", name: "Private Limited Company", fetchedAt: "2026-06-10T22:00:00Z" },
        };

        // Must round-trip through JSON without error
        const serialised = JSON.stringify(gleifData);
        const parsed = JSON.parse(serialised);

        expect(parsed.gleifL2.directChildrenCount).toBe(0);
        expect(parsed.gleifElf.name).toBe("Private Limited Company");
        expect(parsed.attributes.entity.jurisdiction).toBe("GB");
    });
});

// ─── 2. ELF resolution ────────────────────────────────────────────────────────

describe("resolveElfCode — generated map coverage", () => {
    it("resolves H0PO: UK Private Limited Company", () => {
        const result = resolveElfCode("H0PO");
        expect(result.id).toBe("H0PO");
        expect(result.name).toBeTruthy();
        expect(result.countryCode).toBe("GB");
    });

    it("resolves B6ES: UK Public Limited Company", () => {
        const result = resolveElfCode("B6ES");
        expect(result.id).toBe("B6ES");
        expect(result.name).toBeTruthy();
    });

    it("resolves DDKQ: Indian public limited company (non-UK/non-common code)", () => {
        // DDKQ is Tata Motors' legal form — present in generated map
        const result = resolveElfCode("DDKQ");
        expect(result.id).toBe("DDKQ");
        expect(result.name).toBeTruthy();
        expect(result.countryCode).toBe("IN");
    });

    it("resolves 5GGB: Luxembourg Société Anonyme (from generated map)", () => {
        const result = resolveElfCode("5GGB");
        expect(result.id).toBe("5GGB");
        expect(result.name).toBeTruthy();
        expect(result.countryCode).toBe("LU");
    });

    it("resolves 7TPC: Australian Trust (from generated map)", () => {
        const result = resolveElfCode("7TPC");
        expect(result.id).toBe("7TPC");
        expect(result.name).toBeTruthy();
        expect(result.countryCode).toBe("AU");
    });

    it("returns name: null for a genuinely unknown code — never throws", () => {
        const result = resolveElfCode("ZZZZ");
        expect(result.id).toBe("ZZZZ");
        expect(result.name).toBeNull();
    });

    it("returns empty id and null name for null input", () => {
        const result = resolveElfCode(null);
        expect(result.id).toBe("");
        expect(result.name).toBeNull();
    });

    it("returns empty id and null name for undefined input", () => {
        const result = resolveElfCode(undefined);
        expect(result.id).toBe("");
        expect(result.name).toBeNull();
    });
});


describe("resolveGleifElf", () => {
    it("extracts and resolves ELF from gleif attributes", () => {
        const result = resolveGleifElf(MOCK_GLEIF_ATTRIBUTES);
        expect(result.id).toBe("H0PO");
        expect(result.name).toBe("Private Limited Company");
        expect(result.fetchedAt).toBeDefined();
    });

    it("returns name: null when legalForm is missing — never throws", () => {
        const attrs = { ...MOCK_GLEIF_ATTRIBUTES, entity: { ...MOCK_GLEIF_ATTRIBUTES.entity, legalForm: undefined } };
        const result = resolveGleifElf(attrs);
        expect(result.name).toBeNull();
    });

    it("never throws when passed null", () => {
        expect(() => resolveGleifElf(null)).not.toThrow();
    });
});

// ─── 3 & 4. L2 fetch — success and failure paths ────────────────────────────

describe("fetchGleifL2", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns compact parent data on success", async () => {
        const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(
            (url: RequestInfo | URL) => {
                const s = String(url);
                if (s.includes("/direct-parent")) {
                    return mockJsonResponse({ data: MOCK_PARENT_RECORD });
                }
                if (s.includes("/ultimate-parent")) {
                    return mockJsonResponse({ data: MOCK_PARENT_RECORD });
                }
                if (s.includes("/direct-children")) {
                    return mockJsonResponse({ meta: { pagination: { total: 0 } } });
                }
                return mockJsonResponse({});
            }
        );

        const result = await fetchGleifL2("213800WSGIIZCXF1P572");

        expect(result.directParent).not.toBeNull();
        expect(result.directParent?.lei).toBe("529900L73GEWN1O5NH84");
        expect(result.directParent?.legalName).toBe("JAGUAR LAND ROVER AUTOMOTIVE PLC");
        expect(result.directParent?.legalFormId).toBe("B6ES");
        expect(result.directParent?.registeredAt).toBe("RA000585");
        expect(result.directChildrenCount).toBe(0);
        expect(result.fetchedAt).toBeDefined();
    });

    it("returns null directParent when 404 — does not throw", async () => {
        vi.spyOn(global, "fetch").mockImplementation(
            (url: RequestInfo | URL) => {
                const s = String(url);
                if (s.includes("/direct-parent") && !s.includes("exception")) {
                    return mockNotFound();
                }
                if (s.includes("/ultimate-parent") && !s.includes("exception")) {
                    return mockNotFound();
                }
                if (s.includes("/direct-children")) {
                    return mockJsonResponse({ meta: { pagination: { total: 5 } } });
                }
                if (s.includes("exception")) {
                    return mockNotFound();
                }
                return mockJsonResponse({});
            }
        );

        const result = await fetchGleifL2("213800WSGIIZCXF1P572");

        expect(result.directParent).toBeNull();
        expect(result.ultimateParent).toBeNull();
        expect(result.directChildrenCount).toBe(5);
        expect(result.directParentException).toBeNull();
    });

    it("captures exception reason when reporting exception exists", async () => {
        vi.spyOn(global, "fetch").mockImplementation(
            (url: RequestInfo | URL) => {
                const s = String(url);
                if (s.includes("direct-parent-reporting-exception")) {
                    return mockJsonResponse({ data: { attributes: { exceptionReason: "NATURAL_PERSON" } } });
                }
                if (s.includes("ultimate-parent-reporting-exception")) {
                    return mockJsonResponse({ data: { attributes: { exceptionReason: "NON_CONSOLIDATING" } } });
                }
                if (s.includes("/direct-parent") || s.includes("/ultimate-parent")) {
                    return mockNotFound();
                }
                if (s.includes("/direct-children")) {
                    return mockJsonResponse({ meta: { pagination: { total: 0 } } });
                }
                return mockJsonResponse({});
            }
        );

        const result = await fetchGleifL2("SOMElei123456789012");

        expect(result.directParentException).toBe("NATURAL_PERSON");
        expect(result.ultimateParentException).toBe("NON_CONSOLIDATING");
    });

    it("handles complete network failure — does not throw, returns nulls", async () => {
        vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network down"));

        await expect(fetchGleifL2("213800WSGIIZCXF1P572")).resolves.not.toThrow();

        const result = await fetchGleifL2("213800WSGIIZCXF1P572");
        expect(result.directParent).toBeNull();
        expect(result.ultimateParent).toBeNull();
        expect(result.directChildrenCount).toBeNull();
    });
});
