import prisma from "@/lib/prisma";
import { ClaimStatus, FieldClaim, Prisma } from "@prisma/client";
import { COLLECTION_FIELD_CONFIG } from "./collection-field-config";
import { getFallbackPriority, USER_INPUT_PRIORITY } from "./source-priority-config";

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
};

// ── Priority resolution ───────────────────────────────────────────────────────

/**
 * Map keyed by "sourceType:sourceReference" where null sourceReference is
 * represented as the literal string "__null__".
 * Value is the lowest active SourceFieldMapping.priority for that source.
 */
type SourcePriorityMap = Map<string, number>;

/** Build the map key for a (sourceType, sourceReference) pair. */
function priorityKey(sourceType: string, sourceReference: string | null): string {
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
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string },
        fieldNo: number,
        ownerScopeId?: string,
        snapshotDate?: Date
    ): Promise<DerivedValue | null> {
        // Comparison Set: (subject, fieldNo, ownerScopeId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo,
                ...subject,
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

        return this.mapToDerivedValue(winner, ownerScopeId);
    }

    /**
     * Derives a collection of values for a repeating field.
     */
    static async getAuthoritativeCollection(
        subject: { subjectLeId?: string; subjectPersonId?: string; subjectOrgId?: string },
        fieldNo: number,
        ownerScopeId?: string,
        snapshotDate?: Date
    ): Promise<DerivedValue[]> {
        // Multi-value Comparison Set: (subject, fieldNo, ownerScopeId, collectionId, instanceId)
        const claims = await prisma.fieldClaim.findMany({
            include: { evidence: true, valueAddress: true, valuePerson: true, valueLe: true, valueOrg: true },
            where: {
                fieldNo,
                ...subject,
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
        for (const key in itemGroups) {
            const winner = this.pickWinner(itemGroups[key], ownerScopeId, priorityMap);
            if (winner && !this.isTombstone(winner)) {
                results.push(this.mapToDerivedValue(winner, ownerScopeId));
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
     */
    private static pickWinner(
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

            // 3. No mapping found — use central fallback table and warn
            const fallback = getFallbackPriority(claim.sourceType);
            console.warn(
                `[KycStateService] No active SourceFieldMapping found for ` +
                `sourceType=${claim.sourceType}, sourceReference=${claim.sourceReference ?? 'null'}, ` +
                `fieldNo=${claim.fieldNo}. Using fallback priority=${fallback}.`
            );
            return fallback;
        };

        const sortAndPick = (list: FieldClaim[]): FieldClaim | null => {
            if (list.length === 0) return null;
            return list.sort((a: any, b: any) => {
                // Tombstone priority: a deletion should always win over a value within the same tier
                const isTombA = this.isTombstone(a);
                const isTombB = this.isTombstone(b);
                if (isTombA !== isTombB) return isTombA ? -1 : 1;

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

    private static isTombstone(claim: FieldClaim): boolean {
        // A tombstone is defined as a claim where valueJson is { "tombstone": true }
        // or all value fields are null (if we want to be more liberal).
        // For Phase 2.5, let's use the explicit JSON flag.
        if (claim.valueJson && typeof claim.valueJson === 'object') {
            const val = claim.valueJson as Record<string, any>;
            return val.tombstone === true;
        }
        return false;
    }

    private static mapToDerivedValue(claim: FieldClaim, requestedScopeId?: string): DerivedValue {
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
