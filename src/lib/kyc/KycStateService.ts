import prisma from "@/lib/prisma";
import { ClaimStatus, FieldClaim, Prisma } from "@prisma/client";
import { COLLECTION_FIELD_CONFIG } from "./collection-field-config";
import { getFallbackPriority, USER_INPUT_PRIORITY } from "./source-priority-config";
import { fetchProvenanceMap, resolveSourceCheckedAt } from "./provenance-enricher";

export type DerivedValue = {
    value: any;
    claimId: string;
    status: ClaimStatus;
    isScoped: boolean;
    sourceType: string;
    sourceReference?: string;
    evidenceProvider?: string;
    confidenceScore?: number;
    evidenceId?: string;
    instanceId?: string;
    collectionId?: string;
    assertedAt: Date;
    /** Start of the relationship period (e.g. director appointment date). */
    effectiveFrom?: Date;
    /** End of the relationship period (e.g. director resignation date). Null/absent = still active. */
    effectiveTo?: Date;
    /** The date the value was last validated against its authoritative source. */
    sourceCheckedAt?: Date;
};

// ── Priority resolution ───────────────────────────────────────────────────────

/**
 * Map keyed by "sourceType:sourceReference" where null sourceReference is
 * represented as the literal string "__null__".
 * Value is the lowest active SourceFieldMapping.priority for that source.
 * Exported so resolveMasterDataBatch can build these maps from pre-loaded data.
 */
export type SourcePriorityMap = Map<string, number>;

/** Build the map key for a (sourceType, sourceReference) pair.
 *  Exported so resolveMasterDataBatch can reuse the same key scheme. */
export function priorityKey(sourceType: string, sourceReference: string | null): string {
    return `${sourceType}:${sourceReference ?? "__null__"}`;
}

export class KycStateService {
    /**
     * Resolves the default ownerScopeId for a ClientLE.
     * This is the partyId of its active ClientLEOwner.
     */
    static async resolveScopeId(clientLEId: string): Promise<string | null> {
        const owner = await prisma.clientLEOwner.findFirst({
            where: { clientLEId, endAt: null },
            select: { partyId: true }
        });
        return owner?.partyId || null;
    }

    /**
     * Pre-loads SourceFieldMapping priority values for all unique
     * (sourceType, sourceReference) combinations present in a claim set.
     *
     * Resolution strategy (per source key):
     *   1. Scoped match  — sourceType + sourceReference (exact)
     *   2. Generic match — sourceType + sourceReference IS NULL
     *   When both exist for a key, the scoped row is used exclusively
     *   (it represents the admin's explicit per-RA intent).
     *   Within a tier, the minimum priority among active rows wins.
     *
     * Called once per getAuthoritativeValue / getAuthoritativeCollection
     * invocation to avoid N+1 queries inside pickWinner().
     */
    private static async preloadMappingPriorities(
        claims: FieldClaim[],
        fieldNo: number
    ): Promise<SourcePriorityMap> {
        const priorityMap: SourcePriorityMap = new Map();

        if (claims.length === 0) return priorityMap;

        // Collect unique (sourceType, sourceReference) pairs
        const uniquePairs = new Map<string, { sourceType: string; sourceReference: string | null }>();
        for (const c of claims) {
            const key = priorityKey(c.sourceType, c.sourceReference);
            if (!uniquePairs.has(key)) {
                uniquePairs.set(key, { sourceType: c.sourceType, sourceReference: c.sourceReference });
            }
        }

        // Collect unique sourceTypes (for generic fallback fetch)
        const uniqueSourceTypes = [...new Set([...uniquePairs.values()].map(p => p.sourceType))];

        // One query: fetch all active mappings for this fieldNo that match either:
        //   (a) the exact (sourceType, sourceReference) pairs we see in the claims
        //   (b) the generic (sourceType, null) rows for each sourceType present
        const rows = await (prisma as any).sourceFieldMapping.findMany({
            where: {
                targetFieldNo: fieldNo,
                isActive: true,
                OR: [
                    // Exact matches (includes null-ref ones already)
                    ...([...uniquePairs.values()].map(p => ({
                        sourceType: p.sourceType,
                        sourceReference: p.sourceReference,
                    }))),
                    // Generic null fallbacks for each sourceType present
                    ...uniqueSourceTypes.map(st => ({
                        sourceType: st,
                        sourceReference: null,
                    })),
                ],
            },
            select: { sourceType: true, sourceReference: true, priority: true },
        }) as Array<{ sourceType: string; sourceReference: string | null; priority: number }>;

        // Build the map.
        // Rule: for each key, store the minimum priority among all matching rows.
        // We do scoped and generic separately so the caller can prefer scoped.
        const scoped = new Map<string, number>();   // exact sourceReference
        const generic = new Map<string, number>();  // sourceReference IS NULL

        for (const row of rows) {
            const key = priorityKey(row.sourceType, row.sourceReference);
            if (row.sourceReference === null) {
                const existing = generic.get(key);
                if (existing === undefined || row.priority < existing) {
                    generic.set(key, row.priority);
                }
            } else {
                const existing = scoped.get(key);
                if (existing === undefined || row.priority < existing) {
                    scoped.set(key, row.priority);
                }
            }
        }

        // Merge: scoped takes precedence over generic for the same sourceType
        // Generic rows are stored under their own key ("sourceType:__null__")
        // so they serve as fallback when a claim has no scoped row.
        for (const [key, priority] of generic) {
            priorityMap.set(key, priority);
        }
        for (const [key, priority] of scoped) {
            // Scoped key always wins; it also shadows the generic for THIS sourceType
            // because resolvePriority() checks scoped first then falls back to generic key.
            priorityMap.set(key, priority);
        }

        return priorityMap;
    }

    /**
     * Derives the authoritative value for a single-value field.
     */
    static async getAuthoritativeValue(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldNo: number,
        ownerScopeId?: string,
        snapshotDate?: Date
    ): Promise<DerivedValue | null> {
        const { clientLEId, ...subjectFilter } = subject;
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo,
                ...subjectFilter,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                assertedAt: snapshotDate ? { lte: snapshotDate } : undefined,
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null }
                ]
            },
            orderBy: [
                { assertedAt: 'desc' },
                { id: 'desc' }
            ]
        });

        if (claims.length === 0) return null;

        // Pre-load mapping priorities — single batched query, no N+1
        const priorityMap = await this.preloadMappingPriorities(claims, fieldNo);

        const winner = this.pickWinner(claims, ownerScopeId, priorityMap);
        if (!winner || this.isTombstone(winner)) return null;

        const derived = this.mapToDerivedValue(winner, ownerScopeId);
        
        if (subject.clientLEId) {
            const provenanceMap = await fetchProvenanceMap({ clientLEId: subject.clientLEId });
            const resolvedCheckedAt = resolveSourceCheckedAt(
                derived.sourceType || derived.evidenceProvider,
                derived.sourceReference,
                derived.assertedAt,
                provenanceMap
            );
            if (resolvedCheckedAt) {
                derived.sourceCheckedAt = resolvedCheckedAt;
            }
        }

        return derived;
    }

    /**
     * Derives a collection of values for a repeating field.
     */
    static async getAuthoritativeCollection(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldNo: number,
        ownerScopeId?: string,
        snapshotDate?: Date,
        /**
         * When provided, restricts results to claims with this exact collectionId.
         * Pass the COMPLEX_FIELD_CONFIG `collectionId` (e.g. 'SIC_CODES') to exclude
         * legacy plain-text claims that pre-date the structured collection architecture
         * and have collectionId = NULL.
         */
        filterCollectionId?: string
    ): Promise<DerivedValue[]> {
        const { clientLEId, ...subjectFilter } = subject;
        // Multi-value Comparison Set: (subject, fieldNo, ownerScopeId, collectionId, instanceId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo,
                ...subjectFilter,
                // When a named collection is specified, exclude legacy NULL-collectionId claims.
                collectionId: filterCollectionId ?? undefined,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                assertedAt: snapshotDate ? { lte: snapshotDate } : undefined,
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null }
                ]
            },
            orderBy: [
                { assertedAt: 'desc' },
                { id: 'desc' }
            ]
        });

        // Pre-load mapping priorities once for the entire collection
        const priorityMap = await this.preloadMappingPriorities(claims, fieldNo);

        // Group by collectionId and instanceId
        const itemGroups: Record<string, FieldClaim[]> = {};
        for (const c of claims) {
            const key = `${c.collectionId || 'default'}:${c.instanceId || 'default'}`;
            if (!itemGroups[key]) itemGroups[key] = [];
            itemGroups[key].push(c);
        }

        const results: DerivedValue[] = [];
        let provenanceMap = null;
        if (subject.clientLEId) {
            provenanceMap = await fetchProvenanceMap({ clientLEId: subject.clientLEId });
        }

        for (const key in itemGroups) {
            const winner = this.pickWinner(itemGroups[key], ownerScopeId, priorityMap);
            if (winner && !this.isTombstone(winner)) {
                const derived = this.mapToDerivedValue(winner, ownerScopeId);
                const resolvedCheckedAt = resolveSourceCheckedAt(
                    derived.sourceType || derived.evidenceProvider,
                    derived.sourceReference,
                    derived.assertedAt,
                    provenanceMap
                );
                if (resolvedCheckedAt) {
                    derived.sourceCheckedAt = resolvedCheckedAt;
                }
                results.push(derived);
            }
        }

        // ── Effective-date post-filter ─────────────────────────────────────────
        // For collection fields configured with filterByEffectiveDate, exclude
        // rows where effectiveTo has passed relative to the evaluation date.
        //
        // The evaluation date is snapshotDate when provided (historical query)
        // or now() for a current view. This is separate from snapshotDate's
        // role in filtering assertedAt — both may be active simultaneously.
        //
        // Tombstones are already excluded above; this filter only touches rows
        // that have a non-null effectiveTo on the winning claim.
        const config = COLLECTION_FIELD_CONFIG[fieldNo];
        if (config?.filterByEffectiveDate) {
            const evaluationDate = snapshotDate ?? new Date();
            return results.filter(row => {
                if (!row.effectiveTo) return true;            // null = still active
                return row.effectiveTo > evaluationDate;      // ended after evaluation date
            });
        }

        return results;
    }

    /**
     * Batch-resolves authoritative values for ALL fields of a given subject in
     * exactly 2 DB round-trips (one for all claims, one for all source mappings).
     *
     * Designed for the master page initial load where calling getAuthoritativeValue /
     * getAuthoritativeCollection per-field produces an N+1 waterfall (258 queries
     * for 129 fields).
     *
     * Returns a Map keyed by fieldNo:
     *   - null              → no data for that field
     *   - DerivedValue      → winning single-value claim
     *   - DerivedValue[]    → resolved collection (may be empty [])
     *
     * The resolution logic is identical to getAuthoritativeValue /
     * getAuthoritativeCollection — same tier model, same priority map, same
     * tombstone rules, same effectiveTo filter.
     */
    static async resolveAllFields(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string; clientLEId?: string },
        fieldDefs: Array<{
            fieldNo: number;
            isMultiValue: boolean;
            /** When set, only claims with this collectionId are used — excludes legacy TEXT claims. */
            collectionId?: string;
        }>,
        ownerScopeId?: string
    ): Promise<Map<number, DerivedValue | DerivedValue[] | null>> {
        const result = new Map<number, DerivedValue | DerivedValue[] | null>();
        if (fieldDefs.length === 0) return result;

        const fieldNos = fieldDefs.map(d => d.fieldNo);

        // ── Round-trip 1: all claims for all fields ────────────────────────────
        const { clientLEId, ...subjectFilter } = subject;
        const allClaims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo: { in: Array.from(fieldNos) },
                ...subjectFilter,
                status: { in: [ClaimStatus.VERIFIED, ClaimStatus.ASSERTED] },
                OR: [
                    { ownerScopeId: ownerScopeId || undefined },
                    { ownerScopeId: null },
                ],
            },
            orderBy: [{ assertedAt: 'desc' }, { id: 'desc' }],
        });

        // ── Round-trip 2: all active source mappings for all fields ────────────
        const allMappingRows = await (prisma as any).sourceFieldMapping.findMany({
            where: { targetFieldNo: { in: fieldNos }, isActive: true },
            select: { targetFieldNo: true, sourceType: true, sourceReference: true, priority: true },
        }) as Array<{ targetFieldNo: number; sourceType: string; sourceReference: string | null; priority: number }>;

        // ── Build per-field priority maps (in memory) ─────────────────────────
        const priorityMapByField = new Map<number, SourcePriorityMap>();
        for (const fieldNo of fieldNos) {
            const scoped  = new Map<string, number>();
            const generic = new Map<string, number>();
            for (const row of allMappingRows) {
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
            priorityMapByField.set(fieldNo, pm);
        }

        // ── Group claims by fieldNo (in memory) ───────────────────────────────
        const claimsByField = new Map<number, FieldClaim[]>();
        for (const claim of allClaims) {
            const list = claimsByField.get(claim.fieldNo) ?? [];
            list.push(claim);
            claimsByField.set(claim.fieldNo, list);
        }

        // ── Resolve each field in memory ──────────────────────────────────────
        const now = new Date();
        let provenanceMap = null;
        if (subject.clientLEId) {
            provenanceMap = await fetchProvenanceMap({ clientLEId: subject.clientLEId });
        }

        for (const def of fieldDefs) {
            // Filter to the named collection when specified — excludes legacy
            // plain-text claims (collectionId = NULL) that predate the structured
            // collection architecture.
            const rawClaims = claimsByField.get(def.fieldNo) ?? [];
            // The collectionId filter excludes legacy plain-text claims (collectionId=NULL)
            // that predate the structured collection architecture.
            // Only apply this filter for multi-value (collection) fields — for single-value
            // fields the filter is meaningless and would exclude valid claims written while
            // isMultiValue was incorrectly set to false in the DB (e.g. SIC code backfills).
            const claims = (def.isMultiValue && def.collectionId)
                ? rawClaims.filter(c => c.collectionId === def.collectionId)
                : rawClaims;
            const priorityMap = priorityMapByField.get(def.fieldNo) ?? new Map();

            if (def.isMultiValue) {
                // Group by (collectionId, instanceId) — mirrors getAuthoritativeCollection
                const itemGroups: Record<string, FieldClaim[]> = {};
                for (const c of claims) {
                    const key = `${c.collectionId ?? 'default'}:${c.instanceId ?? 'default'}`;
                    if (!itemGroups[key]) itemGroups[key] = [];
                    itemGroups[key].push(c);
                }

                const collection: DerivedValue[] = [];
                for (const group of Object.values(itemGroups)) {
                    const winner = this.pickWinner(group, ownerScopeId, priorityMap);
                    if (winner && !this.isTombstone(winner)) {
                        const derived = this.mapToDerivedValue(winner, ownerScopeId);
                        if (provenanceMap) {
                            const resolvedCheckedAt = resolveSourceCheckedAt(
                                derived.sourceType || derived.evidenceProvider,
                                derived.sourceReference,
                                derived.assertedAt,
                                provenanceMap
                            );
                            if (resolvedCheckedAt) derived.sourceCheckedAt = resolvedCheckedAt;
                        }
                        collection.push(derived);
                    }
                }

                // Effective-date post-filter (mirrors getAuthoritativeCollection)
                const config = COLLECTION_FIELD_CONFIG[def.fieldNo];
                const filtered = config?.filterByEffectiveDate
                    ? collection.filter(row => !row.effectiveTo || row.effectiveTo > now)
                    : collection;

                result.set(def.fieldNo, filtered);
            } else {
                const winner = this.pickWinner(claims, ownerScopeId, priorityMap);
                if (!winner || this.isTombstone(winner)) {
                    result.set(def.fieldNo, null);
                } else {
                    const derived = this.mapToDerivedValue(winner, ownerScopeId);
                    if (provenanceMap) {
                        const resolvedCheckedAt = resolveSourceCheckedAt(
                            derived.sourceType || derived.evidenceProvider,
                            derived.sourceReference,
                            derived.assertedAt,
                            provenanceMap
                        );
                        if (resolvedCheckedAt) derived.sourceCheckedAt = resolvedCheckedAt;
                    }
                    result.set(def.fieldNo, derived);
                }
            }
        }

        return result;
    }

    /**
     * The Selection Hierarchy / Comparison Set Rule:
     *
     * Tier model (unchanged):
     *   1. VERIFIED Scoped
     *   2. ASSERTED Scoped
     *   3. VERIFIED Baseline (ownerScopeId IS NULL)
     *   4. ASSERTED Baseline
     *
     * Within each tier, claims are ordered by:
     *   1. Tombstone (deletion wins within tier)
     *   2. USER_INPUT source (always wins over automated sources within tier)
     *   3. SourceFieldMapping.priority ASC (lower number = higher authority)
     *      — resolved via priorityMap; scoped match preferred over generic
     *   4. assertedAt DESC (newest claim wins on tie)
     *   5. id DESC (final stable tie-breaker)
     *
     * @param claims       Claims to consider (already filtered by fieldNo + subject)
     * @param requestedScopeId  The owner scope for tier filtering
     * @param priorityMap  Pre-loaded mapping priorities (see preloadMappingPriorities)
     *
     * Visibility: `static` (not private) so resolveMasterDataBatch can call it
     * with pre-loaded data without duplicating the tier/priority logic.
     */
    static pickWinner(
        claims: FieldClaim[],
        requestedScopeId?: string,
        priorityMap: SourcePriorityMap = new Map()
    ): FieldClaim | null {

        /**
         * Resolve the effective priority for a single claim.
         *
         * USER_INPUT gets priority 0 so it always wins over automated sources
         * within the same tier, regardless of any mapping configuration.
         *
         * For automated sources:
         *   1. Try exact key  (sourceType + sourceReference)
         *   2. Fall back to generic key (sourceType + null)
         *   3. Use FALLBACK_SOURCE_PRIORITIES with a warning
         */
        const resolvePriority = (claim: FieldClaim): number => {
            if (claim.sourceType === 'USER_INPUT') return USER_INPUT_PRIORITY;

            // 1. Exact / scoped match
            const exactKey = priorityKey(claim.sourceType, claim.sourceReference);
            const exactPriority = priorityMap.get(exactKey);
            if (exactPriority !== undefined) return exactPriority;

            // 2. Generic null-ref fallback (e.g. claim from RA000585 falls back
            //    to the generic REGISTRATION_AUTHORITY/null mapping if no scoped row)
            if (claim.sourceReference !== null) {
                const genericKey = priorityKey(claim.sourceType, null);
                const genericPriority = priorityMap.get(genericKey);
                if (genericPriority !== undefined) return genericPriority;
            }

            // 3. No mapping found — use central fallback table
            const fallback = getFallbackPriority(claim.sourceType);
            return fallback;
        };

        const sortAndPick = (list: FieldClaim[]): FieldClaim | null => {
            if (list.length === 0) return null;
            return list.sort((a: any, b: any) => {
                const isTombA = this.isTombstone(a);
                const isTombB = this.isTombstone(b);

                if (isTombA !== isTombB) {
                    // Special case: USER_INPUT vs USER_INPUT — most recent action wins.
                    // This enables re-add after tombstone: a newer USER_INPUT value claim
                    // should supersede an older USER_INPUT tombstone for the same instanceId.
                    if (a.sourceType === 'USER_INPUT' && b.sourceType === 'USER_INPUT') {
                        const tA = a.assertedAt.getTime();
                        const tB = b.assertedAt.getTime();
                        if (tA !== tB) return tB - tA; // most recent wins
                        // Same timestamp: tombstone wins (explicit deletion intent)
                        return isTombA ? -1 : 1;
                    }
                    
                    // Safety fix: automated tombstone loses to USER_INPUT value
                    if (isTombA && a.sourceType !== 'USER_INPUT' && b.sourceType === 'USER_INPUT') return 1;
                    if (isTombB && b.sourceType !== 'USER_INPUT' && a.sourceType === 'USER_INPUT') return -1;

                    // Cross-source: tombstone (user exclusion) always beats registry value
                    return isTombA ? -1 : 1;
                }

                // Mapping-driven source priority (lower number = higher authority)
                const pA = resolvePriority(a);
                const pB = resolvePriority(b);
                if (pA !== pB) return pA - pB;

                // assertedAt DESC
                const tA = a.assertedAt.getTime();
                const tB = b.assertedAt.getTime();
                if (tA !== tB) return tB - tA;

                // ID tie-breaker
                return b.id.localeCompare(a.id);
            })[0];
        };


        // Tier 1: VERIFIED Scoped
        if (requestedScopeId) {
            const verifiedScoped = claims.filter((c: any) => c.status === ClaimStatus.VERIFIED && c.ownerScopeId === requestedScopeId);
            const winner = sortAndPick(verifiedScoped);
            if (winner) return winner;
        }

        // Tier 2: ASSERTED Scoped
        if (requestedScopeId) {
            const assertedScoped = claims.filter((c: any) => c.status === ClaimStatus.ASSERTED && c.ownerScopeId === requestedScopeId);
            const winner = sortAndPick(assertedScoped);
            if (winner) return winner;
        }

        // Tier 3: VERIFIED Baseline
        const verifiedBaseline = claims.filter((c: any) => c.status === ClaimStatus.VERIFIED && c.ownerScopeId === null);
        const winnerV = sortAndPick(verifiedBaseline);
        if (winnerV) return winnerV;

        // Tier 4: ASSERTED Baseline
        const assertedBaseline = claims.filter((c: any) => c.status === ClaimStatus.ASSERTED && c.ownerScopeId === null);
        return sortAndPick(assertedBaseline);
    }

    /** Exported so resolveMasterDataBatch can detect tombstones without duplicating logic. */
    static isTombstone(claim: FieldClaim): boolean {
        // A tombstone is defined as a claim where valueJson is { "tombstone": true }
        // or all value fields are null (if we want to be more liberal).
        // For Phase 2.5, let's use the explicit JSON flag.
        if (claim.valueJson && typeof claim.valueJson === 'object') {
            const val = claim.valueJson as Record<string, any>;
            return val.tombstone === true;
        }
        return false;
    }

    /** Exported so resolveMasterDataBatch can map winners to DerivedValue without duplicating logic. */
    static mapToDerivedValue(claim: FieldClaim, requestedScopeId?: string): DerivedValue {
        const value = claim.valueText ??
            claim.valueNumber ??
            claim.valueDate ??
            claim.valueJson ??
            (claim as any).valueAddress ??
            (claim as any).valuePerson ??
            (claim as any).valueLe ??
            (claim as any).valueOrg ??
            claim.valueDocId;

        return {
            value,
            claimId: claim.id,
            status: claim.status,
            isScoped: claim.ownerScopeId === requestedScopeId && !!requestedScopeId,
            sourceType: claim.sourceType,
            sourceReference: claim.sourceReference ?? undefined,
            evidenceProvider: (claim as any).evidence?.provider ?? undefined,
            confidenceScore: claim.confidenceScore ?? undefined,
            evidenceId: claim.evidenceId ?? undefined,
            instanceId: claim.instanceId ?? undefined,
            collectionId: claim.collectionId ?? undefined,
            assertedAt: claim.assertedAt,
            effectiveFrom: claim.effectiveFrom ?? undefined,
            effectiveTo: claim.effectiveTo ?? undefined,
        };
    }
}
