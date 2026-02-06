"use server";

export interface CompanyOfficer {
    name: string;
    officer_role: string;
    appointed_on?: string;
    resigned_on?: string;
    nationality?: string;
    occupation?: string;
    date_of_birth?: {
        month: number;
        year: number;
        day?: number; // Often omitted for public
    };
    address: {
        premises?: string;
        address_line_1?: string;
        address_line_2?: string;
        locality?: string;
        postal_code?: string;
        country?: string;
    };
}

export interface CompaniesHouseData {
    company_number: string;
    officers: CompanyOfficer[];
    // We can expand this later (e.g. Profile, Filing History)
}

const BASE_URL = "https://api.company-information.service.gov.uk";

/**
 * Fetches the list of officers (directors, etc) for a UK company.
 */
export async function fetchCompanyOfficers(companyNumber: string): Promise<CompanyOfficer[]> {
    const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

    // Debug Log
    console.log(`[CompaniesHouse] Fetching officers for ${companyNumber}. API Key present: ${!!API_KEY} (Len: ${API_KEY?.length})`);

    if (!API_KEY) {
        console.warn("[CompaniesHouse] Missing COMPANIES_HOUSE_API_KEY");
        return [];
    }

    try {
        const auth = Buffer.from(`${API_KEY}:`).toString('base64');
        const url = `${BASE_URL}/company/${companyNumber}/officers`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Basic ${auth}`,
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            console.error(`[CompaniesHouse] API Error (${response.status}): ${response.statusText}`);
            return [];
        }

        const json = await response.json();
        const items = json.items || [];
        console.log(`[CompaniesHouse] Success! Found ${items.length} officers.`);
        return items;

    } catch (error) {
        console.error("[CompaniesHouse] Failed to fetch officers:", error);
        return [];
    }
}
