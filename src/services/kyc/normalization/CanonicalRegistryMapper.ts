import { CanonicalRegistryRecord } from "@/domain/registry/types/CanonicalRegistryRecord";
import { FieldCandidate } from "./types";
import { parsePath, resolveDotPath } from "./pathResolver";
import { applyTransform } from "./transforms";
import prisma from "@/lib/prisma";

/**
 * Unified Table-Driven Mapper for Registration Authority Data.
 * 
 * Takes a pre-normalized CanonicalRegistryRecord and applies mappings
 * defined for the 'REGISTRATION_AUTHORITY' source family.
 */
export class CanonicalRegistryMapper {
    /**
     * Maps a CanonicalRegistryRecord to FieldCandidates based on DB configuration.
     */
    static async mapToCandidates(record: CanonicalRegistryRecord, evidenceId: string): Promise<FieldCandidate[]> {
        // 1. Load active REGISTRATION_AUTHORITY mappings from DB
        let dbMappings: any[] = [];
        try {
            dbMappings = await (prisma as any).sourceFieldMapping.findMany({
                where: { sourceType: 'REGISTRATION_AUTHORITY', isActive: true },
                orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
            });
        } catch (e) {
            console.error("Failed to load REGISTRATION_AUTHORITY source mappings from DB:", e);
            return [];
        }

        if (dbMappings.length === 0) {
            console.warn("No REGISTRATION_AUTHORITY mappings found in DB. Ingestion will produce no candidates.");
            return [];
        }

        // 2. Group by targetFieldNo for priority deduplication
        const byTarget = new Map<number, any[]>();
        for (const mapping of dbMappings) {
            const group = byTarget.get(mapping.targetFieldNo) || [];
            group.push(mapping);
            byTarget.set(mapping.targetFieldNo, group);
        }

        // 3. Resolve mappings against the CanonicalRegistryRecord
        const candidates: FieldCandidate[] = [];

        for (const [targetFieldNo, mappings] of byTarget) {
            // Try each mapping by priority until one resolves
            for (const mapping of mappings) {
                try {
                    const segments = parsePath(mapping.sourcePath);
                    // Resolve path directly against the canonical record
                    const rawValue = resolveDotPath(record, segments);

                    if (rawValue == null) continue; // Try next priority for this field

                    const transformed = applyTransform(rawValue, mapping.transformType, mapping.transformConfig);

                    if (transformed.value == null) continue;

                    // Runtime confidence adjustments
                    let confidence = mapping.confidenceDefault;
                    if (transformed.confidencePenalty > 0) {
                        confidence = confidence * (1 - transformed.confidencePenalty);
                    }

                    candidates.push({
                        fieldNo: targetFieldNo,
                        value: transformed.value,
                        // PROVENANCE: 
                        // sourceFamily is 'REGISTRATION_AUTHORITY' (for trust ranking / UI grouping)
                        // sourceKey is the specific registry (e.g. 'GB_COMPANIES_HOUSE')
                        source: 'REGISTRATION_AUTHORITY' as any,
                        sourceKey: record.registryKey, // preservation of specific source provenance
                        evidenceId,
                        confidence
                    });

                    break; // First successful resolution wins for this target field
                } catch (e) {
                    console.warn(`Canonical mapping ${mapping.id} (${mapping.sourcePath} -> F${targetFieldNo}) failed:`, e);
                    continue; 
                }
            }
        }

        return candidates;
    }
}
