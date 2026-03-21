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
        console.warn("⚠ Failed to load GLEIF source mappings from DB, using hardcoded fallback", e);
        return hardcodedFallback(attr, evidenceId);
    }

    // 3. Fallback if empty
    if (dbMappings.length === 0) {
        console.warn("⚠ No GLEIF mappings in DB — using temporary hardcoded fallback. Bootstrap mappings via /app/admin/master-data/source-mappings");
        return hardcodedFallback(attr, evidenceId);
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

/**
 * Original hardcoded fallback — TEMPORARY.
 * Remove after production validation of table-driven mappings.
 */
function hardcodedFallback(attr: any, evidenceId: string): FieldCandidate[] {
    const candidates: FieldCandidate[] = [];

    if (attr.lei) {
        candidates.push({ fieldNo: 2, value: attr.lei, source: 'GLEIF', evidenceId, confidence: 1.0 });
    }
    if (attr.entity?.legalName?.name) {
        candidates.push({ fieldNo: 3, value: attr.entity.legalName.name, source: 'GLEIF', evidenceId, confidence: 1.0 });
    }
    if (attr.entity?.legalAddress?.addressLines?.[0]) {
        candidates.push({ fieldNo: 6, value: attr.entity.legalAddress.addressLines[0], source: 'GLEIF', evidenceId, confidence: 0.9 });
    }
    if (attr.entity?.legalAddress?.city) {
        candidates.push({ fieldNo: 7, value: attr.entity.legalAddress.city, source: 'GLEIF', evidenceId, confidence: 0.9 });
    }
    if (attr.entity?.legalAddress?.region) {
        candidates.push({ fieldNo: 8, value: attr.entity.legalAddress.region, source: 'GLEIF', evidenceId, confidence: 0.9 });
    }
    if (attr.entity?.legalAddress?.country) {
        candidates.push({ fieldNo: 9, value: attr.entity.legalAddress.country, source: 'GLEIF', evidenceId, confidence: 1.0 });
    }
    if (attr.entity?.legalAddress?.postalCode) {
        candidates.push({ fieldNo: 10, value: attr.entity.legalAddress.postalCode, source: 'GLEIF', evidenceId, confidence: 0.9 });
    }
    if (attr.entity?.status) {
        candidates.push({ fieldNo: 26, value: attr.entity.status, source: 'GLEIF', evidenceId, confidence: 1.0 });
    }
    if (attr.entity?.category) {
        candidates.push({ fieldNo: 19, value: attr.entity.category, source: 'GLEIF', evidenceId, confidence: 1.0 });
    }
    if (attr.entity?.creationDate) {
        candidates.push({ fieldNo: 27, value: attr.entity.creationDate, source: 'GLEIF', evidenceId, confidence: 1.0 });
    }

    return candidates;
}
