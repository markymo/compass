import { cache } from "react";
import prisma from "@/lib/prisma";

export interface ProvenanceMap {
    gleifFetchedAt: Date | null;
    lei: string | null;
    registrationAuthorityMap: Map<string, Date>;
    registrationAuthorityIdentifierMap: Map<string, string>;
    primaryRegistrationNumber: string | null;
    hasSingleRegistryReference: boolean;
}

/**
 * Fetches the provenance map for a given ClientLE.
 * 
 * This performs a single DB query for the ClientLE to get `gleifFetchedAt`, `lei`,
 * and its `registryReferences` (timestamps, authorities, mappingSourceKeys, and localRegistrationNumbers).
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
                            mappingSourceKey: true,
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
            primaryRegistrationNumber: null,
            hasSingleRegistryReference: false
        };
    }

    const raMap = new Map<string, Date>();
    const raIdentifierMap = new Map<string, string>();
    let validRefCount = 0;
    let primaryRegistrationNumber: string | null = null;
    
    // Map registry references
    for (const ref of le.registryReferences) {
        if (ref.localRegistrationNumber) {
            validRefCount++;
            if (!primaryRegistrationNumber) {
                primaryRegistrationNumber = ref.localRegistrationNumber;
            }
        }

        if (ref.localRegistrationNumber && ref.authority) {
            // Map the internal authority ID (e.g. RA000585)
            raIdentifierMap.set(ref.authority.id, ref.localRegistrationNumber);
            
            // Map the external registryKey (e.g. GB_COMPANIES_HOUSE)
            if (ref.authority.registryKey) {
                raIdentifierMap.set(ref.authority.registryKey, ref.localRegistrationNumber);
            }

            // Map the canonical mappingSourceKey (e.g. COMPANIES_HOUSE)
            if (ref.authority.mappingSourceKey) {
                raIdentifierMap.set(ref.authority.mappingSourceKey, ref.localRegistrationNumber);
            }
            
            // Add legacy alias for COMPANIES_HOUSE
            if (
                ref.authority.mappingSourceKey === 'COMPANIES_HOUSE' ||
                ref.authority.registryKey === 'GB_COMPANIES_HOUSE' ||
                (ref.authority.name && ref.authority.name.includes("Companies House"))
            ) {
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

            // Map the canonical mappingSourceKey
            if (ref.authority.mappingSourceKey) {
                raMap.set(ref.authority.mappingSourceKey, ref.lastSyncSucceededAt);
            }
            
            // Add legacy alias for COMPANIES_HOUSE
            if (
                ref.authority.mappingSourceKey === 'COMPANIES_HOUSE' ||
                ref.authority.registryKey === 'GB_COMPANIES_HOUSE' ||
                (ref.authority.name && ref.authority.name.includes("Companies House"))
            ) {
                raMap.set('COMPANIES_HOUSE', ref.lastSyncSucceededAt);
            }
        }
    }

    return {
        gleifFetchedAt: le.gleifFetchedAt,
        lei: le.lei || null,
        registrationAuthorityMap: raMap,
        registrationAuthorityIdentifierMap: raIdentifierMap,
        primaryRegistrationNumber,
        hasSingleRegistryReference: validRefCount === 1
    };
});

/**
 * Pure mapping function to resolve `sourceCheckedAt` from a `ProvenanceMap`.
 * 
 * @param sourceType The source type of the derived value
 * @param sourceReference The reference (e.g., registrationAuthorityId or mappingSourceKey)
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

    const normType = (sourceType || "").toUpperCase().trim();

    if (normType === 'GLEIF' && map.gleifFetchedAt) {
        return map.gleifFetchedAt;
    }

    if (normType === 'REGISTRATION_AUTHORITY' || normType === 'COMPANIES_HOUSE') {
        const cleanRef = sourceReference ? sourceReference.trim() : null;
        if (cleanRef) {
            const raDate = map.registrationAuthorityMap.get(cleanRef);
            if (raDate) {
                return raDate;
            }
            // Explicit sourceReference was provided but not matched -> do not borrow unrelated timestamps
            return assertedAt;
        }

        // Legacy unscoped claims with sourceReference = null
        if (normType === 'COMPANIES_HOUSE' && map.registrationAuthorityMap.has('COMPANIES_HOUSE')) {
            return map.registrationAuthorityMap.get('COMPANIES_HOUSE')!;
        }
    }

    // Default to assertedAt for USER_INPUT, SYSTEM, or if registry wasn't recently refreshed
    return assertedAt;
}

/**
 * Resolves the entityIdentifier (e.g. company number, LEI) for a source claim.
 * Combines claim-linked EvidenceStore payload (if present) with the ClientLE provenance map.
 * 
 * Invariants:
 * 1. An explicit claimIdentifier from EvidenceStore always wins.
 * 2. GLEIF source maps strictly to ClientLE.lei.
 * 3. An explicit sourceReference resolves ONLY against its matching authority/mappingSourceKey.
 *    An unknown/unmatched sourceReference returns null and CANNOT borrow another registry's number.
 * 4. Fallback to primaryRegistrationNumber is permitted ONLY for legacy unscoped claims (sourceReference=null)
 *    on dossiers with an unambiguous single registry reference.
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
        return null;
    }

    // 3. REGISTRATION_AUTHORITY / COMPANIES_HOUSE source
    if (normType === "REGISTRATION_AUTHORITY" || normType === "COMPANIES_HOUSE") {
        const cleanRef = sourceReference ? sourceReference.trim() : null;

        // If an explicit sourceReference was provided:
        if (cleanRef) {
            if (map.registrationAuthorityIdentifierMap.has(cleanRef)) {
                return map.registrationAuthorityIdentifierMap.get(cleanRef)!;
            }
            // Strict principle: an unknown/unmatched sourceReference cannot borrow another registry's number
            return null;
        }

        // Legacy unscoped claims where sourceReference is null/absent:
        if (normType === "COMPANIES_HOUSE") {
            if (map.registrationAuthorityIdentifierMap.has("COMPANIES_HOUSE")) {
                return map.registrationAuthorityIdentifierMap.get("COMPANIES_HOUSE")!;
            }
            return null;
        }

        // For generic REGISTRATION_AUTHORITY with null sourceReference,
        // only fall back if the dossier has an unambiguous single registry reference
        if (map.hasSingleRegistryReference && map.primaryRegistrationNumber) {
            return map.primaryRegistrationNumber;
        }
    }

    return null;
}


