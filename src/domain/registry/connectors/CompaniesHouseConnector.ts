import { IRegistryConnector } from "../types/RegistryConnector";
import { RegistryReference } from "@prisma/client";
import { CanonicalRegistryRecord } from "../types/CanonicalRegistryRecord";
import { SicCodeMapper } from "../utils/SicCodeMapper";

/**
 * Helper to normalize and left-pad UK Companies House company numbers to 8 characters.
 * E.g. "747608" -> "00747608", "14059418" -> "14059418", "SC123456" -> "SC123456".
 */
function formatCompanyNumber(num: string): string {
    const trimmed = (num || "").trim().toUpperCase();
    if (/^\d+$/.test(trimmed)) {
        return trimmed.padStart(8, "0");
    }
    return trimmed;
}

/**
 * UK Companies House Registry Connector.
 * Communicates with official UK Companies House API endpoint using HTTP Basic Auth.
 */
export class CompaniesHouseConnector implements IRegistryConnector {
    readonly connectorKey = "CompaniesHouseConnector";
    readonly supportedRegistryKeys = ["GB_COMPANIES_HOUSE"];
    readonly supportsOfficerFetch = true;

    async fetch(reference: RegistryReference): Promise<CanonicalRegistryRecord> {
        const rawCompanyNumber = reference.localRegistrationNumber;
        const companyNumber = formatCompanyNumber(rawCompanyNumber);
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

        if (!apiKey) {
            throw new Error("Companies House API key not configured. National registry enrichment is disabled.");
        }

        console.log(`[CompaniesHouseConnector] Fetching real data for UK company ${companyNumber} (raw: "${rawCompanyNumber}")...`);

        try {
            const authHeader = `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;
            
            // 1. Fetch Company Profile
            const profileRes = await fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}`, {
                headers: { "Authorization": authHeader }
            });

            if (!profileRes.ok) {
                if (profileRes.status === 404) {
                    throw new Error(
                        `Companies House API: Company number "${companyNumber}" (raw: "${rawCompanyNumber}") was not found (404 Not Found). ` +
                        `Please check that this is a valid UK Companies House registration number.`
                    );
                }
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
            console.error("[CompaniesHouseConnector] Real fetch failed:", error);
            throw error;
        }
    }

    normalize(raw: any): CanonicalRegistryRecord {
        if (!raw) {
            throw new Error("Cannot normalize empty registry record");
        }
        
        // Extract the profile part (the main raw object without the injected arrays)
        const { officers, pscs, ...profile } = raw;

        return {
            sourceType: "REGISTRATION_AUTHORITY",
            registryKey: "GB_COMPANIES_HOUSE",
            registryAuthorityId: "", // To be filled by caller
            sourceRecordId: "", // To be filled by caller
            fetchedAt: new Date(),
            entityName: profile.company_name || "-",
            entityStatus: profile.company_status,
            incorporationDate: profile.date_of_creation,
            registeredAddress: {
                city: profile.registered_office_address?.locality,
                lines: [profile.registered_office_address?.address_line_1].filter(Boolean) as string[],
                country: profile.registered_office_address?.country,
                postalCode: profile.registered_office_address?.postal_code
            },
            officers: officers || [],
            pscs: pscs || [],
            sicCodes: profile.sic_codes ? SicCodeMapper.mapCodes(profile.sic_codes) : [],
            identifiers: [],
            // Structured for the EnrichmentService to split into separate DB rows
            rawSourcePayload: {
                COMPANY_PROFILE: profile,
                OFFICERS: officers || [],
                PSC: pscs || []
            }
        };
    }
}
