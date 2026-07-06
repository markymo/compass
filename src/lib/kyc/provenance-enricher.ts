import { cache } from "react";
import prisma from "@/lib/prisma";

export interface ProvenanceMap {
    gleifFetchedAt: Date | null;
    registrationAuthorityMap: Map<string, Date>;
}

/**
 * Fetches the provenance map for a given ClientLE.
 * 
 * This performs a single DB query for the ClientLE to get `gleifFetchedAt`,
 * and a single grouped lookup for `EnrichmentRun` to get the latest `completedAt`
 * for each `registrationAuthorityId`.
 * 
 * Wrapped in React cache() so that resolving 10 fields in a single Server Action
 * only executes these queries once.
 */
export const fetchProvenanceMap = cache(async (params: { clientLEId: string }): Promise<ProvenanceMap> => {
    const le = await prisma.clientLE.findUnique({
        where: { id: params.clientLEId },
        select: { 
            gleifFetchedAt: true, 
            legalEntityId: true,
            registryReferences: {
                select: {
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
        return { gleifFetchedAt: null, registrationAuthorityMap: new Map() };
    }

    const raMap = new Map<string, Date>();
    
    // Map registry references
    for (const ref of le.registryReferences) {
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
        registrationAuthorityMap: raMap
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
