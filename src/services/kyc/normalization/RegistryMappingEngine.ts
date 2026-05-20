import prisma from "@/lib/prisma";
import { 
    SourceType, 
    MappingScope, 
    PayloadSubtype, 
    EnrichmentRun, 
    RegistrySourcePayload, 
    RegistryBaselineExtract 
} from "@prisma/client";
import { FieldCandidate } from "./types";
import { parsePath, resolveDotPath } from "./pathResolver";
import { applyTransform } from "./transforms";
import { isKnownAppDataType } from "@/lib/master-data/field-types";

/**
 * RegistryMappingEngine
 * 
 * Implements the "Layered Mapping" strategy:
 * 1. Scoped RA Mappings (Priority)
 * 2. Global Baseline Mappings (Fallback)
 * 3. Supports multiple Raw Payload Subtypes
 */
export class RegistryMappingEngine {
    
    /**
     * Map a completed EnrichmentRun into FieldCandidates.
     */
    static async mapEnrichmentRun(runId: string): Promise<FieldCandidate[]> {
        // 1. Fetch Run context with all data layers
        const run = await prisma.enrichmentRun.findUnique({
            where: { id: runId },
            include: {
                sourcePayloads: true,
                baselineExtracts: { orderBy: { extractedAt: 'desc' }, take: 1 }
            }
        });

        if (!run) {
            console.error(`[RegistryMappingEngine] Run ${runId} not found.`);
            return [];
        }

        const baseline = run.baselineExtracts[0];
        const raId = run.registrationAuthorityId;

        // 2. Load all active mappings for REGISTRATION_AUTHORITY
        // We fetch both scoped (RA-specific) and global (null sourceReference)
        const mappings = await prisma.sourceFieldMapping.findMany({
            where: {
                sourceType: SourceType.REGISTRATION_AUTHORITY,
                isActive: true,
                OR: [
                    { sourceReference: raId },
                    { sourceReference: null }
                ]
            },
            orderBy: [
                { priority: 'asc' },
                { createdAt: 'asc' }
            ]
        });

        if (mappings.length === 0) {
            console.log(`[RegistryMappingEngine] No mappings found for RA: ${raId}`);
            return [];
        }

        // 3. Group by target field to allow priority "winners"
        const byTarget = new Map<number, any[]>();
        for (const m of mappings) {
            const group = byTarget.get(m.targetFieldNo) || [];
            group.push(m);
            byTarget.set(m.targetFieldNo, group);
        }

        const candidates: FieldCandidate[] = [];

        // 4. Resolve each field
        for (const [fieldNo, fieldMappings] of byTarget) {
            
            // Priority Sort: 
            // 1. Scoped Mappings (sourceReference matching raId)
            // 2. Global Baseline Mappings (sourceReference is null)
            const sortedMappings = [...fieldMappings].sort((a, b) => {
                // If one is scoped and other is global, scoped wins
                if (a.sourceReference && !b.sourceReference) return -1;
                if (!a.sourceReference && b.sourceReference) return 1;
                // Otherwise, respect the explicit priority field
                return a.priority - b.priority;
            });

            for (const mapping of sortedMappings) {
                try {
                    let sourceObject: any = null;

                    // LAYER SELECTION
                    if (mapping.mappingScope === MappingScope.BASELINE) {
                        sourceObject = baseline;
                    } else if (mapping.mappingScope === MappingScope.RAW_PAYLOAD) {
                        // Find the specific payload subtype
                        const payload = run.sourcePayloads.find((p: RegistrySourcePayload) => p.payloadSubtype === mapping.payloadSubtype);
                        sourceObject = payload?.payload;
                    }

                    if (!sourceObject) continue;

                    // PATH RESOLUTION
                    const segments = parsePath(mapping.sourcePath);
                    const rawValue = resolveDotPath(sourceObject, segments);

                    if (rawValue == null) continue;

                    // TRANSFORMATION
                    const transformed = applyTransform(rawValue, mapping.transformType as any, mapping.transformConfig);
                    if (transformed.value == null) continue;

                    // CANDIDATE GENERATION
                    // [FieldTypeRegistry] Warn on unknown appDataType before emitting a candidate.
                    const targetFieldDef = await prisma.masterFieldDefinition.findUnique({ where: { fieldNo } });
                    if (targetFieldDef && !isKnownAppDataType(targetFieldDef.appDataType)) {
                        console.warn(
                            `[RegistryMappingEngine] Unknown appDataType "${targetFieldDef.appDataType}" ` +
                            `for fieldNo=${fieldNo}. Check field-types.ts.`
                        );
                    }

                    // [FieldTypeRegistry] Warn when a transform produces an array.
                    // This documents the TO_PARTY_LIST fan-out gap — the engine currently
                    // emits one candidate with an array value; applyFieldCandidate() iterates
                    // it, but each item still calls updateField() as a single PARTY_REF.
                    // Individual Person/LE nodes ARE created per item. No JSON blob should result.
                    // Verify with the production inventory query (jsonb_typeof = 'array').
                    if (Array.isArray(transformed.value)) {
                        if (targetFieldDef?.isMultiValue) {
                            console.warn(
                                `[RegistryMappingEngine] Transform "${mapping.transformType}" returned an array ` +
                                `for multi-value fieldNo=${fieldNo}. applyFieldCandidate() will iterate items. ` +
                                `Verify collectionId/instanceId are written correctly (fan-out audit pending).`
                            );
                        } else {
                            console.warn(
                                `[RegistryMappingEngine] Transform "${mapping.transformType}" returned an array ` +
                                `for non-multi-value fieldNo=${fieldNo}. This is unexpected. ` +
                                `Check the mapping configuration and MasterFieldDefinition.isMultiValue.`
                            );
                        }
                    }

                    candidates.push({
                        fieldNo,
                        value: transformed.value,
                        // Propagate stable rowKeys produced by TO_PARTY_LIST so that
                        // KycWriteService.applyFieldCandidate() uses deterministic instanceIds
                        // during fan-out rather than ephemeral auto_{timestamp}_{i} keys.
                        rowKeys: transformed.rowKeys,
                        source: SourceType.REGISTRATION_AUTHORITY,
                        sourceKey: raId || 'GENERIC_RA',
                        evidenceId: run.id, // Linking to the Run ID as evidence context
                        confidence: mapping.confidenceDefault * (1 - (transformed.confidencePenalty || 0))
                    });

                    // First successful mapping for this field wins
                    break; 

                } catch (e) {
                    console.warn(`[RegistryMappingEngine] Mapping failed (ID: ${mapping.id}):`, e);
                    continue;
                }
            }
        }

        return candidates;
    }
}
