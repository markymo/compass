"use server";

export async function fetchLiveGleifRecord(leiOrName: string) {
    if (!leiOrName || leiOrName.trim().length < 3) {
        return { success: false, error: "Please enter at least 3 characters." };
    }

    try {
        const cleanQuery = leiOrName.trim().toUpperCase();
        
        // If it looks like a 20-char LEI, hit the specific record endpoint
        if (/^[A-Z0-9]{20}$/.test(cleanQuery)) {
            const response = await fetch(`https://api.gleif.org/api/v1/lei-records/${cleanQuery}`, {
                headers: { 'Accept': 'application/vnd.api+json' }
            });
            
            if (!response.ok) {
                if (response.status === 404) return { success: false, error: "LEI not found." };
                return { success: false, error: `GLEIF API Error: ${response.statusText}` };
            }
            
            const json = await response.json();
            return { success: true, payload: json.data?.attributes };
        } 
        
        // Otherwise, perform a search by name and return the first result's attributes
        const encodedName = encodeURIComponent(leiOrName.trim());
        const response = await fetch(`https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodedName}&page[size]=1`, {
            headers: { 'Accept': 'application/vnd.api+json' }
        });
        
        if (!response.ok) {
            return { success: false, error: `GLEIF Search Error: ${response.statusText}` };
        }
        
        const json = await response.json();
        if (!json.data || json.data.length === 0) {
            return { success: false, error: "No records found matching that name." };
        }
        
        return { success: true, payload: json.data[0].attributes };
        
    } catch (error) {
        console.error("GLEIF Live Fetch Error:", error);
        return { success: false, error: "Failed to connect to GLEIF API." };
    }
}
