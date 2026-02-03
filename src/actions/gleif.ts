"use server";
// Trigger CI Build


export interface GLEIFData {
    data: {
        id: string; // The LEI
        type: string;
        attributes: {
            lei: string;
            entity: {
                legalName: {
                    name: string;
                    language: string;
                };
                legalAddress: {
                    language: string;
                    addressLines: string[];
                    city: string;
                    country: string;
                    postalCode: string;
                };
                headquartersAddress: {
                    language: string;
                    addressLines: string[];
                    city: string;
                    country: string;
                    postalCode: string;
                };
                registeredAt: {
                    id: string;
                };
                registeredAs: string;
                jurisdiction: string;
                status: string;
            };
            registration: {
                initialRegistrationDate: string;
                lastUpdateDate: string;
                status: string;
                nextRenewalDate: string;
                managingLOU: string;
            };
        };
    }[];
}

export type GLEIFFetchResult =
    | { success: true; data: any; summary: { name: string; jurisdiction: string; address: string; status: string } }
    | { success: false; error: string };

/**
 * Validates an LEI string (format only)
 */
function isValidLEIFormat(lei: string): boolean {
    return /^[A-Z0-9]{20}$/.test(lei);
}

/**
 * Fetches LEI data from the GLEIF API
 */
export async function fetchGLEIFData(lei: string): Promise<GLEIFFetchResult> {
    const cleanLEI = lei.trim().toUpperCase();

    if (!isValidLEIFormat(cleanLEI)) {
        return { success: false, error: "Invalid LEI format. Must be 20 alphanumeric characters." };
    }

    try {
        const response = await fetch(`https://api.gleif.org/api/v1/lei-records?filter[lei]=${cleanLEI}`, {
            headers: {
                'Accept': 'application/vnd.api+json'
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { success: false, error: "Legal Entity not found in GLEIF database." };
            }
            return { success: false, error: `GLEIF API Error: ${response.statusText}` };
        }

        const json: GLEIFData = await response.json();

        if (!json.data || json.data.length === 0) {
            return { success: false, error: "No records found for this LEI." };
        }

        const record = json.data[0];
        const attributes = record.attributes;
        const entity = attributes.entity;

        // Create a normalized summary for the UI
        const summary = {
            name: entity.legalName.name,
            jurisdiction: entity.jurisdiction,
            address: `${entity.legalAddress.addressLines.join(", ")}, ${entity.legalAddress.city}, ${entity.legalAddress.country}`,
            status: attributes.registration.status // e.g. ISSUED, LAPSED
        };

        return {
            success: true,
            data: record, // Store the full record
            summary
        };

    } catch (error) {
        console.error("GLEIF Fetch Error:", error);
        return { success: false, error: "Failed to connect to GLEIF API." };
    }
}

export interface GLEIFSearchResult {
    id: string;
    name: string;
    jurisdiction: string;
    status: string;
}

/**
 * Searches GLEIF By Name
 * URL: https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=...
 */
export async function searchGLEIFByName(name: string): Promise<{ success: boolean; results?: GLEIFSearchResult[]; error?: string }> {
    const cleanName = name.trim();
    if (cleanName.length < 3) return { success: false, error: "Please enter at least 3 characters." };

    try {
        // 'contains' often works better than exact match for names
        // But the standard filter[entity.legalName] is usually a contains search in GLEIF v1?
        // Let's stick to the standard filter.
        const encodedName = encodeURIComponent(cleanName);
        const url = `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodedName}&page[size]=10&page[number]=1`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/vnd.api+json' },
            next: { revalidate: 300 } // Cache searches for 5 mins
        });

        if (!response.ok) {
            return { success: false, error: `GLEIF Search Error: ${response.statusText}` };
        }

        const json: GLEIFData = await response.json();

        if (!json.data || json.data.length === 0) {
            return { success: true, results: [] };
        }

        const results: GLEIFSearchResult[] = json.data.map(record => ({
            id: record.attributes.lei, // or record.id
            name: record.attributes.entity.legalName.name,
            jurisdiction: record.attributes.entity.jurisdiction,
            status: record.attributes.registration.status
        }));

        return { success: true, results };

    } catch (error) {
        console.error("GLEIF Search Error:", error);
        return { success: false, error: "Connection failed" };
    }
}
