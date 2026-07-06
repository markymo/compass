"use server";

import { fetchGLEIFData } from "@/actions/gleif";

export async function fetchLiveGleifRecord(leiOrName: string, subtype?: string) {
    if (!leiOrName || leiOrName.trim().length < 3) {
        return { success: false, error: "Please enter at least 3 characters." };
    }

    try {
        const cleanQuery = leiOrName.trim().toUpperCase();
        
        // If it looks like a 20-char LEI, hit the specific record endpoint
        if (/^[A-Z0-9]{20}$/.test(cleanQuery)) {
            const res = await fetchGLEIFData(cleanQuery);
            if (!res.success) {
                return { success: false, error: res.error };
            }
            const data = res.data;
            if (subtype === "LEVEL_1") return { success: true, payload: data.attributes };
            if (subtype === "LEVEL_2_RELATIONSHIPS") return { success: true, payload: data.gleifL2 };
            if (subtype === "ELF") return { success: true, payload: data.gleifElf };
            
            const mergedPayload = {
                ...data.attributes,
                gleifL2: data.gleifL2,
                gleifElf: data.gleifElf,
            };
            return { success: true, payload: mergedPayload };
        } 
        
        // Otherwise, perform a search by name, get first result's LEI, and fetch enriched data
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
        
        const record = json.data[0];
        const lei = record.attributes?.lei || record.id;
        
        const res = await fetchGLEIFData(lei);
        if (!res.success) {
            return { success: false, error: res.error };
        }
        
        const data = res.data;
        if (subtype === "LEVEL_1") return { success: true, payload: data.attributes };
        if (subtype === "LEVEL_2_RELATIONSHIPS") return { success: true, payload: data.gleifL2 };
        if (subtype === "ELF") return { success: true, payload: data.gleifElf };
        
        const mergedPayload = {
            ...data.attributes,
            gleifL2: data.gleifL2,
            gleifElf: data.gleifElf,
        };
        
        return { success: true, payload: mergedPayload };
        
    } catch (error) {
        console.error("GLEIF Live Fetch Error:", error);
        return { success: false, error: "Failed to connect to GLEIF API." };
    }
}
