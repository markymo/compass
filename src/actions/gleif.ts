"use server";

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
