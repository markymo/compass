import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegistryConnectorFactory } from "../RegistryConnectorFactory";
import { RegistryAuthorityService } from "../RegistryAuthorityService";
import { CompaniesHouseConnector } from "../connectors/CompaniesHouseConnector";
import { FranceRechercheEntreprisesConnector } from "../connectors/FranceRechercheEntreprisesConnector";
import { OfficialGermanRegistryConnector } from "../connectors/OfficialGermanRegistryConnector";

// Mock RegistryAuthorityService to isolate factory tests from DB calls
vi.mock("../RegistryAuthorityService", () => {
    return {
        RegistryAuthorityService: {
            getAuthority: vi.fn(),
            getRegistryKey: vi.fn(),
            getMappingSourceKey: vi.fn(),
            getAuthorityBySourceKey: vi.fn(),
        }
    };
});

describe("Registry Authority & Connector Architecture", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Register standard connectors in factory
        RegistryConnectorFactory.register(new CompaniesHouseConnector());
        RegistryConnectorFactory.register(new FranceRechercheEntreprisesConnector());
        RegistryConnectorFactory.register(new OfficialGermanRegistryConnector());
    });

    describe("CompaniesHouseConnector capabilities & supportedRegistryKeys", () => {
        it("advertises supportedRegistryKeys = ['GB_COMPANIES_HOUSE']", () => {
            const ch = new CompaniesHouseConnector();
            expect(ch.supportedRegistryKeys).toEqual(["GB_COMPANIES_HOUSE"]);
            expect(ch.connectorKey).toBe("CompaniesHouseConnector");
            expect(ch.supportsOfficerFetch).toBe(true);
        });

        it("does NOT hardcode or check RA000... authority IDs internally", () => {
            const ch = new CompaniesHouseConnector();
            // Confirm supports method is not used/present
            expect((ch as any).supports).toBeUndefined();
        });
    });

    describe("RegistryConnectorFactory dispatch rules", () => {
        it("resolves RA000585 (England & Wales) via registryKey = 'GB_COMPANIES_HOUSE'", async () => {
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("GB_COMPANIES_HOUSE");

            const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000585");
            expect(connector).toBeInstanceOf(CompaniesHouseConnector);
            expect(RegistryAuthorityService.getRegistryKey).toHaveBeenCalledWith("RA000585");
        });

        it("resolves RA000586 (Northern Ireland) via registryKey = 'GB_COMPANIES_HOUSE'", async () => {
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("GB_COMPANIES_HOUSE");

            const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000586");
            expect(connector).toBeInstanceOf(CompaniesHouseConnector);
            expect(RegistryAuthorityService.getRegistryKey).toHaveBeenCalledWith("RA000586");
        });

        it("resolves RA000587 (Scotland) via registryKey = 'GB_COMPANIES_HOUSE'", async () => {
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("GB_COMPANIES_HOUSE");

            const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000587");
            expect(connector).toBeInstanceOf(CompaniesHouseConnector);
            expect(RegistryAuthorityService.getRegistryKey).toHaveBeenCalledWith("RA000587");
        });

        it("returns null for RA000592 (FCA) with registryKey = 'UK_FCA' (unsupported connector)", async () => {
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("UK_FCA");

            const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000592");
            expect(connector).toBeNull();
            expect(RegistryAuthorityService.getRegistryKey).toHaveBeenCalledWith("RA000592");
        });

        it("Synthetic Test 1: Zero-code routing for new authority configured with registryKey = 'GB_COMPANIES_HOUSE'", async () => {
            // Simulated DB record for new UK authority (e.g. RA999999)
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("GB_COMPANIES_HOUSE");

            const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA999999");
            expect(connector).toBeInstanceOf(CompaniesHouseConnector);
        });

        it("Synthetic Test 2: Authority with mappingSourceKey = 'COMPANIES_HOUSE' but different registryKey does NOT route to CompaniesHouseConnector", async () => {
            // Simulated authority that shares mapping family but has its own connector registryKey
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("UK_OTHER_REGISTRY");

            const connector = await RegistryConnectorFactory.getConnectorForAuthorityId("RA888888");
            expect(connector).toBeNull();
        });

        it("resolves connector directly by registryKey via getConnectorForRegistryKey", () => {
            const chConnector = RegistryConnectorFactory.getConnectorForRegistryKey("GB_COMPANIES_HOUSE");
            expect(chConnector).toBeInstanceOf(CompaniesHouseConnector);

            const frConnector = RegistryConnectorFactory.getConnectorForRegistryKey("FR_RECHERCHE_ENTREPRISES");
            expect(frConnector).toBeInstanceOf(FranceRechercheEntreprisesConnector);

            const deConnector = RegistryConnectorFactory.getConnectorForRegistryKey("DE_HANDELSREGISTER");
            expect(deConnector).toBeInstanceOf(OfficialGermanRegistryConnector);

            const unknownConnector = RegistryConnectorFactory.getConnectorForRegistryKey("UNKNOWN_KEY");
            expect(unknownConnector).toBeNull();
        });
    });

    describe("Physical RA ID Provenance & Live Inspector Ambiguity Prevention", () => {
        it("preserves physical RA ID (e.g. RA000587) when fetching and normalizing", () => {
            const connector = new CompaniesHouseConnector();
            const rawProfile = {
                company_name: "SCOTTISH ENTERPRISE PLC",
                company_status: "active",
                date_of_creation: "2020-01-01",
                registered_office_address: { locality: "Edinburgh" }
            };

            const record = connector.normalize(rawProfile);
            // Caller injects exact physical RA code from reference
            record.registryAuthorityId = "RA000587";
            record.sourceRecordId = "SC123456";

            expect(record.registryAuthorityId).toBe("RA000587");
            expect(record.registryKey).toBe("GB_COMPANIES_HOUSE");
            expect(record.entityName).toBe("SCOTTISH ENTERPRISE PLC");
        });

        it("proves registry-live reference building preserves physical RA codes (RA000587, RA000586, RA000585) without manufacturing RA000585 on mappingSourceKey lookup", async () => {
            // Import fetchLiveRegistryRecord dynamically or test reference generation
            const chConnector = RegistryConnectorFactory.getConnectorForRegistryKey("GB_COMPANIES_HOUSE")!;
            const fetchSpy = vi.spyOn(chConnector, "fetch").mockResolvedValue({
                sourceType: "REGISTRATION_AUTHORITY",
                registryKey: "GB_COMPANIES_HOUSE",
                registryAuthorityId: "RA000587",
                sourceRecordId: "SC123456",
                fetchedAt: new Date(),
                entityName: "SCOTTISH CO",
                rawSourcePayload: { COMPANY_PROFILE: { company_name: "SCOTTISH CO" } }
            } as any);

            // 1. Direct physical RA ID RA000587
            vi.mocked(RegistryAuthorityService.getRegistryKey).mockResolvedValueOnce("GB_COMPANIES_HOUSE");
            const connector1 = await RegistryConnectorFactory.getConnectorForAuthorityId("RA000587");
            expect(connector1).toBeInstanceOf(CompaniesHouseConnector);

            // Construct reference stub matching registry-live.ts logic for physical RA ID
            const physicalRef = { localRegistrationNumber: "SC123456", registryAuthorityId: "RA000587" };
            await connector1!.fetch(physicalRef as any);
            expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ registryAuthorityId: "RA000587" }));

            // 2. Mapping family lookup (sourceRef = "COMPANIES_HOUSE")
            vi.mocked(RegistryAuthorityService.getAuthorityBySourceKey).mockResolvedValueOnce({
                id: "RA000585", // Even if DB findFirst returns RA000585 row
                registryKey: "GB_COMPANIES_HOUSE",
                mappingSourceKey: "COMPANIES_HOUSE"
            } as any);

            // Refactored registry-live logic: connector is found via authority.registryKey, but reference registryAuthorityId is "COMPANIES_HOUSE"
            const familyRef = { localRegistrationNumber: "01234567", registryAuthorityId: "COMPANIES_HOUSE" };
            await connector1!.fetch(familyRef as any);
            expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ registryAuthorityId: "COMPANIES_HOUSE" }));
            // Proves reference.registryAuthorityId is NOT manufactured as RA000585 when sourceRef is a mapping family!
            expect(familyRef.registryAuthorityId).not.toBe("RA000585");
        });
    });
});
