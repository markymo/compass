"use server";

import { KycStateService, SourcePriorityMap, priorityKey } from "@/lib/kyc/KycStateService";
import { applyMasterDataProjection } from "@/lib/kyc/projection";
import { getMasterFieldDefinition, getMasterFieldGroup } from "@/services/masterData/definitionService";
import { ProvenanceSource } from "@/domain/kyc/types/ProvenanceTypes";
import prisma from "@/lib/prisma";
import { getComplexFieldConfig } from "@/lib/master-data/complex-field-config";
import { FieldClaim } from "@prisma/client";
import { getPartySummary } from "@/lib/master-data/party-value";
import { resolveFieldForDisplay } from "@/lib/master-data/field-interpreter";
import { resolveSourceCheckedAt } from "@/lib/kyc/provenance-enricher";
// KycLoader is deprecated in favor of KycStateService

export type ResolverRequest = {
    questionId: string;
    masterFieldNo?: number | null;
    masterQuestionGroupId?: string | null;
    masterFieldProjectionPath?: string | null;
};

export type HydratedValue = {
    value: any;
    source: string | null;
    /** Raw RA code e.g. 'RA000585'. Null for GLEIF/USER_INPUT. Additive — do not remove source. */
    sourceReference?: string | null;
    updatedAt?: Date | null;
    sourceCheckedAt?: Date | null;
    isSynced: boolean; // True if value exists in Master Data
};

export type ResolverResponse = Record<string, Record<string, HydratedValue>>; // QuestionId -> FieldNo -> Value

export async function resolveMasterData(
    leId: string,
    questions: ResolverRequest[]
): Promise<ResolverResponse> {
    const response: ResolverResponse = {};

    // 0. Resolve Subject and Scope
    const clientLE = await prisma.clientLE.findUnique({
        where: { id: leId }
    });
    const subjectLeId = clientLE?.legalEntityId;
    const ownerScopeId = await KycStateService.resolveScopeId(leId);

    for (const q of questions) {
        response[q.questionId] = {};

        // A. Handle Group Mapping
        if (q.masterQuestionGroupId) {
            try {
                const group = await getMasterFieldGroup(q.masterQuestionGroupId);
                if (subjectLeId) {
                    for (const item of group.items) {
                        const fieldNo = item.fieldNo;
                        const def = await getMasterFieldDefinition(fieldNo);
                        if (def.isMultiValue) {
                            const cfg = getComplexFieldConfig(fieldNo);
                            const filterCollectionId = cfg?.kind === 'STRUCTURED_COLLECTION' ? cfg.collectionId : undefined;
                            let collection = await KycStateService.getAuthoritativeCollection(
                                { subjectLeId },
                                fieldNo,
                                ownerScopeId || undefined,
                                undefined,
                                filterCollectionId
                            );

                            if (collection.length > 0) {
                                const maxUpdatedAt = collection.reduce(
                                    (max: Date, c: any) => (c.assertedAt > max ? c.assertedAt : max),
                                    collection[0].assertedAt as Date
                                );
                                response[q.questionId][fieldNo] = {
                                    value: collection.map((c: any) => c.value),
                                    source: collection[0].isScoped ? 'USER_INPUT' : (collection[0].evidenceProvider || 'MASTER_RECORD'),
                                    sourceReference: collection[0].sourceReference ?? null,
                                    updatedAt: maxUpdatedAt,
                                    isSynced: true
                                };
                            }
                        } else {
                            const derived = await KycStateService.getAuthoritativeValue(
                                { subjectLeId },
                                fieldNo,
                                ownerScopeId || undefined
                            );

                            if (derived) {
                                response[q.questionId][fieldNo] = {
                                    value: derived.value,
                                    source: derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || 'MASTER_RECORD'),
                                    sourceReference: derived.sourceReference ?? null,
                                    updatedAt: derived.assertedAt,
                                    isSynced: true
                                };
                            }
                        }
                    }
                }

            } catch (e) {
                console.warn(`[resolveMasterData] Group ${q.masterQuestionGroupId} not found or inactive.`);
            }
        }
        // B. Handle Single Field Mapping
        else if (q.masterFieldNo && subjectLeId) {
            const def = await getMasterFieldDefinition(q.masterFieldNo);
            if (def.isMultiValue) {
                const cfg = getComplexFieldConfig(q.masterFieldNo);
                const filterCollectionId = cfg?.kind === 'STRUCTURED_COLLECTION' ? cfg.collectionId : undefined;
                let collection = await KycStateService.getAuthoritativeCollection(
                    { subjectLeId },
                    q.masterFieldNo,
                    ownerScopeId || undefined,
                    undefined,
                    filterCollectionId
                );

                if (collection.length > 0) {
                    const vals = collection.map((c: any) => c.value);
                    console.log(`[resolveMasterData] Field ${q.masterFieldNo} is multi-value. Values:`, vals);
                    const maxUpdatedAt = collection.reduce(
                        (max: Date, c: any) => (c.assertedAt > max ? c.assertedAt : max),
                        collection[0].assertedAt as Date
                    );
                    response[q.questionId][q.masterFieldNo] = {
                        value: vals,
                        source: collection[0].isScoped ? 'USER_INPUT' : (collection[0].evidenceProvider || 'MASTER_RECORD'),
                        sourceReference: collection[0].sourceReference ?? null,
                        updatedAt: maxUpdatedAt,
                        isSynced: true
                    };
                }
            } else {
                const derived = await KycStateService.getAuthoritativeValue(
                    { subjectLeId },
                    q.masterFieldNo,
                    ownerScopeId || undefined
                );

                if (derived) {
                    response[q.questionId][q.masterFieldNo] = {
                        value: derived.value,
                        source: derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || 'MASTER_RECORD'),
                        sourceReference: derived.sourceReference ?? null,
                        updatedAt: derived.assertedAt,
                        isSynced: true
                    };
                }
            }
        }
    }

    const allValues: any[] = [];
    for (const res of Object.values(response)) {
        for (const hv of Object.values(res)) {
            if (hv && hv.value !== null && hv.value !== undefined) {
                allValues.push(hv.value);
            }
        }
    }
    if (allValues.length > 0) {
        await enrichPartyReferences(allValues);
        await enrichAddressReferences(allValues);
    }

    for (const q of questions) {
        if (!q.masterFieldProjectionPath || !response[q.questionId]) continue;

        if (q.masterQuestionGroupId) {
            const projected: Record<string, HydratedValue> = {};
            for (const [fNo, hv] of Object.entries(response[q.questionId])) {
                if (hv.value !== null && hv.value !== undefined) {
                    projected[fNo] = {
                        ...hv,
                        value: Array.isArray(hv.value)
                            ? hv.value.map((v: any) => applyMasterDataProjection(v, q.masterFieldProjectionPath!))
                            : applyMasterDataProjection(hv.value, q.masterFieldProjectionPath!)
                    };
                } else {
                    projected[fNo] = hv;
                }
            }
            response[q.questionId] = projected;
        } else if (q.masterFieldNo && response[q.questionId][q.masterFieldNo]) {
            const hv = response[q.questionId][q.masterFieldNo];
            if (hv.value !== null && hv.value !== undefined) {
                response[q.questionId][q.masterFieldNo] = {
                    ...hv,
                    value: Array.isArray(hv.value)
                        ? hv.value.map((v: any) => applyMasterDataProjection(v, q.masterFieldProjectionPath!))
                        : applyMasterDataProjection(hv.value, q.masterFieldProjectionPath!)
                };
            }
        }
    }

    return response;
}



// ── resolveMasterDataBatch ────────────────────────────────────────────────────
//
// Batch/in-memory replacement for the N+1 per-question loop in resolveMasterData.
// The caller pre-loads all required DB data and passes it in; this function
// issues zero DB queries. It reuses KycStateService's pickWinner / isTombstone /
// mapToDerivedValue exactly — no logic duplication.
//
// resolveMasterData is left unchanged and still used by mapQuestionToField
// (single-question post-mapping preview) where N+1 has no cost impact.

export type BatchFieldDef = {
    fieldNo: number;
    appDataType: string;
    isMultiValue: boolean;
};

export type BatchSourceMapping = {
    targetFieldNo:   number;
    sourceType:      string;
    sourceReference: string | null;
    priority:        number;
};

export type BatchResolverInput = {
    subjectLeId:  string;
    ownerScopeId: string | null;
    questions:    ResolverRequest[];
    /** Map<fieldNo, def> — built from listAllMasterFields() result */
    fieldDefMap:  Map<number, BatchFieldDef>;
    /** Map<groupKey, fieldNos[]> — built from listAllMasterGroupsWithItems() result */
    groupFieldMap: Map<string, number[]>;
    /** All VERIFIED/ASSERTED FieldClaims for this subjectLeId (pre-loaded) */
    claims:        FieldClaim[];
    /** All active SourceFieldMapping rows (pre-loaded) */
    sourceMappings: BatchSourceMapping[];
    /** The provenance map containing EnrichmentRun and GLEIF dates (pre-loaded) */
    provenanceMap: import("@/lib/kyc/provenance-enricher").ProvenanceMap | null;
};

/**
 * Build a per-field SourcePriorityMap from the pre-loaded sourceMappings array.
 * Mirrors the logic inside KycStateService.preloadMappingPriorities but operates
 * on already-loaded rows (no DB call).
 */
function buildPriorityMap(sourceMappings: BatchSourceMapping[], fieldNo: number): SourcePriorityMap {
    const scoped  = new Map<string, number>();
    const generic = new Map<string, number>();

    for (const row of sourceMappings) {
        if (row.targetFieldNo !== fieldNo) continue;
        const key = priorityKey(row.sourceType, row.sourceReference);
        if (row.sourceReference === null) {
            const ex = generic.get(key);
            if (ex === undefined || row.priority < ex) generic.set(key, row.priority);
        } else {
            const ex = scoped.get(key);
            if (ex === undefined || row.priority < ex) scoped.set(key, row.priority);
        }
    }

    const pm: SourcePriorityMap = new Map();
    for (const [k, v] of generic) pm.set(k, v);
    for (const [k, v] of scoped)  pm.set(k, v);
    return pm;
}

/**
 * Resolve a single field's winner from pre-loaded claims.
 * Returns a HydratedValue (isSynced:false when no winner or tombstoned).
 */
function resolveField(
    fieldNo:   number,
    isMultiValue: boolean,
    allClaims: FieldClaim[],
    ownerScopeId: string | null,
    sourceMappings: BatchSourceMapping[],
    provenanceMap: import("@/lib/kyc/provenance-enricher").ProvenanceMap | null
): Record<string, HydratedValue> {
    const priorityMap = buildPriorityMap(sourceMappings, fieldNo);

    if (isMultiValue) {
        // Apply collectionId filter for STRUCTURED_COLLECTION fields (e.g. SIC_CODES)
        const cfg = getComplexFieldConfig(fieldNo);
        const filterCollectionId = cfg?.kind === 'STRUCTURED_COLLECTION' ? cfg.collectionId : undefined;

        const fieldClaims = allClaims.filter(c =>
            c.fieldNo === fieldNo &&
            (!filterCollectionId || c.collectionId === filterCollectionId)
        );

        // Group by (collectionId, instanceId) — same as getAuthoritativeCollection
        const itemGroups: Record<string, FieldClaim[]> = {};
        for (const c of fieldClaims) {
            const key = `${c.collectionId ?? 'default'}:${c.instanceId ?? 'default'}`;
            if (!itemGroups[key]) itemGroups[key] = [];
            itemGroups[key].push(c);
        }

        const values: any[] = [];
        let firstDerived: any = null;
        let maxAssertedAt: Date | null = null;
        let maxSourceCheckedAt: Date | null = null;
        for (const group of Object.values(itemGroups)) {
            const winner = KycStateService.pickWinner(group, ownerScopeId ?? undefined, priorityMap);
            if (winner && !KycStateService.isTombstone(winner)) {
                const derived = KycStateService.mapToDerivedValue(winner, ownerScopeId ?? undefined);
                values.push(derived.value);
                if (!firstDerived) firstDerived = derived;
                if (!maxAssertedAt || derived.assertedAt > maxAssertedAt) maxAssertedAt = derived.assertedAt;
                
                const checkedAt = resolveSourceCheckedAt(
                    derived.sourceType || derived.evidenceProvider,
                    derived.sourceReference,
                    derived.assertedAt,
                    provenanceMap
                );
                if (checkedAt && (!maxSourceCheckedAt || checkedAt > maxSourceCheckedAt)) {
                    maxSourceCheckedAt = checkedAt;
                }
            }
        }

        if (values.length === 0) {
            return { [fieldNo]: { value: null, source: null, isSynced: false } };
        }

        return {
            [fieldNo]: {
                value: values,
                source: firstDerived.isScoped ? 'USER_INPUT' : (firstDerived.evidenceProvider || firstDerived.sourceType || 'MASTER_RECORD'),
                sourceReference: firstDerived.sourceReference ?? null,
                updatedAt: maxAssertedAt,
                sourceCheckedAt: maxSourceCheckedAt,
                isSynced: true,
            }
        };
    } else {
        const fieldClaims = allClaims.filter(c => c.fieldNo === fieldNo);
        const winner = KycStateService.pickWinner(fieldClaims, ownerScopeId ?? undefined, priorityMap);

        if (!winner || KycStateService.isTombstone(winner)) {
            return { [fieldNo]: { value: null, source: null, isSynced: false } };
        }

        const derived = KycStateService.mapToDerivedValue(winner, ownerScopeId ?? undefined);
        return {
            [fieldNo]: {
                value: derived.value,
                source: derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || derived.sourceType || 'MASTER_RECORD'),
                sourceReference: derived.sourceReference ?? null,
                updatedAt: derived.assertedAt,
                sourceCheckedAt: resolveSourceCheckedAt(derived.sourceType || derived.evidenceProvider, derived.sourceReference, derived.assertedAt, provenanceMap),
                isSynced: true,
            }
        };
    }
}

/**
 * Shared helper to batch-resolve { ccPartyId } objects within generic values arrays.
 * Mutates the objects in-place to attach `resolvedSummary` and `ccParty` payload,
 * ensuring generic renderers can display the CCParty name cleanly.
 */
export async function enrichPartyReferences(values: any[]) {
    const ccPartyIds = new Set<string>();

    // 1. Scan for IDs
    for (const v of values) {
        if (!v) continue;
        if (Array.isArray(v)) {
            for (const item of v) {
                if (item && typeof item === 'object' && item.ccPartyId) {
                    ccPartyIds.add(item.ccPartyId);
                }
            }
        } else if (typeof v === 'object' && v.ccPartyId) {
            ccPartyIds.add(v.ccPartyId);
        }
    }

    if (ccPartyIds.size === 0) return;

    // 2. Fetch parties
    const parties = await prisma.cCParty.findMany({
        where: { id: { in: Array.from(ccPartyIds) } }
    });
    const partyMap = new Map(parties.map((p: any) => [p.id, p]));

    // 3. Mutate original objects
    for (const v of values) {
        if (!v) continue;
        if (Array.isArray(v)) {
            for (const item of v) {
                if (item && typeof item === 'object' && item.ccPartyId) {
                    const party = partyMap.get(item.ccPartyId);
                    if (party) {
                        item.ccParty = party;
                        item.resolvedSummary = getPartySummary((party as any).data);
                        item.resolvedType = (party as any).data?.partySubType || (party as any).data?.partyType;
                    }
                }
            }
        } else if (typeof v === 'object' && v.ccPartyId) {
            const party = partyMap.get(v.ccPartyId);
            if (party) {
                v.ccParty = party;
                v.resolvedSummary = getPartySummary((party as any).data);
                v.resolvedType = (party as any).data?.partySubType || (party as any).data?.partyType;
            }
        }
    }
}

export async function enrichAddressReferences(values: any[]) {
    const ccAddressIds = new Set<string>();

    for (const v of values) {
        if (!v) continue;
        if (Array.isArray(v)) {
            for (const item of v) {
                if (item && typeof item === 'object' && item.ccAddressId) {
                    ccAddressIds.add(item.ccAddressId);
                }
            }
        } else if (typeof v === 'object' && v.ccAddressId) {
            ccAddressIds.add(v.ccAddressId);
        }
    }

    if (ccAddressIds.size === 0) return;

    const addresses = await prisma.cCAddress.findMany({
        where: { id: { in: Array.from(ccAddressIds) } }
    });
    const addressMap = new Map(addresses.map((a: any) => [a.id, a]));

    const getSummary = (data: any) => {
        if (!data) return "";
        const parts = [
            ...(data.addressLines || []),
            data.locality,
            data.region,
            data.postalCode,
            data.countryName || data.countryCode
        ].filter(Boolean);
        return parts.join(", ");
    };

    for (const v of values) {
        if (!v) continue;
        if (Array.isArray(v)) {
            for (const item of v) {
                if (item && typeof item === 'object' && item.ccAddressId) {
                    const address = addressMap.get(item.ccAddressId);
                    if (address) {
                        item._resolvedData = item._resolvedData || {};
                        item._resolvedData.ccAddress = address;
                        item.resolvedSummary = getSummary((address as any).data);
                    }
                }
            }
        } else if (typeof v === 'object' && v.ccAddressId) {
            const address = addressMap.get(v.ccAddressId);
            if (address) {
                v._resolvedData = v._resolvedData || {};
                v._resolvedData.ccAddress = address;
                v.resolvedSummary = getSummary((address as any).data);
            }
        }
    }
}

/**
 * Batch/in-memory implementation of resolveMasterData.
 *
 * Issues 0 DB queries. The caller must pre-load:
 *   - All VERIFIED/ASSERTED FieldClaims for the subject
 *   - All active SourceFieldMapping rows
 *   - Field definitions (as a Map<fieldNo, def>)
 *   - Group → fieldNo mappings (as a Map<groupKey, fieldNos[]>)
 *
 * Priority resolution and tombstone detection reuse KycStateService methods
 * exactly — no duplicated logic.
 */
export async function resolveMasterDataBatch(input: BatchResolverInput): Promise<ResolverResponse> {
    const { subjectLeId, ownerScopeId, questions, fieldDefMap, groupFieldMap, claims, sourceMappings, provenanceMap } = input;

    const response: ResolverResponse = {};

    // Phase 1: Pre-resolve each unique group key and individual fields
    const resolvedGroups = new Map<string, Record<string, HydratedValue>>();
    const uniqueGroupKeys = new Set(
        questions.map(q => q.masterQuestionGroupId).filter(Boolean) as string[]
    );
    for (const groupKey of uniqueGroupKeys) {
        const fieldNos = groupFieldMap.get(groupKey) ?? [];
        const groupResult: Record<string, HydratedValue> = {};
        for (const fieldNo of fieldNos) {
            const def = fieldDefMap.get(fieldNo);
            if (!def) continue;
            Object.assign(groupResult, resolveField(fieldNo, def.isMultiValue, claims, ownerScopeId, sourceMappings, provenanceMap));
        }
        resolvedGroups.set(groupKey, groupResult);
    }

    const resolvedFields = new Map<number, Record<string, HydratedValue>>();
    for (const q of questions) {
        if (q.masterFieldNo && !q.masterQuestionGroupId) {
            if (!resolvedFields.has(q.masterFieldNo)) {
                const def = fieldDefMap.get(q.masterFieldNo);
                if (def) {
                    resolvedFields.set(q.masterFieldNo, resolveField(q.masterFieldNo, def.isMultiValue, claims, ownerScopeId, sourceMappings, provenanceMap));
                }
            }
        }
    }

    // Phase 2: Bulk-enrich PARTY_REF and ADDRESS_REF before any projection is applied
    const parseValue = (val: any) => {
        if (Array.isArray(val)) {
            return val.map(v => {
                if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
                    try { return JSON.parse(v); } catch (e) { return v; }
                }
                return v;
            });
        } else if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try { return JSON.parse(val); } catch (e) { return val; }
        }
        return val;
    };

    const allValues: any[] = [];
    for (const res of resolvedGroups.values()) {
        for (const hv of Object.values(res)) {
            if (hv && hv.value !== null && hv.value !== undefined) {
                hv.value = parseValue(hv.value);
                allValues.push(hv.value);
            }
        }
    }
    for (const res of resolvedFields.values()) {
        for (const hv of Object.values(res)) {
            if (hv && hv.value !== null && hv.value !== undefined) {
                hv.value = parseValue(hv.value);
                allValues.push(hv.value);
            }
        }
    }

    if (allValues.length > 0) {
        await enrichPartyReferences(allValues);
        await enrichAddressReferences(allValues);
    }

    // Phase 3: Build response and apply projection
    for (const q of questions) {
        response[q.questionId] = {};

        if (q.masterQuestionGroupId) {
            const resolved = resolvedGroups.get(q.masterQuestionGroupId) ?? {};
            
            if (q.masterFieldProjectionPath) {
                const projected: Record<string, HydratedValue> = {};
                for (const [fNo, hv] of Object.entries(resolved)) {
                    if (hv.value !== null && hv.value !== undefined) {
                        projected[fNo] = {
                            ...hv,
                            value: Array.isArray(hv.value)
                                ? hv.value.map((v: any) => applyMasterDataProjection(v, q.masterFieldProjectionPath))
                                : applyMasterDataProjection(hv.value, q.masterFieldProjectionPath)
                        };
                    } else {
                        projected[fNo] = hv;
                    }
                }
                response[q.questionId] = projected;
            } else {
                response[q.questionId] = resolved;
            }

        } else if (q.masterFieldNo) {
            const resolved = resolvedFields.get(q.masterFieldNo);
            if (!resolved) continue;
            
            // Deep copy resolved so projection for one question doesn't mutate another question's base value
            const resolvedCopy = { ...resolved };
            
            if (q.masterFieldProjectionPath) {
                const hv = resolvedCopy[q.masterFieldNo];
                if (hv && hv.value !== null && hv.value !== undefined) {
                    resolvedCopy[q.masterFieldNo] = {
                        ...hv,
                        value: Array.isArray(hv.value)
                            ? hv.value.map((v: any) => applyMasterDataProjection(v, q.masterFieldProjectionPath))
                            : applyMasterDataProjection(hv.value, q.masterFieldProjectionPath)
                    };
                }
            }
            
            Object.assign(
                response[q.questionId],
                resolvedCopy
            );
        }
        // else: unmapped — leave as empty object {}
    }

    return response;
}



/**
 * Per-field breakdown for group-mapped questions.
 * Consumed by GroupAnswerRenderer.
 */
export interface GroupFieldDetail {
    fieldNo: number;
    fieldName: string;
    appDataType: string;
    isMultiValue: boolean;
    /** Present if the field is a controlled-vocabulary code list (e.g. 'SIC_2007_UK') */
    codeSystem?: string;
    hydrated: HydratedValue;
    /** Canonical display model for consistent rendering. Added in Phase 1 of migration. */
    canonicalDisplayModel?: import("@/lib/master-data/field-display-model").FieldDisplayModel;
}

export interface FieldDetailData {
    fieldNo?: number;
    fieldName?: string;
    isRepeating: boolean;
    dataType: string;
    category?: string;
    profileConfig?: any;
    hasActiveSourceMappings?: boolean;
    modelField?: string;
    options?: Array<string | { label: string; value: string }>;
    notes?: string;
    description?: string;
    userNote?: string | null;
    current: {
        value: any;
        source: ProvenanceSource;
        timestamp: Date | null;
        confidence: number | null;
        sourceReference?: string;
        claimId?: string;
        isPromotedToCCC?: boolean;
        sourceCheckedAt?: Date | null;
    } | null;
    displayState?: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE";
    defaultResponse?: string;
    assignment: {
        id: string;
        assignedToUserId: string;
        assignedByUserId: string;
        assignedUser?: { name: string | null; email: string };
        createdAt: Date;
    } | null;
    history: any[]; // Lineage will be derived from FieldClaims
    candidates: {
        id: string;
        value: any;
        source: string;
        sourceReference?: string;
        confidence: number | null;
        timestamp: Date;
        isAuthoritative: boolean;
        status: string;
    }[];
    rows?: { 
        id: string; 
        value: any; 
        source: string; 
        timestamp: Date; 
        instanceId?: string; 
        collectionId?: string; 
        data?: any; 
        label?: string; 
        sourceReference?: string; 
        isPromotedToCCC?: boolean;
        canonicalDisplayModel?: import('@/lib/master-data/field-display-model').FieldDisplayModel;
    }[];
    canonicalDisplayModel?: import('@/lib/master-data/field-display-model').FieldDisplayModel;
    /**
     * For repeating/collection fields only.
     * True if the user has made any add or remove action on this collection
     * (i.e. any USER_INPUT claim — value or tombstone — exists for this field).
     * When true, the UI should show a collection-level "User input" badge rather
     * than attributing the whole collection to its registry source.
     */
    isUserCurated?: boolean;
    /**
     * For controlled-vocabulary collection fields only.
     * Set when the field's COMPLEX_FIELD_CONFIG entry has a codeSystem key.
     * Drives the CodeListField UX (picker instead of free-text input).
     * Value is a key in CODE_SYSTEMS — e.g. "SIC_2007_UK".
     */
    codeSystem?: string;
    /**
     * For group-mapped questions only.
     * Per-field breakdown suitable for GroupAnswerRenderer.
     * Only populated when getFieldDetail() is called with a masterQuestionGroupId.
     */
    groupFields?: GroupFieldDetail[];
}

export async function getFieldDetail(
    entityId: string,
    fieldNo: number,
    entityType: 'LEGAL_ENTITY' | 'CLIENT_LE' = 'LEGAL_ENTITY',
    customFieldId?: string,
    masterQuestionGroupId?: string
): Promise<FieldDetailData> {

    // --- Master Question Group Path ---
    if (masterQuestionGroupId) {
        let subjectLeId = entityId;
        let ownerScopeId: string | undefined = undefined;

        if (entityType === 'CLIENT_LE') {
            const clientLE = await prisma.clientLE.findUnique({
                where: { id: entityId }
            });
            subjectLeId = clientLE?.legalEntityId || "";
            ownerScopeId = (await KycStateService.resolveScopeId(entityId)) || undefined;
        }

        if (!subjectLeId) {
            return {
                fieldNo: 0,
                fieldName: "Unknown Group / Missing Subject",
                isRepeating: false,
                dataType: "JSON",
                current: null,
                assignment: null,
                history: [],
                candidates: [],
                notes: "LegalEntity subject missing. Data cannot be resolved.",
                description: undefined
            };
        }

        try {
            const group = await getMasterFieldGroup(masterQuestionGroupId);
            const groupFields: GroupFieldDetail[] = [];

            // Keep a flat dict for backward compat with existing current.value consumers
            const groupValues: Record<string, any> = {};
            let latestTimestamp = new Date(0);

            for (const item of group.items) {
                const def = await getMasterFieldDefinition(item.fieldNo);
                const cfg = getComplexFieldConfig(item.fieldNo);
                const codeSystem = cfg && 'codeSystem' in cfg ? cfg.codeSystem : undefined;

                if (def.isMultiValue) {
                    const filterCollectionId = cfg?.kind === 'STRUCTURED_COLLECTION' ? cfg.collectionId : undefined;
                    const collection = await KycStateService.getAuthoritativeCollection(
                        { subjectLeId }, item.fieldNo, ownerScopeId, undefined, filterCollectionId
                    );
                    if (collection.length > 0) {
                        const maxUpdatedAt = collection.reduce(
                            (max: Date, c: any) => (c.assertedAt > max ? c.assertedAt : max),
                            collection[0].assertedAt as Date
                        );
                        const hydrated: HydratedValue = {
                            value: collection.map((c: any) => c.value),
                            source: collection[0].isScoped ? 'USER_INPUT' : (collection[0].evidenceProvider || 'MASTER_RECORD'),
                            sourceReference: collection[0].sourceReference ?? null,
                            updatedAt: maxUpdatedAt,
                            isSynced: true,
                        };
                        groupFields.push({
                            fieldNo: item.fieldNo,
                            fieldName: def.fieldName,
                            appDataType: def.appDataType,
                            isMultiValue: true,
                            codeSystem,
                            hydrated,
                            canonicalDisplayModel: resolveFieldForDisplay(
                                hydrated.value,
                                hydrated.source ? { type: hydrated.source, reference: hydrated.sourceReference } : null,
                                {
                                    fieldNo: item.fieldNo,
                                    label: def.fieldName,
                                    displayState: hydrated.isSynced ? 'HAS_VALUE' : 'CHECKED_NO_DATA',
                                    appDataType: def.appDataType,
                                    profileConfig: def.profileConfig ? (def.profileConfig as any) : undefined,
                                    isMultiValue: def.isMultiValue,
                                    codeSystem
                                }
                            ),
                        });
                        groupValues[def.fieldName] = hydrated.value;
                        if (maxUpdatedAt > latestTimestamp) latestTimestamp = maxUpdatedAt;
                    } else {
                        // Empty collection — still emit a row so order is preserved;
                        // GroupAnswerRenderer hides isSynced:false rows
                        groupFields.push({
                            fieldNo: item.fieldNo,
                            fieldName: def.fieldName,
                            appDataType: def.appDataType,
                            isMultiValue: true,
                            codeSystem,
                            hydrated: { value: null, source: null, isSynced: false },
                            canonicalDisplayModel: resolveFieldForDisplay(
                                null,
                                null,
                                {
                                    fieldNo: item.fieldNo,
                                    label: def.fieldName,
                                    displayState: 'CHECKED_NO_DATA',
                                    appDataType: def.appDataType,
                                    profileConfig: def.profileConfig ? (def.profileConfig as any) : undefined,
                                    isMultiValue: def.isMultiValue,
                                    codeSystem
                                }
                            ),
                        });
                    }
                } else {
                    const derived = await KycStateService.getAuthoritativeValue(
                        { subjectLeId }, item.fieldNo, ownerScopeId
                    );
                    if (derived) {
                        const hydrated: HydratedValue = {
                            value: derived.value,
                            source: derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || 'MASTER_RECORD'),
                            sourceReference: derived.sourceReference ?? null,
                            updatedAt: derived.assertedAt,
                            isSynced: true,
                        };
                        groupFields.push({
                            fieldNo: item.fieldNo,
                            fieldName: def.fieldName,
                            appDataType: def.appDataType,
                            isMultiValue: false,
                            codeSystem,
                            hydrated,
                            canonicalDisplayModel: resolveFieldForDisplay(
                                hydrated.value,
                                hydrated.source ? { type: hydrated.source, reference: hydrated.sourceReference } : null,
                                {
                                    fieldNo: item.fieldNo,
                                    label: def.fieldName,
                                    displayState: hydrated.isSynced ? 'HAS_VALUE' : 'CHECKED_NO_DATA',
                                    appDataType: def.appDataType,
                                    profileConfig: def.profileConfig ? (def.profileConfig as any) : undefined,
                                    isMultiValue: def.isMultiValue,
                                    codeSystem
                                }
                            ),
                        });
                        groupValues[def.fieldName] = hydrated.value;
                        if (derived.assertedAt > latestTimestamp) latestTimestamp = derived.assertedAt;
                    } else {
                        groupFields.push({
                            fieldNo: item.fieldNo,
                            fieldName: def.fieldName,
                            appDataType: def.appDataType,
                            isMultiValue: false,
                            codeSystem,
                            hydrated: { value: null, source: null, isSynced: false },
                            canonicalDisplayModel: resolveFieldForDisplay(
                                null,
                                null,
                                {
                                    fieldNo: item.fieldNo,
                                    label: def.fieldName,
                                    displayState: 'CHECKED_NO_DATA',
                                    appDataType: def.appDataType,
                                    profileConfig: def.profileConfig ? (def.profileConfig as any) : undefined,
                                    isMultiValue: def.isMultiValue,
                                    codeSystem
                                }
                            ),
                        });
                    }
                }
            }

            return {
                fieldNo: 0,
                fieldName: group.label,
                category: "Master Data Group",
                isRepeating: false,
                dataType: "JSON",
                current: {
                    value: Object.keys(groupValues).length > 0 ? groupValues : null,
                    source: "MULTI_SOURCE" as any,
                    timestamp: latestTimestamp.getTime() > 0 ? latestTimestamp : new Date(),
                    confidence: 1.0
                },
                groupFields,
                assignment: null,
                history: [],
                candidates: []
            };
        } catch (e) {
            console.warn(`[getFieldDetail] Error fetching group data:`, e);
            return {
                fieldNo: 0,
                fieldName: "Unknown Group",
                isRepeating: false,
                dataType: "JSON",
                current: null,
                groupFields: [],
                assignment: null,
                history: [],
                candidates: []
            };
        }
    }

    // --- Custom Field Path ---
    if (customFieldId) {
        // Fetch ClientLE directly
        const le = await prisma.clientLE.findUnique({
            where: { id: entityId },
            select: { customData: true }
        });

        if (!le) throw new Error("Entity not found");

        // Fetch the CustomFieldDefinition to get the label
        const customDef = await prisma.customFieldDefinition.findUnique({
            where: { id: customFieldId },
            select: { label: true, dataType: true, description: true }
        });

        const data = (le.customData as Record<string, any>) || {};
        const val = data[customFieldId]; // Expecting { value, source, timestamp } or just value

        let currentVal = val;
        let source: ProvenanceSource = "USER_INPUT";
        let timestamp = new Date(); // Default if not tracked

        if (val && typeof val === 'object' && 'value' in val) {
            currentVal = val.value;
            source = (val.source as ProvenanceSource) || "USER_INPUT";
            timestamp = val.timestamp ? new Date(val.timestamp) : new Date();
        }

        return {
            fieldNo: 0, // Custom fields don't have a fieldNo
            fieldName: customDef?.label || customFieldId,
            isRepeating: false,
            dataType: customDef?.dataType || 'text',
            description: customDef?.description || undefined,
            current: {
                value: currentVal,
                source,
                timestamp,
                confidence: 1.0
            },
            assignment: null,
            history: [], // No history for custom fields yet (schema limitation)
            candidates: []
        };
    }

    // --- Standard Field Path ---
    const def = await getMasterFieldDefinition(fieldNo);

    // 0. Resolve Subject and Scope
    let subjectLeId = entityId;
    let ownerScopeId: string | undefined = undefined;

    if (entityType === 'CLIENT_LE') {
        const clientLE = await prisma.clientLE.findUnique({
            where: { id: entityId }
        });
        subjectLeId = clientLE?.legalEntityId || "";
        ownerScopeId = (await KycStateService.resolveScopeId(entityId)) || undefined;
    }

    if (!subjectLeId) {
        return {
            fieldNo,
            fieldName: def?.fieldName || "Unknown Field",
            isRepeating: def?.isMultiValue || false,
            dataType: def?.appDataType || 'string',
            current: null,
            assignment: null,
            history: [],
            candidates: [],
            notes: "LegalEntity subject missing. Data cannot be resolved.",
            description: def?.description || undefined,
            profileConfig: (def as any)?.profileConfig || undefined
        };
    }

    // 1. Get Current Value via KycStateService
    const derived = await KycStateService.getAuthoritativeValue({ subjectLeId }, fieldNo, ownerScopeId);

    // 2. Load Rows if repeating
    let rows: { id: string; value: any; source: string; timestamp: Date; instanceId?: string; collectionId?: string; data?: any; label?: string; sourceReference?: string; isPromotedToCCC?: boolean; sourceCheckedAt?: Date | null; }[] | undefined = undefined;

    // Check for Graph Binding
    const bindings = await prisma.masterFieldGraphBinding.findMany({
        where: { fieldNo, isActive: true }
    });
    const graphBinding = bindings.find((b: any) => b.filterEdgeType);

    const isPartyField = def?.appDataType === 'PARTY' || def?.appDataType === 'PERSON_OR_CONTACT' || def?.appDataType === 'PARTY_REF';

    let promotedClaimIds = new Set<string>();
    if (def && (def.appDataType === 'PARTY' || def.appDataType === 'PERSON_OR_CONTACT') && entityType === 'CLIENT_LE') {
        const promotedParties = await prisma.cCParty.findMany({
            where: { clientLEId: entityId, createdFromClaimId: { not: null } },
            select: { createdFromClaimId: true }
        });
        promotedClaimIds = new Set(promotedParties.map((p: any) => p.createdFromClaimId as string));
    } else if (def && def.appDataType === 'ADDRESS' && entityType === 'CLIENT_LE') {
        const promotedAddresses = await prisma.cCAddress.findMany({
            where: { clientLEId: entityId, createdFromClaimId: { not: null } },
            select: { createdFromClaimId: true }
        });
        promotedClaimIds = new Set(promotedAddresses.map((a: any) => a.createdFromClaimId as string));
    }

    if (def?.isMultiValue) {
        if (graphBinding && entityType === 'CLIENT_LE' && !isPartyField) {
            // Source rows from Graph Edges to avoid duplication and show real graph state
            const edges = await prisma.clientLEGraphEdge.findMany({
                where: {
                    clientLEId: entityId,
                    edgeType: graphBinding.filterEdgeType!,
                    isActive: graphBinding.filterActiveOnly ?? true
                },
                include: {
                    fromNode: {
                        include: {
                            person: true,
                            legalEntity: true,
                            address: true
                        }
                    }
                }
            });

            rows = edges.map((edge: any) => {
                const node = edge.fromNode;
                const value = node.person || node.legalEntity || node.address;
                
                let label = "Unknown";
                if (node.person) label = `${node.person.firstName} ${node.person.lastName}`.trim();
                else if (node.legalEntity) label = node.legalEntity.name || "Unknown Entity";
                else if (node.address) label = node.address.line1 || "Unknown Address";

                return {
                    id: edge.id, // We use the edge ID as the primary ID here
                    value: value,
                    source: edge.source as any,
                    timestamp: edge.createdAt,
                    instanceId: edge.id, // Use edge ID as instance ID for graph-bound fields
                    label,
                    sourceReference: edge.edgeType,
                    sourceCheckedAt: null
                };
            });
        } else {
            // Standard path: fetch from FieldClaims
            // For STRUCTURED_COLLECTION fields (e.g. SIC codes), pass the collectionId so
            // legacy plain-text claims (collectionId=NULL) from before the migration are excluded.
            const complexCfg = getComplexFieldConfig(fieldNo);
            const filterCollectionId = complexCfg?.kind === 'STRUCTURED_COLLECTION'
                ? complexCfg.collectionId
                : undefined;

            let collection = await KycStateService.getAuthoritativeCollection(
                { subjectLeId }, fieldNo, ownerScopeId, undefined, filterCollectionId
            );



            rows = collection.map((c: any) => {
                return {
                    id: c.claimId,
                    value: c.value,
                    source: c.isScoped ? 'USER_INPUT' : (c.evidenceProvider || 'SYSTEM'),
                    sourceReference: c.sourceReference || undefined,
                    timestamp: c.assertedAt,
                    instanceId: c.instanceId,
                    collectionId: c.collectionId,
                    data: undefined,
                    label: typeof c.value === 'string' ? c.value : undefined,
                    isPromotedToCCC: promotedClaimIds.has(c.claimId),
                    sourceCheckedAt: c.sourceCheckedAt || null
                };
            });

            // Phase 3: Bulk-resolve PARTY_REF values for display
            // In Phase 3B we resolve *any* claim containing a ccPartyId, regardless of field appDataType.
            if (rows && rows.length > 0) {
                const ccPartyIds = Array.from(new Set(rows.map(r => r.value?.ccPartyId).filter(Boolean)));
                if (ccPartyIds.length > 0) {
                    const parties = await prisma.cCParty.findMany({
                        where: { id: { in: ccPartyIds as string[] } }
                    });
                    const partyMap = new Map(parties.map((p: any) => [p.id, p]));
                    for (const r of rows) {
                        if (r.value?.ccPartyId) {
                            const party = partyMap.get(r.value.ccPartyId);
                            if (party) {
                                r.data = {
                                    ccParty: party,
                                    resolvedSummary: getPartySummary((party as any).data),
                                    resolvedType: (party as any).data?.partySubType || (party as any).data?.partyType
                                };
                            } else {
                                r.data = { isDeleted: true };
                            }
                        }
                    }
                }
            }

            // Phase 3C: Bulk-resolve CC_ADDRESS_REF values for display
            if (rows && rows.length > 0) {
                const ccAddressIds = Array.from(new Set(rows.map(r => r.value?.ccAddressId).filter(Boolean)));
                if (ccAddressIds.length > 0) {
                    const addresses = await prisma.cCAddress.findMany({
                        where: { id: { in: ccAddressIds as string[] } }
                    });
                    const addressMap = new Map(addresses.map((a: any) => [a.id, a]));
                    
                    const getSummary = (data: any) => {
                        if (!data) return "";
                        const parts = [
                            ...(data.addressLines || []),
                            data.locality,
                            data.region,
                            data.postalCode,
                            data.countryName || data.countryCode
                        ].filter(Boolean);
                        return parts.join(", ");
                    };

                    for (const r of rows) {
                        if (r.value?.ccAddressId) {
                            const address = addressMap.get(r.value.ccAddressId);
                            if (address) {
                                r.data = {
                                    ...r.data,
                                    _resolvedData: {
                                        ...(r.data?._resolvedData || {}),
                                        ccAddress: address
                                    },
                                    resolvedSummary: getSummary((address as any).data)
                                };
                            } else {
                                r.data = { ...r.data, isDeleted: true };
                            }
                        }
                    }
                }
            }
        }
    }

    // 2b. Compute isUserCurated for repeating fields (single lightweight query).
    // True if the user has ever made any add or remove action on this collection,
    // meaning any USER_INPUT claim (value or tombstone) exists for (subjectLeId, fieldNo).
    let isUserCurated: boolean | undefined;
    if (def?.isMultiValue && subjectLeId) {
        const userAction = await prisma.fieldClaim.findFirst({
            where: { subjectLeId, fieldNo, sourceType: 'USER_INPUT', claimRole: 'VALUE' },
            select: { id: true }
        });
        isUserCurated = !!userAction;
    }

    // 2. Get History (Lineage) - Force re-bundle for new Prisma client

    const claims = await prisma.fieldClaim.findMany({
        where: {
            fieldNo,
            claimRole: 'VALUE',
            subjectLeId: subjectLeId,
            OR: [
                { ownerScopeId: null },
                { ownerScopeId: ownerScopeId }
            ]
        },
        include: {
            verifiedBy: {
                select: { name: true, email: true }
            }
        },
        orderBy: { assertedAt: 'desc' },
        take: 20
    });

    const history = claims.map((c: any) => ({
        id: c.id,
        claimId: c.id,
        newValue: (c.valueText ?? c.valueNumber ?? c.valueDate ?? c.valueJson ?? c.valueLeId ?? c.valuePersonId ?? c.valueOrgId ?? c.valueDocId) ?? null,
        source: c.sourceType,
        sourceType: c.sourceType,
        timestamp: c.assertedAt,
        assertedAt: c.assertedAt,
        actorId: c.verifiedBy?.name || c.verifiedBy?.email || "System",
        assertedByUserName: c.verifiedBy?.name || c.verifiedBy?.email || "System",
        actor: c.sourceReference, // Use sourceReference for reference detail (reason/LEI)
        status: c.status,
        isScoped: c.ownerScopeId !== null,
        isTombstone: KycStateService.isTombstone(c),
        instanceId: c.instanceId,
        collectionId: c.collectionId
    }));

    // 3. Get Candidates (Persisted Claims)
    // We already have 'claims' (the last 20), let's map them to candidates
    const candidates = claims.map((c: any) => {
        const val = (c.valueText ?? c.valueNumber ?? c.valueDate ?? c.valueJson ?? c.valueLeId ?? c.valuePersonId ?? c.valueOrgId ?? c.valueDocId) ?? null;
        
        return {
            id: c.id,
            value: val,
            source: c.sourceType,
            sourceReference: c.sourceReference || undefined,
            confidence: c.confidenceScore || null,
            timestamp: c.assertedAt,
            isAuthoritative: derived ? derived.claimId === c.id : false,
            status: c.status
        };
    });

    // 3.5 Enrich PARTY_REF values for non-repeating authoritative value and candidates
    const valuesToEnrich: any[] = [];
    if (derived && derived.value) valuesToEnrich.push(derived.value);
    for (const c of candidates) {
        if (c.value) valuesToEnrich.push(c.value);
    }
    // Also enrich the repeating rows value objects directly so the frontend gets a uniform shape
    if (rows && rows.length > 0) {
        for (const r of rows) {
            if (r.value) valuesToEnrich.push(r.value);
        }
    }
    if (valuesToEnrich.length > 0) {
        await enrichPartyReferences(valuesToEnrich);
        await enrichAddressReferences(valuesToEnrich);
    }

    /**
     * Phase 1 Proxy: This timestamp indicates when the mapped source(s) were last 
     * successfully synced globally for this entity. 
     * IMPORTANT LIMITATION: It does NOT guarantee that this exact field mapping was 
     * evaluated during that sync (e.g., if the mapping was added *after* the sync occurred).
     */
    let sourceSyncDerivedLastValidatedAt: Date | null = null;
    const mappedSources = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: fieldNo, isActive: true },
        select: { sourceType: true }
    });
    
    if (mappedSources.length > 0 && entityType === 'CLIENT_LE') {
        const fullClientLE = await prisma.clientLE.findUnique({
            where: { id: entityId },
            include: { registryReferences: true }
        });
        if (fullClientLE) {
            const sources = mappedSources.map((m: any) => m.sourceType);
            let dates: Date[] = [];
            if (sources.includes('GLEIF') && fullClientLE.gleifFetchedAt) {
                dates.push(fullClientLE.gleifFetchedAt);
            }
            if (sources.includes('REGISTRATION_AUTHORITY') || sources.includes('COMPANIES_HOUSE')) {
                for (const ref of fullClientLE.registryReferences) {
                    if (ref.lastSyncSucceededAt) dates.push(ref.lastSyncSucceededAt);
                }
                if (fullClientLE.registryFetchedAt) dates.push(fullClientLE.registryFetchedAt);
            }
            if (dates.length > 0) {
                sourceSyncDerivedLastValidatedAt = new Date(Math.max(...dates.map(d => d.getTime())));
            }
        }
    }

    // 4. Get Current Assignment
    const [assignment, noteRecord] = await Promise.all([
        prisma.masterFieldAssignment.findUnique({
            where: {
                clientLEId_fieldNo: {
                    clientLEId: entityId,
                    fieldNo: fieldNo
                }
            },
            include: {
                assignedUser: {
                    select: { name: true, email: true }
                }
            }
        }),
        // Manual SQL fallback because Prisma client model property might be missing from runtime cache in dev
        prisma.$queryRaw<any[]>`SELECT text FROM master_field_notes WHERE "clientLEId" = ${entityId} AND "fieldNo" = ${fieldNo} LIMIT 1`
    ]);

    const noteText = noteRecord?.[0]?.text || null;

    const fieldMappings = await prisma.sourceFieldMapping.findMany({
        where: { targetFieldNo: fieldNo, isActive: true },
        select: { sourceType: true, sourceReference: true, priority: true },
        orderBy: { priority: 'asc' }
    });
    const hasMapping = fieldMappings.length > 0;
    
    let hasEvaluationAttempt = false;
    let evaluatedSourceBadge = "";
    let evaluatedSourceTimestamp: Date | null = null;
    
    let clientLEForSource: any = null;
    if (entityType === 'CLIENT_LE') {
        clientLEForSource = await prisma.clientLE.findUnique({
            where: { id: entityId },
            include: { registryReferences: { include: { authority: true } } }
        });
    }

    if (hasMapping && clientLEForSource) {
        // Iterate in priority order to find the highest-priority synced source
        for (const mapping of fieldMappings) {
            if (mapping.sourceType === "GLEIF" && clientLEForSource.gleifFetchedAt) {
                hasEvaluationAttempt = true;
                evaluatedSourceBadge = "GLEIF";
                evaluatedSourceTimestamp = clientLEForSource.gleifFetchedAt;
                break;
            }
            if (mapping.sourceType === "REGISTRATION_AUTHORITY" || mapping.sourceType === "COMPANIES_HOUSE") {
                const refs = clientLEForSource.registryReferences || [];
                    // Find a reference that matches this specific mapping
                    // If sourceReference is null, any RA ref that has been synced counts
                    const matchingRef = refs.find((r: any) => {
                        const hasSync = !!(r.lastSyncSucceededAt || r.lastSyncStatus);
                        if (!hasSync) return false;
                        if (!mapping.sourceReference) return true; // generic mapping matches any synced RA
                        // Specific RA match
                        if (mapping.sourceReference === "COMPANIES_HOUSE" && r.authority?.name?.includes("Companies House")) return true;
                        if (mapping.sourceReference === r.authority?.registryKey) return true;
                        return false;
                    });
                    
                    if (matchingRef) {
                        hasEvaluationAttempt = true;
                        evaluatedSourceBadge = mapping.sourceReference || mapping.sourceType;
                        evaluatedSourceTimestamp = matchingRef.lastSyncSucceededAt || matchingRef.createdAt; // Fallback to createdAt if lastSyncSucceededAt is null
                        break;
                    }
                }
            }
        }

    let displayState: "HAS_VALUE" | "MAPPED_NOT_CHECKED" | "CHECKED_NO_DATA" | "DEFAULT_RESPONSE" | "UNMAPPED_NO_RESPONSE" = "UNMAPPED_NO_RESPONSE";
    
    // Rely on the canonical field interpreter to determine if this value is actually empty,
    // avoiding JS quirks like Date objects falsely evaluating as empty plain objects.
    const derivedValueForCheck = def?.isMultiValue && rows ? rows.map((r: any) => r.value) : derived?.value;
    const interpreterState = resolveFieldForDisplay(derivedValueForCheck, null, {
        isMultiValue: def?.isMultiValue
    } as any).state;
    const hasValue = interpreterState === 'POPULATED' || interpreterState === 'EXPLICIT_NONE';
    
    if (hasValue) {
        displayState = "HAS_VALUE";
    } else if (hasEvaluationAttempt) {
        displayState = "CHECKED_NO_DATA";
    } else if ((def as any)?.defaultResponse) {
        displayState = "DEFAULT_RESPONSE";
    } else if (hasMapping && !hasEvaluationAttempt) {
        displayState = "MAPPED_NOT_CHECKED";
    }

    let finalSourceBadgeForEmpty = (!hasValue && (displayState === 'MAPPED_NOT_CHECKED' || displayState === 'CHECKED_NO_DATA') && evaluatedSourceBadge) ? evaluatedSourceBadge : undefined;

    const result = {
        fieldNo,
        fieldName: def?.fieldName,
        isRepeating: def?.isMultiValue || false,
        dataType: def?.appDataType || 'string',
        category: (def as any)?.masterDataCategory?.displayName || undefined,
        profileConfig: (def as any)?.profileConfig || undefined,
        hasActiveSourceMappings: hasMapping,
        modelField: (def as any).modelField || undefined,
        // Prefer options from the linked MasterDataOptionSet (admin-managed dropdown list).
        // The optionSet.options field is a Json array of {label, value} objects.
        // Fall back to the legacy def.options string array for backward compat.
        options: (() => {
            const optionSet = (def as any)?.optionSet;
            if (optionSet?.options && Array.isArray(optionSet.options) && optionSet.options.length > 0) {
                // Return {label, value} objects for rich Select rendering
                return optionSet.options.map((o: any) =>
                    typeof o === 'object' && o.label !== undefined
                        ? { label: String(o.label), value: String(o.value ?? o.label) }
                        : { label: String(o), value: String(o) }
                );
            }
            // Legacy: plain string array — wrap as {label, value} for uniform handling
            return (def?.options || []).map((s: string) => ({ label: s, value: s }));
        })(),
        notes: def?.notes || undefined,
        description: def?.description || undefined,
        current: derived ? {
            value: def?.isMultiValue && rows ? rows.map((r: any) => r.value) : derived.value,
            source: (derived.isScoped ? 'USER_INPUT' : (derived.evidenceProvider || derived.sourceType || 'SYSTEM')) as ProvenanceSource,
            sourceReference: derived.sourceReference || undefined,
            timestamp: (() => {
                if (def?.isMultiValue && rows && rows.length > 0) {
                    const times = rows.map((r: any) => r.timestamp ? new Date(r.timestamp).getTime() : 0).filter((t: number) => t > 0);
                    if (times.length > 0) return new Date(Math.max(...times));
                }
                return derived.assertedAt;
            })(),
            confidence: derived.confidenceScore || 1.0,
            claimId: derived.claimId,
            isPromotedToCCC: promotedClaimIds.has(derived.claimId),
            sourceCheckedAt: derived.sourceCheckedAt || evaluatedSourceTimestamp
        } : (finalSourceBadgeForEmpty ? {
            value: null,
            source: finalSourceBadgeForEmpty as ProvenanceSource,
            timestamp: evaluatedSourceTimestamp,
            confidence: null,
            isPromotedToCCC: false,
            sourceCheckedAt: sourceSyncDerivedLastValidatedAt || evaluatedSourceTimestamp
        } : null),
        displayState,
        defaultResponse: (def as any)?.defaultResponse || undefined,
        assignment: assignment ? {
            id: assignment.id,
            assignedToUserId: assignment.assignedToUserId,
            assignedByUserId: assignment.assignedByUserId,
            assignedUser: assignment.assignedUser,
            createdAt: assignment.createdAt
        } : null,
        userNote: noteText,
        history,
        candidates,
        rows,
        isUserCurated,
        codeSystem: (() => {
            const cfg = getComplexFieldConfig(fieldNo);
            if (cfg && cfg.kind === 'STRUCTURED_COLLECTION') return cfg.codeSystem;
            return undefined;
        })(),
    };

    // Phase 3B: Bulk-resolve PARTY_REF for `current.value` if it's a non-repeating field or array of values,
    // regardless of appDataType.
    if (result.current?.value) {
        let ccPartyIds: string[] = [];
        if (Array.isArray(result.current.value)) {
            ccPartyIds = result.current.value.map((v: any) => v?.ccPartyId).filter(Boolean);
        } else if (result.current.value?.ccPartyId) {
            ccPartyIds = [result.current.value.ccPartyId];
        }

        if (ccPartyIds.length > 0) {
            const parties = await prisma.cCParty.findMany({
                where: { id: { in: ccPartyIds } }
            });
            const partyMap = new Map(parties.map((p: any) => [p.id, p]));
            
            const enrichValue = (val: any) => {
                if (val?.ccPartyId) {
                    const party = partyMap.get(val.ccPartyId);
                    if (party) {
                        return {
                            ...val,
                            _resolvedData: {
                                ccParty: party,
                                resolvedSummary: getPartySummary((party as any).data),
                                resolvedType: (party as any).data?.partySubType || (party as any).data?.partyType
                            }
                        };
                    } else {
                        return { ...val, _resolvedData: { isDeleted: true } };
                    }
                }
                return val;
            };

            if (Array.isArray(result.current.value)) {
                result.current.value = result.current.value.map(enrichValue);
            } else {
                result.current.value = enrichValue(result.current.value);
            }
        }
    }

    // Phase 3C: Bulk-resolve CC_ADDRESS_REF for `current.value`
    if (result.current?.value) {
        let ccAddressIds: string[] = [];
        if (Array.isArray(result.current.value)) {
            ccAddressIds = result.current.value.map((v: any) => v?.ccAddressId).filter(Boolean);
        } else if (result.current.value?.ccAddressId) {
            ccAddressIds = [result.current.value.ccAddressId];
        }

        if (ccAddressIds.length > 0) {
            const addresses = await prisma.cCAddress.findMany({
                where: { id: { in: ccAddressIds } }
            });
            const addressMap = new Map(addresses.map((a: any) => [a.id, a]));
            
            const getSummary = (data: any) => {
                if (!data) return "";
                const parts = [
                    ...(data.addressLines || []),
                    data.locality,
                    data.region,
                    data.postalCode,
                    data.countryName || data.countryCode
                ].filter(Boolean);
                return parts.join(", ");
            };

            const enrichValue = (val: any) => {
                if (val?.ccAddressId) {
                    const address = addressMap.get(val.ccAddressId);
                    if (address) {
                        return {
                            ...val,
                            _resolvedData: {
                                ...(val._resolvedData || {}),
                                ccAddress: address
                            },
                            resolvedSummary: getSummary((address as any).data)
                        };
                    } else {
                        return { ...val, _resolvedData: { ...(val._resolvedData || {}), isDeleted: true } };
                    }
                }
                return val;
            };

            if (Array.isArray(result.current.value)) {
                result.current.value = result.current.value.map(enrichValue);
            } else {
                result.current.value = enrichValue(result.current.value);
            }
        }
    }

    // Phase FD-1: Attach canonical display model to root current value
    const metadataForDisplay = {
        fieldNo: result.fieldNo ?? 0,
        label: result.fieldName ?? 'Unknown Field',
        displayState: result.displayState as any,
        appDataType: result.dataType as any,
        profileConfig: result.profileConfig as any,
        isMultiValue: result.isRepeating,
        codeSystem: result.codeSystem
    };

    if (result.current) {
        (result as any).canonicalDisplayModel = resolveFieldForDisplay(
            result.current.value,
            result.current.source ? { 
                type: result.current.source as any, 
                reference: result.current.sourceReference,
                timestamp: result.current.timestamp,
                sourceCheckedAt: result.current.sourceCheckedAt
            } : null,
            metadataForDisplay
        );
    }

    // Phase FD-1: Attach canonical display model to each row for repeating fields
    if (result.isRepeating && result.rows) {
        for (const row of result.rows) {
            (row as any).canonicalDisplayModel = resolveFieldForDisplay(
                row.value,
                row.source ? { 
                    type: row.source as any, 
                    reference: row.sourceReference,
                    timestamp: row.timestamp,
                    sourceCheckedAt: row.sourceCheckedAt 
                } : null,
                {
                    ...metadataForDisplay,
                    // Treat each row as a single scalar item for canonical display purposes
                    isMultiValue: false 
                }
            );
        }
    }

    return result;

}

// --- Console Question Fetcher ---

export interface ConsoleQuestion {
    id: string;
    text: string;
    category: string;
    masterFieldNo?: number | null;
    masterFieldProjectionPath?: string | null;
    masterQuestionGroupId?: string | null;
    customFieldDefinitionId?: string | null;
    status: string;
    questionnaireName: string;
    answer?: string | null;
    engagementOrgName?: string;
    masterDataValue?: any;
    masterDataSource?: string | null;
    masterDataUpdatedAt?: Date | null;
    masterFieldCategory?: string | null;
    isLocked?: boolean;
    approvedAt?: Date | null;
    releasedAt?: Date | null;
    /** For group-mapped questions only. Per-field breakdown with full provenance.
     *  Populated by getWorkbench4Data(). Consumed by GroupAnswerRenderer in workbench4.
     *  undefined for all non-group questions — fully backward compatible. */
    masterDataGroupFields?: GroupFieldDetail[];
    /** For single mapped fields in workbench4. */
    canonicalDisplayModel?: import("@/lib/master-data/field-display-model").FieldDisplayModel;
};

export async function getConsoleQuestions(leId: string, includeLocked: boolean = false): Promise<ConsoleQuestion[]> {
    // 1. Find all active Engagements for this ClientLE
    const engagements = await prisma.fIEngagement.findMany({
        where: {
            clientLEId: leId,
            status: { not: 'ARCHIVED' }
        },
        include: {
            org: {
                select: { name: true }
            },
            questionnaires: {
                where: { isDeleted: false },
                include: {
                    questions: {
                        where: includeLocked ? undefined : { isLocked: false },
                        orderBy: { order: 'asc' }
                    }
                }
            },
            questionnaireInstances: {
                where: { isDeleted: false },
                include: {
                    questions: {
                        where: includeLocked ? undefined : { isLocked: false },
                        orderBy: { order: 'asc' }
                    }
                }
            }
        }
    });

    const clientLE = await prisma.clientLE.findUnique({
        where: { id: leId },
        select: {
            commonQuestionnaires: {
                where: { isDeleted: false },
                include: {
                    questions: {
                        where: includeLocked ? undefined : { isLocked: false },
                        orderBy: { order: 'asc' }
                    }
                }
            }
        }
    });

    const consoleQuestions: ConsoleQuestion[] = [];
    const seenQuestionIds = new Set<string>();

    // 2. Flatten and Map
    for (const eng of engagements) {
        // Process Templates
        for (const qnaire of eng.questionnaires) {
            for (const qRaw of qnaire.questions) {
                const q = qRaw as any;
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name,
                    masterFieldNo: q.masterFieldNo,
                    masterFieldProjectionPath: q.masterFieldProjectionPath,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    customFieldDefinitionId: q.customFieldDefinitionId,
                    status: q.status || (q.answer ? "ANSWERED" : "OPEN"),
                    questionnaireName: qnaire.name,
                    answer: q.answer,
                    engagementOrgName: eng.org.name,
                    isLocked: q.isLocked,
                    approvedAt: q.approvedAt,
                    releasedAt: q.releasedAt
                });
            }
        }

        // Process Instances (Snapshots)
        for (const qnaire of eng.questionnaireInstances) {
            for (const qRaw of qnaire.questions) {
                const q = qRaw as any;
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name,
                    masterFieldNo: q.masterFieldNo,
                    masterFieldProjectionPath: q.masterFieldProjectionPath,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    customFieldDefinitionId: q.customFieldDefinitionId,
                    status: q.status || (q.answer ? "ANSWERED" : "OPEN"),
                    questionnaireName: qnaire.name,
                    answer: q.answer,
                    engagementOrgName: eng.org.name,
                    isLocked: q.isLocked,
                    approvedAt: q.approvedAt,
                    releasedAt: q.releasedAt
                });
            }
        }
    }

    // Process Common Questionnaires
    if (clientLE?.commonQuestionnaires) {
        for (const qnaire of clientLE.commonQuestionnaires) {
            for (const qRaw of qnaire.questions) {
                const q = qRaw as any;
                if (seenQuestionIds.has(q.id)) continue;
                seenQuestionIds.add(q.id);

                consoleQuestions.push({
                    id: q.id,
                    text: q.text,
                    category: qnaire.name,
                    masterFieldNo: q.masterFieldNo,
                    masterFieldProjectionPath: q.masterFieldProjectionPath,
                    masterQuestionGroupId: q.masterQuestionGroupId,
                    customFieldDefinitionId: q.customFieldDefinitionId,
                    masterDataValue: undefined,
                    masterDataSource: undefined,
                    masterDataUpdatedAt: undefined,
                    questionnaireName: qnaire.name,
                    engagementOrgName: "Common",
                    status: q.status,
                    isLocked: q.isLocked,
                    approvedAt: q.approvedAt,
                    releasedAt: q.releasedAt
                });
            }
        }
    }

    return consoleQuestions;
}



// --- User Assignments Aggregator ---

export interface UserAssignmentAgg {
    questions: {
        id: string;
        text: string;
        status: string;
        questionnaireName: string;
        engagementOrgName?: string;
        clientLEId?: string;
        engagementId?: string;
        assignedByUserName?: string;
        createdAt: Date;
    }[];
    masterFields: {
        id: string;
        fieldNo: number;
        fieldName: string;
        category?: string;
        status: 'DRAFT' | 'APPROVED' | 'SHARED' | 'RELEASED';
        clientLEId: string;
        engagementOrgName?: string;
        assignedByUserName?: string;
        createdAt: Date;
    }[];
}

export async function getUserAssignments(userId: string): Promise<UserAssignmentAgg> {
    const questionsRaw = await prisma.question.findMany({
        where: {
            assignedToUserId: userId,
            status: { not: "APPROVED" },
            questionnaire: { isDeleted: false }
        },
        include: {
            questionnaire: {
                include: {
                    engagements: { include: { org: true } },
                    fiEngagement: { include: { org: true } }
                }
            },
            assignedToUser: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const questions = questionsRaw.map((q: any) => {
        let orgName = "Unknown Org";
        let leId = undefined;
        let engId = undefined;

        const m2mEng = q.questionnaire?.engagements?.[0];
        const dirEng = q.questionnaire?.fiEngagement;

        if (dirEng) {
            orgName = dirEng.org?.name || orgName;
            leId = dirEng.clientLEId;
            engId = dirEng.id;
        } else if (m2mEng) {
            orgName = m2mEng.org?.name || orgName;
            leId = m2mEng.clientLEId;
            engId = m2mEng.id;
        }

        return {
            id: q.id,
            text: q.text,
            status: q.status,
            questionnaireName: q.questionnaire?.name || "Unknown Questionnaire",
            engagementOrgName: orgName,
            clientLEId: leId,
            engagementId: engId,
            assignedByUserName: q.assignedToUser?.name || q.assignedToUser?.email || "System",
            createdAt: q.createdAt
        };
    });

    const fieldsRaw = await prisma.masterFieldAssignment.findMany({
        where: { assignedToUserId: userId },
        include: {
            clientLE: {
                include: {
                    fiEngagements: { include: { org: true }, take: 1 }
                }
            },
            assignedUser: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const masterFields = await Promise.all(fieldsRaw.map(async (f: any) => {
        const fieldNo = parseInt(f.fieldNo.toString());
        let fieldName = `Field ${fieldNo}`;
        try {
            const def = await getMasterFieldDefinition(fieldNo);
            fieldName = def.fieldName;
        } catch (e) { }

        const eng = f.clientLE?.fiEngagements?.[0];
        const orgName = eng?.org?.name || "Workspace";

        return {
            id: f.id,
            fieldNo: f.fieldNo,
            fieldName,
            clientLEId: f.clientLEId,
            engagementOrgName: orgName,
            assignedByUserName: f.assignedUser?.name || f.assignedUser?.email || "System",
            createdAt: f.createdAt,
            status: 'DRAFT' as const
        };
    }));

    return { questions, masterFields };
}

export async function getUserAssignmentCount(userId: string): Promise<number> {
    const [qCount, fCount] = await Promise.all([
        prisma.question.count({
            where: {
                assignedToUserId: userId,
                status: { not: "APPROVED" },
                questionnaire: { isDeleted: false }
            }
        }),
        prisma.masterFieldAssignment.count({
            where: { assignedToUserId: userId }
        })
    ]);
    return qCount + fCount;
}
