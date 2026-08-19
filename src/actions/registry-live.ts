"use server";

import { RegistryConnectorFactory } from "@/domain/registry/RegistryConnectorFactory";
import { RegistryAuthorityService } from "@/domain/registry/RegistryAuthorityService";
import { initializeRegistryDomain } from "@/domain/registry";
import { IRegistryConnector } from "@/domain/registry/types/RegistryConnector";

// Ensure connectors are registered on first call
initializeRegistryDomain();

/**
 * Server Action: Fetch a live record from a specific Registry Authority or source family and
 * return the raw COMPANY_PROFILE payload (from CanonicalRegistryRecord.rawSourcePayload).
 *
 * The Data Inspector uses this to let admins browse real API fields and click-to-map them.
 *
 * Architectural Rule:
 * - If `sourceRef` is a physical GLEIF RA code (e.g. "RA000587"), the reference preserves "RA000587".
 * - If `sourceRef` is a mapping family (e.g. "COMPANIES_HOUSE"), connector selection occurs via
 *   its configured registryKey, but the reference's `registryAuthorityId` remains "COMPANIES_HOUSE"
 *   and NEVER manufactures an arbitrary physical RA ID (like RA000585).
 *
 * @param registrationNumber - The local registration number (company number, SIREN, HRB, etc.)
 * @param sourceRef          - A physical GLEIF RA code (e.g. "RA000587"), a connector registryKey
 *                             (e.g. "GB_COMPANIES_HOUSE"), or a mappingSourceKey (e.g. "COMPANIES_HOUSE").
 */
export async function fetchLiveRegistryRecord(
    registrationNumber: string,
    sourceRef: string = "COMPANIES_HOUSE",
    payloadSubtype: string = "COMPANY_PROFILE"
) {
    if (!registrationNumber || registrationNumber.trim().length < 3) {
        return { success: false, error: "Please enter at least 3 characters." };
    }

    try {
        let connector: IRegistryConnector | null = null;
        let physicalAuthorityId: string | null = null;

        if (sourceRef.startsWith("RA")) {
            // Explicit physical RA ID supplied (e.g. "RA000587", "RA000586", "RA000585")
            physicalAuthorityId = sourceRef;
            connector = await RegistryConnectorFactory.getConnectorForAuthorityId(sourceRef);
        } else {
            // Mapping family or connector registryKey (e.g. "COMPANIES_HOUSE" or "GB_COMPANIES_HOUSE")
            connector = RegistryConnectorFactory.getConnectorForRegistryKey(sourceRef);

            if (!connector) {
                // Obtain authority record strictly to read its configured registryKey for connector dispatch
                const authority = await RegistryAuthorityService.getAuthorityBySourceKey(sourceRef);
                if (authority?.registryKey) {
                    connector = RegistryConnectorFactory.getConnectorForRegistryKey(authority.registryKey);
                }
            }
            // Do NOT manufacture a physical RA ID when sourceRef is a mapping family / registry key
            physicalAuthorityId = null;
        }

        if (!connector) {
            return {
                success: false,
                error: `No connector registered for authority/source "${sourceRef}". ` +
                    `Check that the connector is registered in initializeRegistryDomain().`,
            };
        }

        // Minimal reference stub — uses physicalAuthorityId ONLY when a physical RA ID was genuinely supplied.
        // When live browsing by mapping family ("COMPANIES_HOUSE"), registryAuthorityId remains "COMPANIES_HOUSE".
        const reference = {
            localRegistrationNumber: registrationNumber.trim(),
            registryAuthorityId: physicalAuthorityId || sourceRef,
        } as any;

        const record = await connector.fetch(reference);

        if (!record) {
            return { success: false, error: "No record found for that registration number." };
        }

        // Return the requested payload subtype, or fallback to COMPANY_PROFILE, or fallback to the full record
        const payload = record.rawSourcePayload?.[payloadSubtype] ?? record.rawSourcePayload?.COMPANY_PROFILE ?? record;

        return { success: true, payload };

    } catch (error) {
        console.error("[registry-live] Fetch error:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch from registry API.";
        return { success: false, error: message };
    }
}
