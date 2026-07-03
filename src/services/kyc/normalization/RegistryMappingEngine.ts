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
 * Resolves FieldCandidates from a completed EnrichmentRun using the mappingSourceKey architecture:
 * - run.registrationAuthorityId (GLEIF RA code) → RegistryAuthority.mappingSourceKey → SourceFieldMapping.sourceReference
 * - mappingSourceKey groups RAs sharing one connector schema (e.g. RA000585/586/587 → "COMPANIES_HOUSE")
 * - Falls back to the raId itself when mappingSourceKey is null (single-RA authorities)
 * - BASELINE scope is legacy architecture for RA mappings; all active RA mappings should use RAW_PAYLOAD
 */
export class RegistryMappingEngine {
    
    /**
     * Map a completed EnrichmentRun into FieldCandidates.
     */
    static async mapEnrichmentRun(runId: string): Promise<FieldCandidate[]> {
        // 1. Fetch Run context
        const run = await prisma.enrichmentRun.findUnique({
            where: { id: runId },
            include: {
                sourcePayloads: true,
                // baselineExtracts retained during BASELINE→RAW_PAYLOAD migration window;
                // remove once all RA mappings use RAW_PAYLOAD scope.
                baselineExtracts: { orderBy: { extractedAt: 'desc' }, take: 1 }
            }
        });

        if (!run) {
            console.error(`[RegistryMappingEngine] Run ${runId} not found.`);
            return [];
        }

        const baseline = run.baselineExtracts[0];
        const raId = run.registrationAuthorityId;

        // 2. Resolve mappingSourceKey: RA code → canonical source identity
        // e.g. "RA000587" → "COMPANIES_HOUSE" (via RegistryAuthority.mappingSourceKey)
        // Falls back to raId for single-RA authorities (mappingSourceKey = null).
        let mappingSourceKey: string | null = raId;
        if (raId) {
            const authority = await prisma.registryAuthority.findUnique({
                where: { id: raId },
                select: { mappingSourceKey: true }
            });
            mappingSourceKey = authority?.mappingSourceKey ?? raId;
        }

        // 3. Load active mappings for this mapping source key
        // The null-ref fallback is kept during the data migration window;
        // remove { sourceReference: null } once all RA mappings have an explicit sourceReference.
        const mappings = await prisma.sourceFieldMapping.findMany({
            where: {
                sourceType: SourceType.REGISTRATION_AUTHORITY,
                isActive: true,
                OR: [
                    { sourceReference: mappingSourceKey },
                    { sourceReference: null }           // migration window fallback — remove post-migration
                ]
            },
            orderBy: [
                { priority: 'asc' },
                { createdAt: 'asc' }
            ]
        });

        if (mappings.length === 0) {
            console.log(`[RegistryMappingEngine] No mappings found for RA: ${raId} (mappingSourceKey: ${mappingSourceKey})`);
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

            // Sort by explicit priority only.
            // All mappings are now scoped to mappingSourceKey; scoped-vs-global sort is no longer needed.
            // (null-ref fallback rows will be removed post-migration)
            const sortedMappings = [...fieldMappings].sort((a, b) => a.priority - b.priority);

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

                    if (!sourceObject) {
                        console.log(`[RegistryMappingEngine] skip field=${fieldNo} mapping=${mapping.id}: no sourceObject for scope=${mapping.mappingScope} subtype=${mapping.payloadSubtype}`);
                        continue;
                    }

                    // PATH RESOLUTION
                    const segments = parsePath(mapping.sourcePath);
                    const rawValue = resolveDotPath(sourceObject, segments);

                    if (rawValue == null) {
                        console.log(`[RegistryMappingEngine] Emitting explicit-none for field=${fieldNo} because mapped path "${mapping.sourcePath}" was missing (scope=${mapping.mappingScope}, subtype=${mapping.payloadSubtype}).`);
                        candidates.push({
                            fieldNo,
                            value: { explicitNone: true },
                            isExplicitNone: true,
                            sourceMappingId: mapping.id,
                            payloadSubtype: mapping.payloadSubtype,
                            syncMode: mapping.syncMode,
                            source: SourceType.REGISTRATION_AUTHORITY,
                            sourceKey: mappingSourceKey || raId || 'GENERIC_RA',
                            evidenceId: run.id,
                            confidence: mapping.confidenceDefault
                        });
                        continue;
                    }
                    console.log(`[RegistryMappingEngine] field=${fieldNo} path="${mapping.sourcePath}" resolved → ${Array.isArray(rawValue) ? `array[${rawValue.length}]` : typeof rawValue}`);

                    // TRANSFORMATION
                    const transformed = applyTransform(rawValue, mapping.transformType as any, mapping.transformConfig);
                    if (transformed.value == null) {
                        console.log(`[RegistryMappingEngine] skip field=${fieldNo}: transform "${mapping.transformType}" returned null`);
                        continue;
                    }
                    console.log(`[RegistryMappingEngine] field=${fieldNo} transform="${mapping.transformType}" → ${Array.isArray(transformed.value) ? `array[${transformed.value.length}]` : JSON.stringify(transformed.value).slice(0, 80)}`);

                    // FILTER LAYER
                    // MVP Filter: "includeRoles" on array items (e.g. PERSON_OR_CONTACT)
                    if (mapping.filterConfig && Array.isArray(transformed.value)) {
                        const config = mapping.filterConfig as any;
                        if (config.includeRoles && Array.isArray(config.includeRoles)) {
                            const filteredValue: any[] = [];
                            const filteredRowKeys: string[] = [];

                            for (let i = 0; i < transformed.value.length; i++) {
                                const item = transformed.value[i];
                                const rowKey = transformed.rowKeys?.[i];
                                const roles = item.roles || [];
                                
                                let matched = false;
                                for (const filterRule of config.includeRoles) {
                                    const matchRule = roles.some((r: any) => {
                                        let rTypeMatch = true;
                                        if (filterRule.roleType !== undefined) {
                                            rTypeMatch = String(r.roleType || '').toLowerCase() === String(filterRule.roleType).toLowerCase();
                                        }
                                        let rActiveMatch = true;
                                        if (filterRule.isActiveRole !== undefined) {
                                            rActiveMatch = r.isActiveRole === filterRule.isActiveRole;
                                        }
                                        return rTypeMatch && rActiveMatch;
                                    });
                                    if (matchRule) {
                                        matched = true;
                                        break;
                                    }
                                }

                                if (matched) {
                                    filteredValue.push(item);
                                    if (rowKey !== undefined) filteredRowKeys.push(rowKey);
                                }
                            }

                            transformed.value = filteredValue;
                            if (transformed.rowKeys) {
                                transformed.rowKeys = filteredRowKeys;
                            }
                            
                            console.log(`[RegistryMappingEngine] field=${fieldNo} filter applied → retained ${filteredValue.length} items`);
                        }
                    }

                    // If filter removed all items, skip Candidate generation
                    if (Array.isArray(transformed.value) && transformed.value.length === 0) {
                        console.log(`[RegistryMappingEngine] skip field=${fieldNo}: filter removed all items`);
                        continue;
                    }

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
                        sourceMappingId: mapping.id,
                        payloadSubtype: mapping.payloadSubtype,
                        syncMode: mapping.syncMode,
                        source: SourceType.REGISTRATION_AUTHORITY,
                        sourceKey: mappingSourceKey || raId || 'GENERIC_RA',
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
