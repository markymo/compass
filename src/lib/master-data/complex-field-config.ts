/**
 * complex-field-config.ts
 *
 * Code-level registry for Master Data fields whose type cannot be expressed
 * as a simple scalar or flat reference. These are fields where the UI needs
 * to understand graph/relationship semantics, temporal filtering, and
 * collection grouping — without those concepts existing in the DB schema yet.
 *
 * ── Design principles ────────────────────────────────────────────────────────
 * 1. NO schema migration required. Config lives here, callers stay unchanged.
 * 2. COLLECTION_FIELD_CONFIG (collection-field-config.ts) is derived from this
 *    file — no duplication.
 * 3. Per field only. Do NOT generalise into a UI builder yet.
 * 4. When these concepts graduate to DB columns, this file becomes a thin
 *    compatibility shim and can be deleted without changing callers.
 *
 * ── Slice 1 (2026-05-20) ────────────────────────────────────────────────────
 * Field 63: List of company directors (Current Directors)
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── Kind discriminant ─────────────────────────────────────────────────────────

/**
 * GRAPH_RELATIONSHIP_COLLECTION
 *   A repeating set of person/party relationships, each scoped to an edge in
 *   the LE graph. Members have temporal start/end dates. "Current" means
 *   effectiveTo is null or in the future. History is preserved in FieldClaims.
 *
 * STRUCTURED_COLLECTION (future)
 *   A repeating set of structured value objects (e.g. Previous Names: name +
 *   fromDate + toDate). No graph edge required — stored purely as FieldClaims
 *   with collectionId + instanceId.
 */
export type ComplexFieldKind =
    | 'GRAPH_RELATIONSHIP_COLLECTION'
    | 'STRUCTURED_COLLECTION';

// ── Config shape ──────────────────────────────────────────────────────────────

export interface GraphRelationshipCollectionConfig {
    kind: 'GRAPH_RELATIONSHIP_COLLECTION';

    /** Human-readable label shown in the admin UI. */
    label: string;

    /** Longer description shown in the admin UI info panel. */
    description: string;

    /**
     * Stable collectionId written to FieldClaim.collectionId.
     * Used as the grouping key in KycStateService.getAuthoritativeCollection().
     */
    collectionId: string;

    /**
     * The appDataType stored in MasterFieldDefinition.
     * Must match the actual DB value — used for routing in KycWriteService.
     */
    appDataType: string;

    /** Always true for collection fields. */
    isMultiValue: true;

    /** The semantic item type (for UI labelling and future routing). */
    itemType: 'PARTY_RELATIONSHIP';

    /** Graph node and edge configuration. */
    graph: {
        /**
         * Primary node type expected in the LE graph.
         * For PARTY_RELATIONSHIP fields this may be PERSON or LEGAL_ENTITY
         * depending on the individual item — the nodeType here records the
         * predominant/expected type for UI display purposes.
         */
        nodeType: 'PERSON' | 'LEGAL_ENTITY' | 'ADDRESS' | 'PERSON_OR_LEGAL_ENTITY';
        /** Edge type used to query and write graph edges. */
        edgeType: string;
        /** When true, graph queries filter to isActive = true edges only. */
        filterActiveOnly: boolean;
        /** Edge type written back to the graph when a member is confirmed/updated. */
        writeBackEdgeType: string;
    };

    /** Temporal (effective-date) configuration. */
    temporal: {
        /** When true, KycStateService filters out rows where effectiveTo has passed. */
        filterByEffectiveDate: true;
        /** UI label for the start-of-relationship field. */
        effectiveFromLabel: string;
        /** UI label for the end-of-relationship field. */
        effectiveToLabel: string;
    };

    /** Documents which source transforms produce data for this field. */
    sourceTransforms: {
        /** Human-readable source name for display. */
        source: string;
        /** The transform type used in SourceFieldMapping. */
        transformType: string;
        /** Optional description of what this source provides. */
        description?: string;
    }[];
}

export interface StructuredCollectionConfig {
    kind: 'STRUCTURED_COLLECTION';
    label: string;
    description: string;
    collectionId: string;
    appDataType: string;
    isMultiValue: true;
    itemType: 'STRUCTURED_VALUE';
    fields: {
        key: string;
        label: string;
        dataType: 'TEXT' | 'DATETIME' | 'BOOLEAN';
        required?: boolean;
        isTemporal?: boolean; // true for effectiveFrom/effectiveTo-style date fields
    }[];
    temporal?: {
        filterByEffectiveDate: boolean;
        effectiveFromKey: string;
        effectiveToKey: string;
    };
}

export type ComplexFieldConfig =
    | GraphRelationshipCollectionConfig
    | StructuredCollectionConfig;

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * COMPLEX_FIELD_CONFIG
 *
 * Keys are MasterFieldDefinition.fieldNo values.
 * Only fields that require complex/structured handling are listed here.
 * Simple scalar fields (TEXT, DATETIME, etc.) are not registered.
 */
export const COMPLEX_FIELD_CONFIG = {

    /**
     * Field 63: List of company directors
     * Slice 1 — first complex field registered.
     *
     * Semantics: each director is a Person node in the LE graph, linked
     * via a DIRECTOR edge. "Current" directors are those where the edge
     * isActive=true, or where the FieldClaim.effectiveTo is null/future.
     *
     * Source: Companies House OFFICERS payload via TO_PARTY_LIST transform.
     * The transform produces one FieldCandidate per officer item, with
     * effectiveFrom = appointedOn and effectiveTo = resignedOn.
     */
    63: {
        kind: 'GRAPH_RELATIONSHIP_COLLECTION',
        label: 'Current Directors',
        description:
            'Current director relationships for this legal entity. ' +
            'Derived from Companies House officer records and projected into the graph. ' +
            'Historical (resigned) directors are retained in the audit trail.',
        collectionId: 'DIRECTORS',

        /**
         * appDataType: PARTY_REF — not PERSON_REF.
         *
         * A director can be either a natural person (individual) or a corporate
         * entity. UK company law explicitly permits corporate directors, and CH
         * returns both in its officers array with a `kind` discriminant
         * ("individual" vs "corporate-entity"). PARTY_REF is the correct type
         * because it covers both Person and LegalEntity nodes, whereas
         * PERSON_REF is strictly individuals.
         *
         * NOTE: The production DB currently stores 'PERSON_REF' for fields 62–64
         * (from the 2026-05-19 inventory). That is a pre-existing mismatch that
         * predates this registry. The DB value should be migrated to 'PARTY_REF'
         * in a future additive migration. Until then, KycWriteService must
         * handle both values when routing directors.
         */
        appDataType: 'PARTY_REF',

        isMultiValue: true,
        itemType: 'PARTY_RELATIONSHIP',
        graph: {
            /**
             * nodeType PERSON_OR_LEGAL_ENTITY reflects that CH officers may be
             * natural persons OR corporate entities. The write path discriminates
             * on the CH `kind` field; the UI should show person fields for
             * individuals and org fields for corporate directors.
             */
            nodeType: 'PERSON_OR_LEGAL_ENTITY',
            edgeType: 'DIRECTOR',
            filterActiveOnly: true,
            writeBackEdgeType: 'DIRECTOR',
        },
        temporal: {
            filterByEffectiveDate: true,
            effectiveFromLabel: 'Appointed',
            effectiveToLabel: 'Resigned',
        },
        sourceTransforms: [
            {
                source: 'Companies House',
                transformType: 'TO_PARTY_LIST',
                description: 'Ingests the officers array from the CH API. Each officer becomes one director row. Individual officers produce Person nodes; corporate officers produce LegalEntity nodes.',
            },
        ],
    } satisfies GraphRelationshipCollectionConfig,

} as const;

// ── Type helpers ──────────────────────────────────────────────────────────────

export type ComplexFieldNo = keyof typeof COMPLEX_FIELD_CONFIG;

/** Returns the complex field config for a fieldNo, or undefined if it is a simple field. */
export function getComplexFieldConfig(fieldNo: number): ComplexFieldConfig | undefined {
    return (COMPLEX_FIELD_CONFIG as Record<number, ComplexFieldConfig>)[fieldNo];
}

/** Returns true if fieldNo is registered as a complex field. */
export function isComplexField(fieldNo: number): boolean {
    return fieldNo in COMPLEX_FIELD_CONFIG;
}

/**
 * Returns a user-facing "Field Type" label for display in the admin UI.
 *
 * For complex fields, returns the config label (e.g. "Current Directors").
 * For simple fields, returns a readable version of the appDataType string.
 */
export function getFieldTypeLabel(fieldNo: number, appDataType: string): string {
    const complex = getComplexFieldConfig(fieldNo);
    if (complex) return complex.label;

    const labels: Record<string, string> = {
        TEXT:         'Text',
        NUMBER:       'Number',
        BOOLEAN:      'Boolean (Yes/No)',
        DATETIME:     'Date / DateTime',
        JSONB:        'JSON',
        SELECT:       'Dropdown Selection',
        PERSON_REF:   'Person Reference',
        PARTY_REF:    'Party Reference',
        ORG_REF:      'Organisation Reference',
        DOCUMENT_REF: 'Document Reference',
        ADDRESS_REF:  'Address Reference',
    };
    return labels[appDataType] ?? appDataType;
}

/**
 * Returns a secondary description for the field type — shown below the label
 * in collapsed/secondary UI areas.
 */
export function getFieldTypeDescription(fieldNo: number, appDataType: string): string | undefined {
    const complex = getComplexFieldConfig(fieldNo);
    if (complex) return complex.description;
    return undefined;
}

// ── Derived CollectionFieldConfig (consumed by KycStateService) ───────────────
//
// COLLECTION_FIELD_CONFIG in collection-field-config.ts now imports this
// function to avoid duplicating Field 63's config. This is the single source
// of truth for filterByEffectiveDate semantics.

export function deriveCollectionConfig(fieldNo: number): { collectionId: string; filterByEffectiveDate: boolean } | undefined {
    const cfg = getComplexFieldConfig(fieldNo);
    if (!cfg) return undefined;

    const filterByEffectiveDate =
        'temporal' in cfg && cfg.temporal
            ? cfg.temporal.filterByEffectiveDate
            : false;

    return { collectionId: cfg.collectionId, filterByEffectiveDate };
}
