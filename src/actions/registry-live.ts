"use server";

import { RegistryConnectorFactory } from "@/domain/registry/RegistryConnectorFactory";
import { CompaniesHouseConnector } from "@/domain/registry/connectors/CompaniesHouseConnector";
import { initializeRegistryDomain } from "@/domain/registry";

// Ensure connectors are registered
initializeRegistryDomain();

/**
 * Server Action: Fetch a live record from a registry and return the normalized CanonicalRegistryRecord.
 * This is used for the Data Inspector in the mapping admin UI.
 */
export async function fetchLiveRegistryRecord(registrationNumber: string, registryKey: string = "GB_COMPANIES_HOUSE") {
    if (!registrationNumber || registrationNumber.trim().length < 3) {
        return { success: false, error: "Please enter at least 3 characters." };
    }

    try {
        // Resolve appropriate connector based on registryKey; fallback to CompaniesHouseConnector
        const connectorKey = `${registryKey.replace(/_/g, "")}Connector`;
        const connector = RegistryConnectorFactory.getConnectorByKey(connectorKey) ||
            RegistryConnectorFactory.getConnectorByKey("CompaniesHouseConnector");
        if (!connector) {
            return { success: false, error: "Registry connector not found." };
        }

        // We use a dummy reference object for the live fetch
        const reference = {
            localRegistrationNumber: registrationNumber.trim(),
            registryAuthorityId: "RA000585", // UK CH
        } as any;

        const record = await connector.fetch(reference);
        
        if (!record) {
            return { success: false, error: "No record found for that registration number." };
        }

        // Return the normalized canonical record
        return { success: true, payload: record };
        
    } catch (error) {
        console.error("Registry Live Fetch Error:", error);
        return { success: false, error: error.message || "Failed to fetch from registry API." };
    }
}
