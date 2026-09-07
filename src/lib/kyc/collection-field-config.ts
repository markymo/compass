/**
 * collection-field-config.ts
 *
 * Zero-migration V1 configuration for repeating collection fields.
 *
 * Each entry defines how KycStateService.getAuthoritativeCollection() should
 * evaluate the "current" result set for that field.
 *
 * ── Source of truth ──────────────────────────────────────────────────────────
 * Complex fields (those with graph/relationship semantics) are defined in:
 *   src/lib/master-data/complex-field-config.ts
 *
 * This file DERIVES their collectionId / filterByEffectiveDate from there so
 * that KycStateService doesn't need to know about complex-field-config.ts
 * directly. If a field is registered in COMPLEX_FIELD_CONFIG, its entry here
 * is auto-derived. Simple collection fields with no complex config can still
 * be listed directly in STATIC_COLLECTION_CONFIG below.
 *
 * V1 CONVENTION:
 *   - filterByEffectiveDate: true  → only return rows where effectiveTo IS NULL
 *     or effectiveTo > evaluationDate. Used for "current" views (e.g. Current
 *     Directors, Current UBOs). Historical claims with effectiveTo set are
 *     preserved in the database and accessible via snapshotDate queries.
 *
 * FUTURE MIGRATION PATH:
 *   This config may later be promoted into the database as columns on
 *   MasterFieldDefinition or MasterFieldGraphBinding. When that happens, this
 *   file becomes a thin compatibility shim or is deleted, and the calling code
 *   switches to a DB lookup. No callers need to change their interface.
 *
 * ALL isMultiValue fields with temporal relationship semantics should be
 * registered here (directly or via COMPLEX_FIELD_CONFIG). If a field is not
 * listed, getAuthoritativeCollection() returns all non-tombstoned winners
 * without date filtering.
 */

import { deriveCollectionConfig } from '@/lib/master-data/complex-field-config';

export interface CollectionFieldConfig {
    /**
     * The stable collectionId string written to FieldClaim.collectionId.
     * Used as the grouping key in KycStateService.getAuthoritativeCollection().
     */
    collectionId: string;

    /**
     * When true, getAuthoritativeCollection() applies an effectiveTo post-filter:
     * rows where effectiveTo IS NOT NULL AND effectiveTo <= evaluationDate are
     * excluded from the result.
     *
     * Set to false for "all-time history" collection fields.
     */
    filterByEffectiveDate: boolean;

    /**
     * Optional custom collection claim partitioner.
     * When provided, KycStateService uses this to group competing claims for
     * winner selection instead of standard collectionId:instanceId grouping.
     */
    groupClaims?: (claims: any[]) => Record<string, any[]>;
}

/**
 * Semantic reconciliation partitioner for Field 5 (NAME_HISTORY).
 *
 * Rules:
 *  1. Group claims by normalized previous legal name.
 *  2. Within a name, distinguish genuinely separate historical date periods
 *     (e.g., from_2000_to_2005 vs from_2010_to_2015).
 *  3. Undated claims (such as GLEIF otherNames where dates are absent) merge into
 *     the dated period group (or default undated group) so higher-priority
 *     dated claims (e.g. Companies House) cleanly supersede them without creating duplicates.
 */
export function groupNameHistoryClaims(claims: any[]): Record<string, any[]> {
    const byName: Record<string, any[]> = {};
    for (const c of claims) {
        const val = c.valueJson;
        const rawName = (val && typeof val === 'object' && val.name) ? val.name : (c.valueText || '');
        const normName = String(rawName).trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const nameKey = normName || (c.instanceId || 'unknown');
        if (!byName[nameKey]) byName[nameKey] = [];
        byName[nameKey].push(c);
    }

    const itemGroups: Record<string, any[]> = {};

    for (const nameKey in byName) {
        const nameClaims = byName[nameKey];

        const datedClaims: any[] = [];
        const undatedClaims: any[] = [];

        for (const c of nameClaims) {
            const from = c.effectiveFrom
                ? (c.effectiveFrom instanceof Date ? c.effectiveFrom.toISOString().slice(0, 10) : String(c.effectiveFrom).slice(0, 10))
                : (c.valueJson?.effectiveFrom ? String(c.valueJson.effectiveFrom).slice(0, 10) : null);
            const to = c.effectiveTo
                ? (c.effectiveTo instanceof Date ? c.effectiveTo.toISOString().slice(0, 10) : String(c.effectiveTo).slice(0, 10))
                : (c.valueJson?.effectiveTo ? String(c.valueJson.effectiveTo).slice(0, 10) : null);

            if (from || to) {
                datedClaims.push({ claim: c, from, to });
            } else {
                undatedClaims.push(c);
            }
        }

        if (datedClaims.length === 0) {
            // All claims for this name lack dates; group them together under the normalized name
            const groupKey = `NAME_HISTORY:${nameKey}:undated`;
            itemGroups[groupKey] = undatedClaims;
        } else {
            // Partition by distinct historical date period
            const periodMap: Record<string, any[]> = {};
            for (const item of datedClaims) {
                const pKey = `from_${item.from || 'none'}_to_${item.to || 'none'}`;
                if (!periodMap[pKey]) periodMap[pKey] = [];
                periodMap[pKey].push(item.claim);
            }

            const periodKeys = Object.keys(periodMap);
            for (const pKey of periodKeys) {
                const groupKey = `NAME_HISTORY:${nameKey}:${pKey}`;
                itemGroups[groupKey] = periodMap[pKey];
            }

            // Undated claims (e.g. from GLEIF) merge into the first/primary dated period group
            // to allow source priority to supersede rather than emitting duplicate rows
            if (undatedClaims.length > 0) {
                const primaryGroupKey = `NAME_HISTORY:${nameKey}:${periodKeys[0]}`;
                itemGroups[primaryGroupKey].push(...undatedClaims);
            }
        }
    }

    return itemGroups;
}

/**
 * Simple collection fields not covered by COMPLEX_FIELD_CONFIG.
 * Field 63 is intentionally absent — it is derived from complex-field-config.ts.
 */
const STATIC_COLLECTION_CONFIG: Record<number, CollectionFieldConfig> = {
    // Stakeholder collections (fields 62 / 64)
    // Field 20 (SIC codes) and Field 5 (Previous names) and Field 63 (Directors)
    // are all derived from COMPLEX_FIELD_CONFIG below — do not duplicate here.
    62: { collectionId: 'UBOS',  filterByEffectiveDate: true  }, // List of ultimate beneficial owners
    64: { collectionId: 'PSCS', filterByEffectiveDate: true  }, // List of persons controlling
};


/**
 * COLLECTION_FIELD_CONFIG
 *
 * Merged map of static entries + entries derived from COMPLEX_FIELD_CONFIG.
 * KycStateService imports this — its interface is unchanged.
 *
 * Complex-field entries are derived at module-load time so there is no
 * runtime cost and no circular dependency risk (complex-field-config.ts
 * does not import from this file).
 */
function buildCollectionFieldConfig(): Record<number, CollectionFieldConfig> {
    const result: Record<number, CollectionFieldConfig> = { ...STATIC_COLLECTION_CONFIG };

    // Auto-derive entries from COMPLEX_FIELD_CONFIG.
    // Add fieldNo values here as new complex fields are registered.
    const complexFieldNos: number[] = [5, 20, 63];

    for (const fieldNo of complexFieldNos) {
        const derived = deriveCollectionConfig(fieldNo);
        if (derived) {
            result[fieldNo] = {
                ...derived,
                groupClaims: fieldNo === 5 ? groupNameHistoryClaims : undefined,
            };
        }
    }

    return result;
}

export const COLLECTION_FIELD_CONFIG: Record<number, CollectionFieldConfig> =
    buildCollectionFieldConfig();
