import { IRegistryConnector } from "../types/RegistryConnector";
import { RegistryReference } from "@prisma/client";
import { CanonicalRegistryRecord } from "../types/CanonicalRegistryRecord";
import { SicCodeMapper } from "../utils/SicCodeMapper";

/**
 * Placeholder for UK Companies House Connector.
 * In a real implementation, this would use a fetch client with a CH API Key.
 */
export class CompaniesHouseConnector implements IRegistryConnector {
    readonly connectorKey = "CompaniesHouseConnector";

    supports(authorityId: string): boolean {
        // RA000585 is the RAID for UK Companies House
        return authorityId === "RA000585";
    }

    async fetch(reference: RegistryReference): Promise<CanonicalRegistryRecord> {
        const companyNumber = reference.localRegistrationNumber;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

        if (!apiKey) {
            console.warn("[CompaniesHouseConnector] No API key found, falling back to mock");
            return await this.fetchMock(reference);
        }

        console.log(`[CompaniesHouseConnector] Fetching real data for UK company ${companyNumber}...`);

        try {
            const authHeader = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;
            
            // 1. Fetch Company Profile
            const profileRes = await fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}`, {
                headers: { "Authorization": authHeader }
            });

            if (!profileRes.ok) {
                throw new Error(`Companies House API error: ${profileRes.status} ${profileRes.statusText}`);
            }

            const profile = await profileRes.json();

            // 2. Fetch Officers
            let officers: any[] = [];
            try {
                const officersRes = await fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}/officers`, {
                    headers: { "Authorization": authHeader }
                });
                if (officersRes.ok) {
                    const officersData = await officersRes.json();
                    officers = officersData.items || [];
                }
            } catch (e) {
                console.warn("[CompaniesHouseConnector] Failed to fetch officers:", e);
            }

            // 3. Fetch PSCs (Persons with Significant Control)
            let pscs: any[] = [];
            try {
                const pscsRes = await fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}/persons-with-significant-control`, {
                    headers: { "Authorization": authHeader }
                });
                if (pscsRes.ok) {
                    const pscsData = await pscsRes.json();
                    pscs = pscsData.items || [];
                }
            } catch (e) {
                console.warn("[CompaniesHouseConnector] Failed to fetch PSCs:", e);
            }

            const record = this.normalize({ ...profile, officers, pscs });
            
            // Inject context from reference
            record.registryAuthorityId = reference.registryAuthorityId;
            record.sourceRecordId = companyNumber;
            record.fetchedAt = new Date();

            return record;
        } catch (error) {
            console.error("[CompaniesHouseConnector] Real fetch failed, falling back to mock:", error);
            return await this.fetchMock(reference);
        }
    }

    async fetchMock(reference: RegistryReference): Promise<CanonicalRegistryRecord> {
        const companyNumber = reference.localRegistrationNumber;
        // Keep the old mock logic as a safety fallback
        const mockRaw = {
            company_name: "BRITISH AIRWAYS PLC",
            company_status: "active",
            date_of_creation: "2011-05-18",
            registered_office_address: {
                address_line_1: "10 Downing Street",
                locality: "London",
                postal_code: "SW1A 2AA",
                country: "United Kingdom"
            },
            officers: [
                {
                    name: "DOE, John",
                    officer_role: "director",
                    appointed_on: "2011-05-18",
                    occupation: "Software Engineer",
                    address: {
                        premises: "10",
                        address_line_1: "Downing Street",
                        locality: "London",
                        postal_code: "SW1A 2AA"
                    }
                }
            ]
        };

        const record = this.normalize(mockRaw);
        record.registryAuthorityId = reference.registryAuthorityId;
        record.sourceRecordId = companyNumber;
        record.fetchedAt = new Date();

        return record;
    }

    normalize(raw: any): CanonicalRegistryRecord {
        if (!raw) {
            throw new Error("Cannot normalize empty registry record");
        }
        return {
            sourceType: "COMPANIES_HOUSE",
            registryKey: "GB_COMPANIES_HOUSE",
            registryAuthorityId: "", // To be filled by caller
            sourceRecordId: "", // To be filled by caller
            fetchedAt: new Date(),
            entityName: raw.company_name || "-",
            entityStatus: raw.company_status,
            incorporationDate: raw.date_of_creation,
            registeredAddress: {
                city: raw.registered_office_address?.locality,
                lines: [raw.registered_office_address?.address_line_1].filter(Boolean) as string[],
                country: raw.registered_office_address?.country,
                postalCode: raw.registered_office_address?.postal_code
            },
            officers: raw.officers || [],
            pscs: raw.pscs || [],
            sicCodes: raw.sic_codes ? SicCodeMapper.mapCodes(raw.sic_codes) : [],
            identifiers: [], // To be filled by caller or derived from raw
            rawSourcePayload: raw
        };
    }
}
