import { describe, it, expect } from "vitest";
import { getRegistryEntityUrl, isSafeRegistryUrl } from "../registry-urls";
import { resolveFieldForDisplay, RawFieldSource } from "../master-data/field-interpreter";

describe("Registry Entity URLs Generic Resolver (ONP-37)", () => {
    describe("isSafeRegistryUrl Trust Contract", () => {
        it("accepts trusted registry host URLs (GLEIF, Companies House, France Annuaire Entreprises)", () => {
            // GLEIF
            expect(isSafeRegistryUrl("https://search.gleif.org/#/record/213800AB12CD34EF5678")).toBe(true);
            // Companies House
            expect(isSafeRegistryUrl("https://find-and-update.company-information.service.gov.uk/company/07640868")).toBe(true);
            // France Annuaire Entreprises
            expect(isSafeRegistryUrl("https://annuaire-entreprises.data.gouv.fr/entreprise/552032534")).toBe(true);
        });

        it("rejects untrusted external HTTPS hosts (e.g. evil.example)", () => {
            expect(isSafeRegistryUrl("https://evil.example/malicious")).toBe(false);
            expect(isSafeRegistryUrl("https://attacker.com/gleif")).toBe(false);
            expect(isSafeRegistryUrl("https://company-information.service.gov.uk.attacker.com")).toBe(false);
        });

        it("rejects non-HTTPS, javascript:, data:, and empty schemes", () => {
            expect(isSafeRegistryUrl("http://find-and-update.company-information.service.gov.uk/company/07640868")).toBe(false);
            expect(isSafeRegistryUrl("javascript:alert(1)")).toBe(false);
            expect(isSafeRegistryUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
            expect(isSafeRegistryUrl("")).toBe(false);
            expect(isSafeRegistryUrl(null)).toBe(false);
            expect(isSafeRegistryUrl(undefined)).toBe(false);
        });
    });

    describe("getRegistryEntityUrl Resolution", () => {
        it("resolves GLEIF entity link with valid 20-character LEI", () => {
            const url = getRegistryEntityUrl({
                sourceType: "GLEIF",
                entityIdentifier: "213800AB12CD34EF5678",
            });
            expect(url).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");
        });

        it("resolves Companies House entity link with 8-digit company number", () => {
            const url = getRegistryEntityUrl({
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "COMPANIES_HOUSE",
                entityIdentifier: "07640868",
            });
            expect(url).toBe("https://find-and-update.company-information.service.gov.uk/company/07640868");
        });

        it("resolves Companies House entity link with numeric company number that needs left-padding", () => {
            const url = getRegistryEntityUrl({
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "RA000585",
                entityIdentifier: "747608",
            });
            expect(url).toBe("https://find-and-update.company-information.service.gov.uk/company/00747608");
        });

        it("resolves Companies House entity link with Scottish / NI alphanumeric prefix", () => {
            const url = getRegistryEntityUrl({
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "RA000586",
                entityIdentifier: "SC123456",
            });
            expect(url).toBe("https://find-and-update.company-information.service.gov.uk/company/SC123456");
        });

        it("resolves France RNE / Infogreffe entity link with 9-digit SIREN", () => {
            const url = getRegistryEntityUrl({
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "RA000192",
                entityIdentifier: "552032534",
            });
            expect(url).toBe("https://annuaire-entreprises.data.gouv.fr/entreprise/552032534");
        });

        it("returns explicit entityUrl when already provided and valid trusted host", () => {
            const url = getRegistryEntityUrl({
                sourceType: "GLEIF",
                entityUrl: "https://search.gleif.org/#/record/213800AB12CD34EF5678",
            });
            expect(url).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");
        });

        it("ignores untrusted explicit entityUrl and falls back to resolving from identifier", () => {
            const url = getRegistryEntityUrl({
                sourceType: "GLEIF",
                entityIdentifier: "213800AB12CD34EF5678",
                entityUrl: "https://evil.example/phishing",
            });
            expect(url).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");
        });

        it("returns null gracefully for non-registry sources (USER_INPUT, SYSTEM, DEFAULT)", () => {
            expect(getRegistryEntityUrl({ sourceType: "USER_INPUT", entityIdentifier: "12345" })).toBeNull();
            expect(getRegistryEntityUrl({ sourceType: "SYSTEM", entityIdentifier: "12345" })).toBeNull();
            expect(getRegistryEntityUrl({ sourceType: "DEFAULT", entityIdentifier: "12345" })).toBeNull();
        });

        it("returns null gracefully when entityIdentifier is missing or empty", () => {
            expect(getRegistryEntityUrl({ sourceType: "GLEIF", entityIdentifier: "" })).toBeNull();
            expect(getRegistryEntityUrl({ sourceType: "COMPANIES_HOUSE", entityIdentifier: null })).toBeNull();
            expect(getRegistryEntityUrl({ sourceType: "REGISTRATION_AUTHORITY", sourceReference: "RA000585" })).toBeNull();
        });
    });

    describe("Full Pipeline Interpretation Trace (Raw Claim -> FieldDisplayModel -> FieldSource)", () => {
        it("resolves Companies House raw source into FieldSource with verified entityUrl and identifier", () => {
            const rawSource: RawFieldSource = {
                type: "REGISTRATION_AUTHORITY",
                reference: "COMPANIES_HOUSE",
                entityIdentifier: "07640868",
                timestamp: new Date("2026-08-30T12:00:00Z"),
            };

            const model = resolveFieldForDisplay("Acme Legal Entity Ltd", rawSource, {
                fieldNo: 3,
                label: "Legal Name",
            });

            expect(model.source).toBeDefined();
            expect(model.source?.type).toBe("REGISTRATION_AUTHORITY");
            expect(model.source?.reference).toBe("COMPANIES_HOUSE");
            expect(model.source?.entityIdentifier).toBe("07640868");
            expect(model.source?.entityUrl).toBe("https://find-and-update.company-information.service.gov.uk/company/07640868");
        });

        it("resolves GLEIF raw source into FieldSource with verified entityUrl and identifier", () => {
            const rawSource: RawFieldSource = {
                type: "GLEIF",
                reference: "GLEIF",
                entityIdentifier: "213800AB12CD34EF5678",
                timestamp: new Date("2026-08-30T12:00:00Z"),
            };

            const model = resolveFieldForDisplay("213800AB12CD34EF5678", rawSource, {
                fieldNo: 1,
                label: "LEI",
            });

            expect(model.source).toBeDefined();
            expect(model.source?.type).toBe("GLEIF");
            expect(model.source?.entityIdentifier).toBe("213800AB12CD34EF5678");
            expect(model.source?.entityUrl).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");
        });
    });
});
