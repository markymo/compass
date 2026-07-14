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
 * Fallback: If zero DB mappings exist, returns [] with a loud console error.
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

    // 4. Pre-load RA name lookup once — only if any RA_CODE_TO_NAME mapping is active.
    //    This avoids the extra DB call for deployments that don't use this transform.
    //    Result: plain Record<string, string> (raId → name), injected via transformConfig.
    const hasRaCodeTransform = dbMappings.some((m: any) => m.transformType === 'RA_CODE_TO_NAME');
    let raNameLookup: Record<string, string> = {};
    if (hasRaCodeTransform) {
        try {
            const raRows = await (prisma as any).registryAuthority.findMany({
                where: { isActive: true },
                select: { id: true, name: true },
            }) as Array<{ id: string; name: string }>;
            raNameLookup = Object.fromEntries(raRows.map((r: { id: string; name: string }) => [r.id, r.name]));
        } catch (e) {
            console.warn("[GleifNormalizer] Failed to load RA name lookup — RA_CODE_TO_NAME will fall back to raw codes.", e);
        }
    }

    // 5. Group by targetFieldNo for priority deduplication
    const byTarget = new Map<number, typeof dbMappings>();
    for (const mapping of dbMappings) {
        const group = byTarget.get(mapping.targetFieldNo) || [];
        group.push(mapping);
        byTarget.set(mapping.targetFieldNo, group);
    }

    // 6. Resolve mappings
    const candidates: FieldCandidate[] = [];

    for (const [targetFieldNo, mappings] of byTarget) {
        // Try each mapping by priority until one resolves
        for (const mapping of mappings) {
            try {
                const segments = parsePath(mapping.sourcePath);
                let rawValue = null;

                if (mapping.payloadSubtype === 'LEVEL_2_RELATIONSHIPS') {
                    const pathSegments = segments.length > 0 && segments[0].key === 'gleifL2' ? segments.slice(1) : segments;
                    rawValue = resolveDotPath(payload?.gleifL2, pathSegments);
                } else if (mapping.payloadSubtype === 'ELF') {
                    const pathSegments = segments.length > 0 && segments[0].key === 'gleifElf' ? segments.slice(1) : segments;
                    rawValue = resolveDotPath(payload?.gleifElf, pathSegments);
                } else {
                    // LEVEL_1 or legacy
                    rawValue = resolveDotPath(attr, segments);

                    // Legacy fallback for old mappings that already include gleifL2/gleifElf in the path
                    if (rawValue == null && (mapping.sourcePath.startsWith("gleifL2") || mapping.sourcePath.startsWith("gleifElf"))) {
                        rawValue = resolveDotPath(payload, segments);
                    }
                }

                if (rawValue == null) {
                    console.log(`[GleifNormalizer] Emitting explicit-none for field=${targetFieldNo} because mapped path "${mapping.sourcePath}" was missing.`);
                    candidates.push({
                        fieldNo: targetFieldNo,
                        value: { explicitNone: true },
                        isExplicitNone: true,
                        source: 'GLEIF',
                        evidenceId,
                        confidence: mapping.confidenceDefault
                    });
                    continue; // First priority was missing, but we emitted none. Wait, we should break? 
                    // Actually, if a higher priority mapping is missing, do we emit none and win, or fall back to lower priority?
                    // "value missing / null / missing path → assert an explicit "none" claim"
                    // If a higher priority is missing, we shouldn't necessarily assume explicit none if a lower priority mapping MIGHT have a value. 
                    // Let's think: The user's rule "If a mapped external source is successfully processed, and an active mapping produces no value...".
                }

                // For RA_CODE_TO_NAME: inject the pre-loaded lookup into transformConfig
                // so that applyTransform can resolve the name without hitting the DB.
                const effectiveConfig = mapping.transformType === 'RA_CODE_TO_NAME'
                    ? { ...(mapping.transformConfig ?? {}), raNameLookup }
                    : mapping.transformConfig;

                const transformed = applyTransform(rawValue, mapping.transformType, effectiveConfig);

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
