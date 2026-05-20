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
}

/**
 * Simple collection fields not covered by COMPLEX_FIELD_CONFIG.
 * Field 63 is intentionally absent — it is derived from complex-field-config.ts.
 */
const STATIC_COLLECTION_CONFIG: Record<number, CollectionFieldConfig> = {
    // Stakeholder collections (FieldDefinitions fields 62 / 64)
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
    const complexFieldNos: number[] = [5, 63];

    for (const fieldNo of complexFieldNos) {
        const derived = deriveCollectionConfig(fieldNo);
        if (derived) {
            result[fieldNo] = derived;
        }
    }

    return result;
}

export const COLLECTION_FIELD_CONFIG: Record<number, CollectionFieldConfig> =
    buildCollectionFieldConfig();
