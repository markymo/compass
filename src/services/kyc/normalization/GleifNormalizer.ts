import { FieldCandidate } from "./types";
import { parsePath, resolveDotPath } from "./pathResolver";
import { applyTransform } from "./transforms";
import prisma from "@/lib/prisma";

/**
 * Table-driven normalizer for GLEIF payloads.
 *
 * Loads active mappings from the SourceFieldMapping table and resolves
 * them against the canonical GLEIF attributes root.
 *
 * Fallback: If zero DB mappings exist, falls back to the original
 * hardcoded logic with a loud console warning. This fallback is a
 * temporary migration safeguard and should be removed after production
 * validation.
 */
export async function mapGleifPayloadToFieldCandidates(payload: any, evidenceId: string): Promise<FieldCandidate[]> {
    // 1. Extract canonical root
    const attr = payload?.data?.attributes || payload?.attributes || payload;
    if (!attr) return [];

    // 2. Load active GLEIF mappings from DB
    let dbMappings: any[] = [];
    try {
        dbMappings = await (prisma as any).sourceFieldMapping.findMany({
            where: { sourceType: 'GLEIF', isActive: true },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
        });
    } catch (e) {
        console.error("[GleifNormalizer] DB error loading GLEIF mappings — returning no candidates.", e);
        return [];
    }

    // 3. Guard: no active mappings
    if (dbMappings.length === 0) {
        console.error(
            "[GleifNormalizer] No active GLEIF mappings found in DB. " +
            "Run bootstrapDefaultMappings('GLEIF') from the admin UI to seed them."
        );
        return [];
    }

    // 4. Group by targetFieldNo for priority deduplication
    const byTarget = new Map<number, typeof dbMappings>();
    for (const mapping of dbMappings) {
        const group = byTarget.get(mapping.targetFieldNo) || [];
        group.push(mapping);
        byTarget.set(mapping.targetFieldNo, group);
    }

    // 5. Resolve mappings
    const candidates: FieldCandidate[] = [];

    for (const [targetFieldNo, mappings] of byTarget) {
        // Try each mapping by priority until one resolves
        for (const mapping of mappings) {
            try {
                const segments = parsePath(mapping.sourcePath);
                const rawValue = resolveDotPath(attr, segments);

                if (rawValue == null) continue; // Try next priority

                const transformed = applyTransform(rawValue, mapping.transformType, mapping.transformConfig);

                if (transformed.value == null) continue;

                // Runtime confidence adjustments
                let confidence = mapping.confidenceDefault;
                if (transformed.confidencePenalty > 0) {
                    confidence = confidence * (1 - transformed.confidencePenalty);
                }
                // Short value penalty for TEXT fields
                if (typeof transformed.value === 'string' && transformed.value.length < 2) {
                    confidence = confidence * 0.8;
                }

                candidates.push({
                    fieldNo: targetFieldNo,
                    value: transformed.value,
                    source: 'GLEIF',
                    evidenceId,
                    confidence
                });

                break; // First successful resolution wins for this target
            } catch (e) {
                console.warn(`⚠ Mapping ${mapping.id} (${mapping.sourcePath} → F${targetFieldNo}) failed:`, e);
                continue; // Try next priority
            }
        }
    }

    return candidates;
}
