import { cache } from "react";
import prisma from "@/lib/prisma";

export interface ProvenanceMap {
    gleifFetchedAt: Date | null;
    lei: string | null;
    registrationAuthorityMap: Map<string, Date>;
    registrationAuthorityIdentifierMap: Map<string, string>;
    primaryRegistrationNumber: string | null;
}

/**
 * Fetches the provenance map for a given ClientLE.
 * 
 * This performs a single DB query for the ClientLE to get `gleifFetchedAt`, `lei`,
 * and its `registryReferences` (timestamps, authorities, and localRegistrationNumbers).
 * 
 * Wrapped in React cache() so that resolving multiple fields in a single Server Action
 * only executes these queries once.
 */
export const fetchProvenanceMap = cache(async (params: { clientLEId: string }): Promise<ProvenanceMap> => {
    const le = await prisma.clientLE.findUnique({
        where: { id: params.clientLEId },
        select: { 
            gleifFetchedAt: true, 
            lei: true,
            legalEntityId: true,
            registryReferences: {
                select: {
                    localRegistrationNumber: true,
                    lastSyncSucceededAt: true,
                    authority: {
                        select: {
                            id: true,
                            registryKey: true,
                            name: true
                        }
                    }
                }
            }
        }
    });

    if (!le) {
        return {
            gleifFetchedAt: null,
            lei: null,
            registrationAuthorityMap: new Map(),
            registrationAuthorityIdentifierMap: new Map(),
            primaryRegistrationNumber: null
        };
    }

    const raMap = new Map<string, Date>();
    const raIdentifierMap = new Map<string, string>();
    let primaryRegistrationNumber: string | null = null;
    
    // Map registry references
    for (const ref of le.registryReferences) {
        if (ref.localRegistrationNumber && !primaryRegistrationNumber) {
            primaryRegistrationNumber = ref.localRegistrationNumber;
        }

        if (ref.localRegistrationNumber && ref.authority) {
            // Map the internal authority ID (e.g. RA000585)
            raIdentifierMap.set(ref.authority.id, ref.localRegistrationNumber);
            
            // Map the external registryKey (e.g. GB_COMPANIES_HOUSE)
            if (ref.authority.registryKey) {
                raIdentifierMap.set(ref.authority.registryKey, ref.localRegistrationNumber);
            }
            
            // Add legacy alias for COMPANIES_HOUSE
            if (ref.authority.registryKey === 'GB_COMPANIES_HOUSE' || (ref.authority.name && ref.authority.name.includes("Companies House"))) {
                raIdentifierMap.set('COMPANIES_HOUSE', ref.localRegistrationNumber);
            }
        }

        if (ref.lastSyncSucceededAt && ref.authority) {
            // Map the internal authority ID
            raMap.set(ref.authority.id, ref.lastSyncSucceededAt);
            
            // Map the external registryKey
            if (ref.authority.registryKey) {
                raMap.set(ref.authority.registryKey, ref.lastSyncSucceededAt);
            }
            
            // Add legacy alias for COMPANIES_HOUSE
            if (ref.authority.registryKey === 'GB_COMPANIES_HOUSE' || (ref.authority.name && ref.authority.name.includes("Companies House"))) {
                raMap.set('COMPANIES_HOUSE', ref.lastSyncSucceededAt);
            }
        }
    }

    return {
        gleifFetchedAt: le.gleifFetchedAt,
        lei: le.lei || null,
        registrationAuthorityMap: raMap,
        registrationAuthorityIdentifierMap: raIdentifierMap,
        primaryRegistrationNumber
    };
});

/**
 * Pure mapping function to resolve `sourceCheckedAt` from a `ProvenanceMap`.
 * 
 * @param sourceType The source type of the derived value
 * @param sourceReference The reference (e.g., registrationAuthorityId)
 * @param assertedAt The fallback timestamp from the original claim
 * @param map The loaded provenance map
 */
export function resolveSourceCheckedAt(
    sourceType: string | null | undefined,
    sourceReference: string | null | undefined,
    assertedAt: Date | null,
    map: ProvenanceMap | null
): Date | null {
    if (!map) return assertedAt;

    if (sourceType === 'GLEIF' && map.gleifFetchedAt) {
        return map.gleifFetchedAt;
    }

    if (sourceType === 'REGISTRATION_AUTHORITY' || sourceType === 'COMPANIES_HOUSE') {
        const refKey = sourceReference || (sourceType === 'COMPANIES_HOUSE' ? 'COMPANIES_HOUSE' : null);
        if (refKey) {
            const raDate = map.registrationAuthorityMap.get(refKey);
            if (raDate) {
                return raDate;
            }
        }
    }

    // Default to assertedAt for USER_INPUT, SYSTEM, or if registry wasn't recently refreshed
    return assertedAt;
}

/**
 * Resolves the entityIdentifier (e.g. company number, LEI) for a source claim.
 * Combines claim-linked EvidenceStore payload (if present) with the ClientLE provenance map.
 */
export function resolveSourceEntityIdentifier(
    sourceType: string | null | undefined,
    sourceReference: string | null | undefined,
    claimIdentifier: string | null | undefined,
    map: ProvenanceMap | null | undefined
): string | null {
    // 1. If an explicit entity identifier was already extracted (e.g. from EvidenceStore), use it
    if (claimIdentifier && claimIdentifier.trim()) {
        return claimIdentifier.trim();
    }

    if (!map) return null;

    const normType = (sourceType || "").toUpperCase().trim();

    // 2. GLEIF source -> use ClientLE.lei
    if (normType === "GLEIF") {
        if (map.lei && map.lei.trim()) {
            return map.lei.trim();
        }
    }

    // 3. REGISTRATION_AUTHORITY / COMPANIES_HOUSE source -> lookup in registrationAuthorityIdentifierMap
    if (normType === "REGISTRATION_AUTHORITY" || normType === "COMPANIES_HOUSE") {
        const refKey = sourceReference || (normType === "COMPANIES_HOUSE" ? "COMPANIES_HOUSE" : null);
        if (refKey && map.registrationAuthorityIdentifierMap.has(refKey)) {
            return map.registrationAuthorityIdentifierMap.get(refKey)!;
        }
        if (map.registrationAuthorityIdentifierMap.has("COMPANIES_HOUSE")) {
            return map.registrationAuthorityIdentifierMap.get("COMPANIES_HOUSE")!;
        }
        if (map.registrationAuthorityIdentifierMap.has("GB_COMPANIES_HOUSE")) {
            return map.registrationAuthorityIdentifierMap.get("GB_COMPANIES_HOUSE")!;
        }
        if (map.primaryRegistrationNumber) {
            return map.primaryRegistrationNumber;
        }
    }

    return null;
}

