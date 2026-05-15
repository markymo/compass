/**
 * FranceRechercheEntreprisesConnector tests
 *
 * Tests use vi.stubGlobal to intercept `fetch` (the global used by the connector).
 * No Prisma access, no network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FranceRechercheEntreprisesConnector } from "../FranceRechercheEntreprisesConnector";
import type { RegistryReference } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal RegistryReference stub for RA000192 + a given SIREN */
function makeRef(siren: string): RegistryReference {
    return {
        id: "ref-001",
        registryAuthorityId: "RA000192",
        localRegistrationNumber: siren,
        clientLEId: "le-001",
        status: "PENDING",
        // The connector only reads the two fields above; rest can be empty
    } as unknown as RegistryReference;
}

/** A representative API payload for a French company (SAS structure) */
const SAMPLE_COMPANY = {
    siren: "542051180",
    nom_complet: "TOTALENERGIES SE",
    nom_raison_sociale: "TOTALENERGIES SE",
    sigle: "TTE",
    date_creation: "1954-10-13",
    etat_administratif: "A",
    nature_juridique: "5710",
    statut_diffusion: "O",
    siege: {
        adresse: "2 PLACE JEAN MILLIER 92400 COURBEVOIE",
        numero_voie: "2",
        type_voie: "PLACE",
        libelle_voie: "JEAN MILLIER",
        code_postal: "92400",
        libelle_commune: "COURBEVOIE",
        etat_administratif: "A",
    },
    dirigeants: [
        {
            nom: "POUYANNÉ",
            prenoms: "PATRICK GILLES",
            qualite: "Président-directeur général",
            type_dirigeant: "personne physique",
        },
    ],
};

/** Wrap a company in the shape the API actually returns */
function apiResponse(company: typeof SAMPLE_COMPANY | null) {
    return {
        results: company ? [company] : [],
        total_results: company ? 1 : 0,
        page: 1,
        per_page: 1,
        total_pages: company ? 1 : 0,
    };
}

/** Build a fetch mock that returns the given body + status */
function mockFetch(body: unknown, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: vi.fn().mockResolvedValue(body),
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FranceRechercheEntreprisesConnector", () => {
    let connector: FranceRechercheEntreprisesConnector;

    beforeEach(() => {
        connector = new FranceRechercheEntreprisesConnector();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── supports() ──────────────────────────────────────────────────────────

    describe("supports()", () => {
        it("returns true for RA000192", () => {
            expect(connector.supports("RA000192")).toBe(true);
        });

        it("returns false for Companies House RA codes", () => {
            expect(connector.supports("RA000585")).toBe(false);
            expect(connector.supports("RA000586")).toBe(false);
            expect(connector.supports("RA000587")).toBe(false);
        });

        it("returns false for German RA codes", () => {
            expect(connector.supports("RA000242")).toBe(false);
        });

        it("returns false for unknown codes", () => {
            expect(connector.supports("RA000999")).toBe(false);
            expect(connector.supports("")).toBe(false);
        });
    });

    // ── fetch() — happy path ─────────────────────────────────────────────────

    describe("fetch() — successful SIREN lookup", () => {
        it("returns a populated CanonicalRegistryRecord for a valid SIREN", async () => {
            vi.stubGlobal("fetch", mockFetch(apiResponse(SAMPLE_COMPANY)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.entityName).toBe("TOTALENERGIES SE");
            expect(record.entityStatus).toBe("A");
            expect(record.incorporationDate).toBe("1954-10-13");
            expect(record.legalForm).toBe("5710");
            expect(record.sourceType).toBe("REGISTRATION_AUTHORITY");
            expect(record.registryKey).toBe("FR_RECHERCHE_ENTREPRISES");
            expect(record.registryAuthorityId).toBe("RA000192");
            expect(record.sourceRecordId).toBe("542051180");
        });

        it("normalises address from siege component fields", async () => {
            vi.stubGlobal("fetch", mockFetch(apiResponse(SAMPLE_COMPANY)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.registeredAddress?.lines).toContain("2 PLACE JEAN MILLIER");
            expect(record.registeredAddress?.city).toBe("COURBEVOIE");
            expect(record.registeredAddress?.postalCode).toBe("92400");
            expect(record.registeredAddress?.country).toBe("FR");
        });

        it("includes SIREN in identifiers", async () => {
            vi.stubGlobal("fetch", mockFetch(apiResponse(SAMPLE_COMPANY)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.identifiers).toContainEqual({ type: "SIREN", value: "542051180" });
        });

        it("includes officers from dirigeants", async () => {
            vi.stubGlobal("fetch", mockFetch(apiResponse(SAMPLE_COMPANY)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.officers).toHaveLength(1);
            expect(record.officers![0].name).toContain("POUYANNÉ");
            expect(record.officers![0].role).toBe("Président-directeur général");
        });

        it("stores raw payload under COMPANY_PROFILE subtype", async () => {
            vi.stubGlobal("fetch", mockFetch(apiResponse(SAMPLE_COMPANY)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.rawSourcePayload?.COMPANY_PROFILE).toBeDefined();
            expect(record.rawSourcePayload?.COMPANY_PROFILE.siren).toBe("542051180");
        });

        it("strips spaces from SIREN before lookup", async () => {
            const fetchMock = mockFetch(apiResponse(SAMPLE_COMPANY));
            vi.stubGlobal("fetch", fetchMock);

            await connector.fetch(makeRef("542 051 180"));

            const calledUrl = fetchMock.mock.calls[0][0] as string;
            expect(calledUrl).toContain("542051180");
            expect(calledUrl).not.toContain(" ");
        });

        it("prefers nom_raison_sociale over nom_complet for entityName", async () => {
            const company = {
                ...SAMPLE_COMPANY,
                nom_raison_sociale: "OFFICIAL NAME SA",
                nom_complet: "COMMON TRADE NAME",
            };
            vi.stubGlobal("fetch", mockFetch(apiResponse(company)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.entityName).toBe("OFFICIAL NAME SA");
        });

        it("falls back to nom_complet when nom_raison_sociale is absent", async () => {
            const { nom_raison_sociale, ...rest } = SAMPLE_COMPANY;
            const company = { ...rest, nom_raison_sociale: null } as any;
            vi.stubGlobal("fetch", mockFetch(apiResponse(company)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.entityName).toBe("TOTALENERGIES SE");
        });
    });

    // ── fetch() — address fallback ───────────────────────────────────────────

    describe("fetch() — address normalisation edge cases", () => {
        it("falls back to siege.adresse string when component fields are absent", async () => {
            const company = {
                ...SAMPLE_COMPANY,
                siege: {
                    adresse: "2 PLACE JEAN MILLIER 92400 COURBEVOIE",
                    // No numero_voie / type_voie / libelle_voie
                    code_postal: "92400",
                    libelle_commune: "COURBEVOIE",
                },
            } as any;
            vi.stubGlobal("fetch", mockFetch(apiResponse(company)));

            const record = await connector.fetch(makeRef("542051180"));

            expect(record.registeredAddress?.lines[0]).toBe(
                "2 PLACE JEAN MILLIER 92400 COURBEVOIE"
            );
        });
    });

    // ── fetch() — error paths ────────────────────────────────────────────────

    describe("fetch() — no results", () => {
        it("throws when the API returns an empty results array", async () => {
            vi.stubGlobal("fetch", mockFetch(apiResponse(null)));

            await expect(connector.fetch(makeRef("000000000"))).rejects.toThrow(
                /no company found for siren 000000000/i
            );
        });
    });

    describe("fetch() — SIREN mismatch", () => {
        it("throws when returned siren does not match the requested siren", async () => {
            const wrongCompany = { ...SAMPLE_COMPANY, siren: "999999999" };
            vi.stubGlobal("fetch", mockFetch(apiResponse(wrongCompany)));

            await expect(connector.fetch(makeRef("542051180"))).rejects.toThrow(
                /siren mismatch/i
            );
        });
    });

    describe("fetch() — non-diffusible entity", () => {
        it("throws with code FR_ENTITY_NON_DIFFUSIBLE when statut_diffusion is P", async () => {
            const protectedCompany = { ...SAMPLE_COMPANY, statut_diffusion: "P" };
            vi.stubGlobal("fetch", mockFetch(apiResponse(protectedCompany)));

            const err = await connector
                .fetch(makeRef("542051180"))
                .catch((e) => e);

            expect(err).toBeInstanceOf(Error);
            expect((err as any).code).toBe("FR_ENTITY_NON_DIFFUSIBLE");
            expect(err.message).toMatch(/non-diffusible/i);
        });
    });

    describe("fetch() — non-OK API response", () => {
        it("throws on 400 response", async () => {
            vi.stubGlobal("fetch", mockFetch({}, 400));

            await expect(connector.fetch(makeRef("542051180"))).rejects.toThrow(
                /api error: 400/i
            );
        });

        it("throws on 500 response", async () => {
            vi.stubGlobal("fetch", mockFetch({}, 500));

            await expect(connector.fetch(makeRef("542051180"))).rejects.toThrow(
                /api error: 500/i
            );
        });
    });

    describe("fetch() — invalid SIREN format", () => {
        it("throws for a SIREN that is not 9 digits", async () => {
            await expect(connector.fetch(makeRef("12345"))).rejects.toThrow(
                /invalid siren format/i
            );
        });

        it("throws for a SIREN containing non-numeric characters", async () => {
            await expect(connector.fetch(makeRef("ABCDEFGHI"))).rejects.toThrow(
                /invalid siren format/i
            );
        });
    });

    // ── normalize() — unit tests ─────────────────────────────────────────────

    describe("normalize() — standalone unit tests", () => {
        it("throws on null input", () => {
            expect(() => connector.normalize(null)).toThrow(
                /cannot normalize empty registry record/i
            );
        });

        it("returns correct sourceType and registryKey", () => {
            const record = connector.normalize(SAMPLE_COMPANY);
            expect(record.sourceType).toBe("REGISTRATION_AUTHORITY");
            expect(record.registryKey).toBe("FR_RECHERCHE_ENTREPRISES");
        });

        it("sets country to FR unconditionally", () => {
            const record = connector.normalize(SAMPLE_COMPANY);
            expect(record.registeredAddress?.country).toBe("FR");
        });

        it("handles missing dirigeants gracefully", () => {
            const { dirigeants, ...rest } = SAMPLE_COMPANY;
            const record = connector.normalize(rest);
            expect(record.officers).toEqual([]);
        });

        it("handles missing siege gracefully", () => {
            const { siege, ...rest } = SAMPLE_COMPANY;
            const record = connector.normalize(rest);
            expect(record.registeredAddress?.country).toBe("FR");
            expect(record.registeredAddress?.lines).toEqual([]);
        });
    });
});
