import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegistryConnectorFactory } from "../RegistryConnectorFactory";
import { RegistryAuthorityService } from "../RegistryAuthorityService";
import { CompaniesHouseConnector } from "../connectors/CompaniesHouseConnector";
import { fetchGLEIFData } from "@/actions/gleif";

// Contract: SRC-03 — Unsupported registration authority fails gracefully
// Linear: ONP-44

vi.mock("../RegistryAuthorityService", () => ({
    RegistryAuthorityService: {
        getRegistryKey: vi.fn(),
        getMappingSourceKey: vi.fn(),
    }
}));

vi.mock("@/actions/kyc-query", () => ({
    getCCAddresses: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

describe("SRC-03 / ONP-44 — Unsupported Registration Authority (RA000592 / UK_FCA)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        RegistryConnectorFactory.register(new CompaniesHouseConnector());
    });

    it("1. RA000592 (UK Financial Conduct Authority) is recognised but intentionally maps to no national connector", async () => {
        vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("UK_FCA");

        const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000592");
        expect(connector).toBeNull();
        expect(RegistryAuthorityService.getRegistryKey).toHaveBeenCalledWith("RA000592");
    });

    it("2. Supported RA (RA000585 / Companies House) resolves to active connector", async () => {
        vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("GB_COMPANIES_HOUSE");

        const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000585");
        expect(connector).not.toBeNull();
        expect(connector).toBeInstanceOf(CompaniesHouseConnector);
    });

    it("3. GLEIF enrichment completes successfully for entity with RA000592 without throwing or blocking wider enrichment", async () => {
        // Mock global fetch for GLEIF API returning an FCA-registered entity
        const mockGleifPayload = {
            data: [
                {
                    id: "213800AB12CD34EF5678",
                    type: "lei-records",
                    attributes: {
                        lei: "213800AB12CD34EF5678",
                        entity: {
                            legalName: { name: "FCA Regulated Mutual Society Ltd", language: "en" },
                            legalAddress: {
                                language: "en",
                                addressLines: ["25 The North Colonnade"],
                                city: "London",
                                country: "GB",
                                postalCode: "E14 5HS"
                            },
                            registeredAt: { id: "RA000592" },
                            registeredAs: "123456",
                            jurisdiction: "GB",
                            status: "ACTIVE"
                        },
                        registration: {
                            initialRegistrationDate: "2020-01-01",
                            lastUpdateDate: "2026-01-01",
                            status: "ISSUED",
                            nextRenewalDate: "2027-01-01",
                            managingLOU: "213800WAVVOPS85N2205"
                        }
                    },
                    relationships: {
                        "direct-parent": { links: { related: "https://api.gleif.org/api/v1/lei-records/..." } }
                    }
                }
            ]
        };

        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes("api.gleif.org/api/v1/lei-records?filter[lei]=213800AB12CD34EF5678")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockGleifPayload)
                });
            }
            if (url.includes("registration-authorities/RA000592")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            attributes: {
                                internationalName: "Financial Conduct Authority Mutuals Public Register"
                            }
                        }
                    })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: null })
            });
        }) as any;

        try {
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValue("UK_FCA");

            const result = await fetchGLEIFData("213800AB12CD34EF5678");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
                expect(result.data.registrationAuthorityName).toBe("Financial Conduct Authority Mutuals Public Register");
                // No national registry connector data since RA000592 is unsupported
                expect(result.data.nationalRegistryData).toBeNull();
                expect(result.summary.name).toBe("FCA Regulated Mutual Society Ltd");
            }
        } finally {
            global.fetch = originalFetch;
        }
    });
});
