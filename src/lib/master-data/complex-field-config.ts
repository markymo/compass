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
        filterByEffectiveDate: boolean;
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
    itemType: 'STRUCTURED_VALUE' | 'NAME_HISTORY_ENTRY';
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
    /**
     * When set, this collection is a controlled vocabulary.
     * Value is a key in CODE_SYSTEMS (code-systems.ts).
     *
     * Drives:
     *   - CodeListField UX in FieldDetailPanel (replaces free-text input)
     *   - addCodeListEntry server-side validation
     *   - getFieldDetail codeSystem passthrough to the client
     *
     * When absent, the collection uses the generic structured-value editing UX.
     */
    codeSystem?: string;
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
     * Field 5: Previous Names
     * Slice 2 — first STRUCTURED_COLLECTION field.
     *
     * Each previous name becomes a separate FieldClaim row:
     *   fieldNo      = 5
     *   collectionId = NAME_HISTORY
     *   instanceId   = stable rowKey (name_{normalised}_{effectiveFrom|unknown})
     *   valueJson    = { name, effectiveFrom?, effectiveTo?, nameType? }
     *   effectiveFrom / effectiveTo carried through from the source
     *
     * Sources:
     *   - Companies House: previous_company_names[]
     *     ceased_on → effectiveTo, effective_from → effectiveFrom
     *   - GLEIF: entity.otherNames[] (dates typically absent)
     *
     * NOT graph-backed. No Person/Address nodes created.
     * filterByEffectiveDate = false — all historical names are retained and
     * shown; the UI is responsible for visual distinction of active vs past.
     */
    5: {
        kind: 'STRUCTURED_COLLECTION',
        label: 'Previous Names',
        description:
            'Previous, alternate, trading, or source-specific names used by this legal entity. ' +
            'Each entry is stored as a separate row so the full history is preserved.',
        collectionId: 'NAME_HISTORY',
        appDataType: 'JSONB',
        isMultiValue: true,
        itemType: 'NAME_HISTORY_ENTRY',
        fields: [
            { key: 'name',          label: 'Name',      dataType: 'TEXT',     required: true  },
            { key: 'effectiveFrom', label: 'From',      dataType: 'DATETIME', required: false },
            { key: 'effectiveTo',   label: 'To',        dataType: 'DATETIME', required: false },
            { key: 'nameType',      label: 'Name type', dataType: 'TEXT',     required: false },
        ],
        temporal: {
            filterByEffectiveDate: false, // show all historical names, not just "current" ones
            effectiveFromKey: 'effectiveFrom',
            effectiveToKey:   'effectiveTo',
        },
    } satisfies StructuredCollectionConfig,

    /**
     * Field 20: Industry classification (SIC codes)
     *
     * One FieldClaim per SIC code assigned to this entity.
     *   fieldNo      = 20
     *   collectionId = SIC_CODES
     *   instanceId   = sic_{code}  (e.g. sic_35110)
     *   valueJson    = { code: string, label: string | null }
     *
     * Source: Companies House sic_codes[] via TO_CODE_LIST transform.
     * Reference data: sic_codes.json (UK SIC 2007, 732 entries).
     *
     * NOT graph-backed. No Person/Address nodes created.
     * No temporal date-ranging — SIC code assignments have no effectiveTo.
     * Re-enrichment replaces claims via instanceId idempotency.
     *
     * Future: extend TO_CODE_LIST with codeSystem config to support
     * NAF (France) and WZ (Germany) activity codes on the same field.
     */
    20: {
        kind: 'STRUCTURED_COLLECTION',
        label: 'Industry classification',
        description:
            'Industry classification codes (UK SIC 2007) assigned to this entity. ' +
            'Each code is stored as a separate row with its human-readable description. ' +
            'Source: Companies House sic_codes field.',
        collectionId: 'SIC_CODES',
        appDataType: 'JSONB',
        isMultiValue: true,
        itemType: 'STRUCTURED_VALUE',
        fields: [
            { key: 'code',  label: 'SIC code',    dataType: 'TEXT', required: true  },
            { key: 'label', label: 'Description', dataType: 'TEXT', required: false },
        ],
        // Controlled vocabulary — drives CodeListField UX and addCodeListEntry validation.
        codeSystem: 'SIC_2007_UK',
        // No temporal config — codes are not date-ranged.
    } satisfies StructuredCollectionConfig,

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
        kind: 'STRUCTURED_COLLECTION',
        label: 'Current Directors',
        description:
            'Current director records for this legal entity. ' +
            'Derived from Companies House officer records and stored as embedded JSON values.',
        collectionId: 'DIRECTORS',
        appDataType: 'PERSON_OR_CONTACT',
        isMultiValue: true,
        itemType: 'STRUCTURED_VALUE',
        fields: [
            { key: 'forenames', label: 'Forenames', dataType: 'TEXT', required: false },
            { key: 'surname',   label: 'Surname',   dataType: 'TEXT', required: false },
        ],
        temporal: {
            filterByEffectiveDate: true,
            effectiveFromKey: 'appointedOn',
            effectiveToKey:   'resignedOn',
        },
    } satisfies StructuredCollectionConfig,

    /**
     * Field 125: Named Signatories
     *
     * Persons authorised to sign on behalf of this legal entity.
     * Each Named Signatory is a Person node in the LE graph, linked via a
     * NAMED_SIGNATORY edge. This is a purely user-curated field — there is
     * no automated registry source for signatories.
     *
     * Stored as:
     *   fieldNo      = 125
     *   collectionId = NAMED_SIGNATORIES
     *   instanceId   = node.id  (ClientLEGraphNode.id — via graph edge path)
     *   valuePersonId linked through the graph node
     *
     * No temporal date-ranging by default — effectiveTo is not displayed,
     * but the schema still allows it if needed in future.
     */
    125: {
        kind: 'GRAPH_RELATIONSHIP_COLLECTION',
        label: 'Named Signatories',
        description:
            'Persons who are authorised to sign on behalf of this legal entity. ' +
            'User-curated — not sourced from any registry. ' +
            'Each entry is a Person node in the Knowledge Graph.',
        collectionId: 'NAMED_SIGNATORIES',
        appDataType: 'PARTY_REF',
        isMultiValue: true,
        itemType: 'PARTY_RELATIONSHIP',
        graph: {
            nodeType: 'PERSON',
            edgeType: 'NAMED_SIGNATORY',
            filterActiveOnly: true,
            writeBackEdgeType: 'NAMED_SIGNATORY',
        },
        temporal: {
            filterByEffectiveDate: false, // show all signatories; no auto-expiry
            effectiveFromLabel: 'Authorised from',
            effectiveToLabel: 'Authorised to',
        },
        sourceTransforms: [], // User-curated only — no automated ingestion
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
