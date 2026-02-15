"use server";

import prisma from "@/lib/prisma";
import { fetchCompanyOfficers } from "@/lib/companies-house";
import { revalidatePath } from "next/cache";

export async function refreshLocalRegistryData(leId: string) {
    try {
        // 1. Fetch Client LE to get Jurisdiction and LEI/Registration details
        const le = await prisma.clientLE.findUnique({
            where: { id: leId }
        });

        if (!le) {
            return { success: false, error: "Legal Entity not found" };
        }

        // 2. Determine Jurisdiction and Strategy
        let companyNumber = null;
        let jurisdiction = le.jurisdiction;

        // Try to get company number from existing registry data
        if (le.nationalRegistryData && (le.nationalRegistryData as any).company_number) {
            companyNumber = (le.nationalRegistryData as any).company_number;
        }
        // Fallback to GLEIF data if available
        else if (le.gleifData) {
            const gleif = le.gleifData as any;
            // The structure is { data: [ { attributes: { entity: { ... } } } ] } or similar depending on how we stored it.
            // Let's assume we stored the raw GLEIF response or the normalized one.
            // Actually, in gleif.ts, we store the whole object.
            // Let's be defensive.

            // Check normalized summary if we stored it? No, gleif.ts returns data and summary separately.
            // In gleif.ts: `data: { ...record, nationalRegistryData }`
            // So le.gleifData is likely that object.

            const attributes = gleif?.attributes || gleif?.data?.[0]?.attributes;
            const entity = attributes?.entity;

            if (entity) {
                if (!jurisdiction) jurisdiction = entity.jurisdiction;
                companyNumber = entity.registeredAs;
            }
        }

        if (!companyNumber) {
            // Last ditch: check if 'lei' exists and we can re-fetch GLEIF to get company number? 
            // For now, fail if we don't have it.
            return { success: false, error: "No Company Number found. Please ensure GLEIF data is synced first." };
        }

        // 3. Routing Logic (Strategy Pattern)
        let newRegistryData = null;

        if (jurisdiction === "GB" || jurisdiction === "UK") {
            // Companies House Strategy
            const officers = await fetchCompanyOfficers(companyNumber);

            newRegistryData = {
                source: "Companies House",
                company_number: companyNumber,
                officers: officers,
                last_checked: new Date().toISOString()
            };
        } else {
            return { success: false, error: `Automated registry refresh not supported for jurisdiction: ${jurisdiction}` };
        }

        // 4. Update Database
        await prisma.clientLE.update({
            where: { id: leId },
            data: {
                nationalRegistryData: newRegistryData as any,
                registryFetchedAt: new Date()
            }
        });

        revalidatePath(`/app/le/${leId}/sources/registry`);
        return { success: true };

    } catch (error: any) {
        console.error("Registry Refresh Error:", error);
        return { success: false, error: error.message || "Failed to refresh registry data" };
    }
}
