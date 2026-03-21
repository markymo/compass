import { RegistryReference } from "@prisma/client";

/**
 * Parses a GLEIF attributes payload and derives any RegistryReference pointing 
 * to a national registry (via registeredAt.id and registeredAs).
 * 
 * Logic based on GLEIF JSON:API schema.
 */
export function deriveRegistryReferencesFromGleif(
    clientLEId: string, 
    lei: string, 
    gleifAttributes: any
): Partial<RegistryReference>[] {
    // Basic structural logging to help find the "No pointers found" culprit
    if (!gleifAttributes || Object.keys(gleifAttributes).length === 0) {
        console.warn(`[deriveRegistryReferencesFromGleif] attributes empty for LEI ${lei}`);
    }

    const references: Partial<RegistryReference>[] = [];

    // Helper to resolve RAID from various formats
    const resolveRaid = (r: any) => {
        if (!r) return null;
        if (typeof r === 'string') return r;
        if (typeof r === 'object' && r.id) return r.id;
        return null;
    };

    // Path 1: registration block (Direct or Nested)
    const raid1 = resolveRaid(gleifAttributes?.registration?.registeredAt);
    const localId1 = gleifAttributes?.registration?.registeredAs;
    if (raid1 && localId1) console.log("[deriveRegistryReferencesFromGleif] Match on Path 1 (registration)");

    // Path 2: entity block (Standard JSON:API)
    const raid2 = resolveRaid(gleifAttributes?.entity?.registeredAt);
    const localId2 = gleifAttributes?.entity?.registeredAs;
    if (raid2 && localId2) console.log("[deriveRegistryReferencesFromGleif] Match on Path 2 (entity)");

    // Path 3: Top level attributes (Flattened)
    const raid3 = resolveRaid(gleifAttributes?.registeredAt);
    const localId3 = gleifAttributes?.registeredAs;
    if (raid3 && localId3) console.log("[deriveRegistryReferencesFromGleif] Match on Path 3 (top-level)");

    const raid = raid1 || raid2 || raid3;
    const localId = localId1 || localId2 || localId3;

    if (raid && localId && typeof raid === 'string' && typeof localId === 'string') {
        references.push({
            clientLEId,
            sourceSystem: 'GLEIF',
            sourceRecordId: lei,
            registryAuthorityId: raid,
            localRegistrationNumber: localId,
            status: 'NEW',
            confidence: 1.0
        });
    }

    // Other potential registry links (e.g. otherEntityNames could have references, 
    // but the 'registration' block is the primary one)

    return references;
}
