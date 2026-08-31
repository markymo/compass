import { describe, it, expect } from "vitest";
import { getRegistryEntityUrl, isSafeRegistryUrl } from "../registry-urls";
import { RawFieldSource } from "../master-data/field-interpreter";
import { resolveCanonicalFieldDisplay } from "../export/export-answer-resolver";

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

    describe("Upstream Pipeline Interpretation Proof (Stored Claim / Provenance -> RawFieldSource -> FieldDisplayModel -> Trusted URL)", () => {
        it("converts stored Companies House answer provenance into FieldDisplayModel with verified entityUrl and identifier", async () => {
            // Upstream stored database record / submissionAnswer shape
            const storedProvenanceJson = {
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "COMPANIES_HOUSE",
                entityIdentifier: "07640868",
                assertedAt: "2026-08-30T12:00:00.000Z",
                sourceCheckedAt: "2026-08-30T12:00:00.000Z"
            };

            // Production RawFieldSource construction from stored provenance
            const primarySource: RawFieldSource = {
                type: storedProvenanceJson.sourceType as any,
                reference: storedProvenanceJson.sourceReference,
                timestamp: storedProvenanceJson.assertedAt,
                sourceCheckedAt: storedProvenanceJson.sourceCheckedAt,
                entityIdentifier: storedProvenanceJson.entityIdentifier,
                userName: null
            };

            const { displayModel } = await resolveCanonicalFieldDisplay({
                derivedValue: "Acme Legal Entity Ltd",
                primarySource,
                meta: {
                    fieldNo: 3,
                    label: "Legal Name",
                    displayState: "HAS_VALUE"
                }
            });

            expect(displayModel.source).toBeDefined();
            expect(displayModel.source?.type).toBe("REGISTRATION_AUTHORITY");
            expect(displayModel.source?.reference).toBe("COMPANIES_HOUSE");
            expect(displayModel.source?.entityIdentifier).toBe("07640868");
            expect(displayModel.source?.entityUrl).toBe("https://find-and-update.company-information.service.gov.uk/company/07640868");
        });

        it("converts stored GLEIF answer provenance into FieldDisplayModel with verified entityUrl and identifier", async () => {
            // Upstream stored database record / submissionAnswer shape
            const storedProvenanceJson = {
                sourceType: "GLEIF",
                sourceReference: "GLEIF",
                entityIdentifier: "213800AB12CD34EF5678",
                assertedAt: "2026-08-30T12:00:00.000Z",
                sourceCheckedAt: "2026-08-30T12:00:00.000Z"
            };

            // Production RawFieldSource construction from stored provenance
            const primarySource: RawFieldSource = {
                type: storedProvenanceJson.sourceType as any,
                reference: storedProvenanceJson.sourceReference,
                timestamp: storedProvenanceJson.assertedAt,
                sourceCheckedAt: storedProvenanceJson.sourceCheckedAt,
                entityIdentifier: storedProvenanceJson.entityIdentifier,
                userName: null
            };

            const { displayModel } = await resolveCanonicalFieldDisplay({
                derivedValue: "213800AB12CD34EF5678",
                primarySource,
                meta: {
                    fieldNo: 1,
                    label: "LEI",
                    displayState: "HAS_VALUE"
                }
            });

            expect(displayModel.source).toBeDefined();
            expect(displayModel.source?.type).toBe("GLEIF");
            expect(displayModel.source?.entityIdentifier).toBe("213800AB12CD34EF5678");
            expect(displayModel.source?.entityUrl).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");
        });

        it("converts stored Companies House (RA000585) claim into FieldDisplayModel with left-padded entityUrl", async () => {
            const storedClaim = {
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "RA000585",
                entityIdentifier: "747608",
                assertedAt: new Date("2026-08-30T12:00:00.000Z")
            };

            const primarySource: RawFieldSource = {
                type: storedClaim.sourceType as any,
                reference: storedClaim.sourceReference,
                timestamp: storedClaim.assertedAt,
                entityIdentifier: storedClaim.entityIdentifier,
                userName: null
            };

            const { displayModel } = await resolveCanonicalFieldDisplay({
                derivedValue: "Padded Company Ltd",
                primarySource,
                meta: {
                    fieldNo: 3,
                    label: "Legal Name",
                    displayState: "HAS_VALUE"
                }
            });

            expect(displayModel.source?.entityIdentifier).toBe("747608");
            expect(displayModel.source?.entityUrl).toBe("https://find-and-update.company-information.service.gov.uk/company/00747608");
        });
    });

    describe("Full Production Provenance Pipeline (Persisted EvidenceStore -> KycStateService.mapToDerivedValue -> FieldDisplayModel)", () => {
        it("Companies House 07640868: persisted EvidenceStore payload transforms into trusted registry URL", async () => {
            const { KycStateService } = await import("../kyc/KycStateService");

            // Persisted FieldClaim + EvidenceStore shape created by RegistryEnrichmentService / KycWriteService
            const chClaim: any = {
                id: "claim-ch-07640868",
                fieldNo: 3,
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "REGISTRATION_AUTHORITY",
                sourceReference: "COMPANIES_HOUSE",
                valueText: "Acme Industrial Ltd",
                assertedAt: new Date("2026-06-01T12:00:00Z"),
                evidence: {
                    id: "ev-ch-1",
                    provider: "REGISTRATION_AUTHORITY",
                    payload: {
                        COMPANY_PROFILE: {
                            company_number: "07640868",
                            company_name: "Acme Industrial Ltd",
                            company_status: "active"
                        },
                        OFFICERS: [],
                        PSC: []
                    },
                    schemaVersion: "2.0",
                    retrievedAt: new Date("2026-06-01T12:00:00Z")
                }
            };

            // 1. Production KycStateService mapping from persisted claim & evidence
            const derived = KycStateService.mapToDerivedValue(chClaim);
            expect(derived.entityIdentifier).toBe("07640868");
            expect(derived.entityUrl).toBe("https://find-and-update.company-information.service.gov.uk/company/07640868");

            // 2. Production display resolution
            const { displayModel } = await resolveCanonicalFieldDisplay({
                derivedValue: derived.value,
                primarySource: {
                    type: derived.sourceType as any,
                    reference: derived.sourceReference,
                    timestamp: derived.assertedAt,
                    entityIdentifier: derived.entityIdentifier,
                    entityUrl: derived.entityUrl,
                    userName: null
                },
                meta: { fieldNo: 3, label: "Legal Name", displayState: "HAS_VALUE" }
            });

            expect(displayModel.source?.entityIdentifier).toBe("07640868");
            expect(displayModel.source?.entityUrl).toBe("https://find-and-update.company-information.service.gov.uk/company/07640868");
        });

        it("GLEIF 213800AB12CD34EF5678: persisted EvidenceStore payload transforms into trusted registry URL", async () => {
            const { KycStateService } = await import("../kyc/KycStateService");

            // Persisted FieldClaim + EvidenceStore shape created by LegalEntityEnrichmentService / KycWriteService
            const gleifClaim: any = {
                id: "claim-gleif-213800AB12CD34EF5678",
                fieldNo: 1,
                claimRole: "VALUE",
                status: "ASSERTED",
                sourceType: "GLEIF",
                sourceReference: "GLEIF",
                valueText: "213800AB12CD34EF5678",
                assertedAt: new Date("2026-06-01T12:00:00Z"),
                evidence: {
                    id: "ev-gleif-1",
                    provider: "GLEIF",
                    payload: {
                        data: [
                            {
                                id: "213800AB12CD34EF5678",
                                attributes: {
                                    lei: "213800AB12CD34EF5678",
                                    entity: {
                                        legalName: { name: "Acme Global Holdings Ltd" },
                                        status: "ACTIVE"
                                    }
                                }
                            }
                        ]
                    },
                    schemaVersion: "2.0",
                    retrievedAt: new Date("2026-06-01T12:00:00Z")
                }
            };

            // 1. Production KycStateService mapping from persisted claim & evidence
            const gleifDerived = KycStateService.mapToDerivedValue(gleifClaim);
            expect(gleifDerived.entityIdentifier).toBe("213800AB12CD34EF5678");
            expect(gleifDerived.entityUrl).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");

            // 2. Production display resolution
            const { displayModel } = await resolveCanonicalFieldDisplay({
                derivedValue: gleifDerived.value,
                primarySource: {
                    type: gleifDerived.sourceType as any,
                    reference: gleifDerived.sourceReference,
                    timestamp: gleifDerived.assertedAt,
                    entityIdentifier: gleifDerived.entityIdentifier,
                    entityUrl: gleifDerived.entityUrl,
                    userName: null
                },
                meta: { fieldNo: 1, label: "LEI", displayState: "HAS_VALUE" }
            });

            expect(displayModel.source?.entityIdentifier).toBe("213800AB12CD34EF5678");
            expect(displayModel.source?.entityUrl).toBe("https://search.gleif.org/#/record/213800AB12CD34EF5678");
        });
    });
});
