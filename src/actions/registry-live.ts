"use server";

import { RegistryConnectorFactory } from "@/domain/registry/RegistryConnectorFactory";
import { initializeRegistryDomain } from "@/domain/registry";

// Ensure connectors are registered on first call
initializeRegistryDomain();

/**
 * Maps a mappingSourceKey (SourceFieldMapping.sourceReference) to a concrete GLEIF RA code
 * that RegistryConnectorFactory.getConnectorForAuthority() can route.
 *
 * Required because the UI now uses "COMPANIES_HOUSE" as the sourceReference (mappingSourceKey),
 * but connectors are registered and dispatched by GLEIF RA code via connector.supports(authorityId).
 *
 * Add entries here whenever a new multi-RA connector is introduced.
 */
const MAPPING_SOURCE_KEY_TO_RA: Record<string, string> = {
    COMPANIES_HOUSE: "RA000585", // canonical CH RA for live browse (England & Wales connector)
};

/**
 * Server Action: Fetch a live record from a specific Registry Authority and
 * return the raw COMPANY_PROFILE payload (from CanonicalRegistryRecord.rawSourcePayload).
 *
 * The Data Inspector uses this to let admins browse real API fields and click-to-map them.
 *
 * @param registrationNumber - The local registration number (company number, SIREN, HRB, etc.)
 * @param sourceRef          - mappingSourceKey (e.g. "COMPANIES_HOUSE") or a direct GLEIF RA code
 *                             (e.g. "RA000585", "RA000192"). Resolved to a connector RA code via
 *                             MAPPING_SOURCE_KEY_TO_RA if needed.
 */
export async function fetchLiveRegistryRecord(
    registrationNumber: string,
    sourceRef: string = "COMPANIES_HOUSE"
) {
    if (!registrationNumber || registrationNumber.trim().length < 3) {
        return { success: false, error: "Please enter at least 3 characters." };
    }

    // Resolve mappingSourceKey → concrete GLEIF RA code for connector dispatch
    const authorityId = MAPPING_SOURCE_KEY_TO_RA[sourceRef] ?? sourceRef;

    try {
        const connector = RegistryConnectorFactory.getConnectorForAuthority(authorityId);
        if (!connector) {
            return {
                success: false,
                error: `No connector registered for authority ${authorityId} (resolved from "${sourceRef}"). ` +
                    `Check that the connector is registered in initializeRegistryDomain().`,
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
