"use server";

import { RegistryConnectorFactory } from "@/domain/registry/RegistryConnectorFactory";
import { initializeRegistryDomain } from "@/domain/registry";

// Ensure connectors are registered on first call
initializeRegistryDomain();

/**
 * Server Action: Fetch a live record from a specific Registry Authority and
 * return the raw COMPANY_PROFILE payload (from CanonicalRegistryRecord.rawSourcePayload).
 *
 * The Data Inspector uses this to let admins browse real API fields and click-to-map them.
 *
 * @param registrationNumber - The local registration number (company number, SIREN, HRB, etc.)
 * @param authorityId        - GLEIF RA code, e.g. "RA000585" (UK E&W), "RA000192" (France)
 *                             Defaults to RA000585 for backward compatibility.
 */
export async function fetchLiveRegistryRecord(
    registrationNumber: string,
    authorityId: string = "RA000585"
) {
    if (!registrationNumber || registrationNumber.trim().length < 3) {
        return { success: false, error: "Please enter at least 3 characters." };
    }

    try {
        const connector = RegistryConnectorFactory.getConnectorForAuthority(authorityId);
        if (!connector) {
            return {
                success: false,
                error: `No connector registered for authority ${authorityId}. Check that the connector is registered in initializeRegistryDomain().`,
            };
        }

        // Minimal reference stub — connectors only need localRegistrationNumber + registryAuthorityId
        const reference = {
            localRegistrationNumber: registrationNumber.trim(),
            registryAuthorityId: authorityId,
        } as any;

        const record = await connector.fetch(reference);

        if (!record) {
            return { success: false, error: "No record found for that registration number." };
        }

        // Return the raw COMPANY_PROFILE payload so the inspector shows the
        // same field paths that RegistryMappingEngine resolves against.
        // Fall back to the full canonical record if rawSourcePayload is absent.
        const payload = record.rawSourcePayload?.COMPANY_PROFILE ?? record;

        return { success: true, payload };

    } catch (error) {
        console.error("[registry-live] Fetch error:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch from registry API.";
        return { success: false, error: message };
    }
}
