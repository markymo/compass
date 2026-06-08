/**
 * Node Field Registry
 *
 * Defines the catalogue of fields available on each graph node type
 * (PERSON, LEGAL_ENTITY, ADDRESS). This registry is the source of truth
 * for system fields. It is code-managed — no DB table is required for
 * system fields.
 *
 * Design decisions:
 * - System fields map 1:1 to Prisma columns on the global entity tables.
 * - Custom fields (not yet implemented) will have storageKind CUSTOM_JSON
 *   or CUSTOM_TABLE and will be stored on ClientLEGraphNode or a value table.
 * - pickerConfig (not yet implemented) will reference fields by fieldKey.
 * - Scope GLOBAL means the value is shared across all ClientLEs that
 *   reference the same entity. LE_SCOPED fields (future) differ per ClientLE.
 *
 * See docs/architecture/graph-backed-reference-fields.md for full context.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type NodeType = "PERSON" | "LEGAL_ENTITY" | "ADDRESS";

export type NodeFieldDataType =
    | "TEXT"
    | "DATE"
    | "BOOLEAN"
    | "NUMBER"
    | "COUNTRY_CODE"
    | "EMAIL"
    | "URL";

/**
 * How and where the field value is physically stored.
 *
 * SYSTEM_COLUMN — a Prisma column on the global entity table (persons,
 *   legal_entities, addresses). Value is read via storagePath on the
 *   included entity object (e.g. node.person.firstName).
 *
 * CUSTOM_JSON — future: stored in ClientLEGraphNode.customProperties Json?.
 *   LE-scoped by nature.
 *
 * CUSTOM_TABLE — future: stored in a NodeFieldValue table. Supports both
 *   GLOBAL and LE_SCOPED semantics.
 */
export type NodeFieldStorageKind =
    | "SYSTEM_COLUMN"
    | "CUSTOM_JSON"
    | "CUSTOM_TABLE";

/**
 * Whether the field value is shared globally or differs per ClientLE.
 *
 * GLOBAL — same value regardless of which ClientLE is viewing the node.
 *   Example: person.firstName
 *
 * LE_SCOPED — value may differ per ClientLE. Must be stored on
 *   ClientLEGraphNode or a NodeFieldValue table, not on the global entity.
 *   Example: an internal risk rating applied by a specific financial institution.
 */
export type NodeFieldScope = "GLOBAL" | "LE_SCOPED";

/**
 * Definition of a single field on a graph node type.
 *
 * System fields (isSystem: true) are defined here in code. Custom fields
 * (isSystem: false, not yet implemented) will be stored in the DB and
 * merged with system fields at runtime.
 */
export interface NodeFieldDefinition {
    /** Unique identifier within the nodeType. Matches the Prisma column name for SYSTEM_COLUMN fields. */
    fieldKey: string;

    /** Graph node type this field belongs to. */
    nodeType: NodeType;

    /** Human-readable label for admin UI and picker config selector. */
    label: string;

    /** Semantic data type. Drives rendering, validation, and formatting. */
    dataType: NodeFieldDataType;

    /** Where and how the value is stored. */
    storageKind: NodeFieldStorageKind;

    /**
     * Dot-notation path to read the field value from the entity object
     * returned by the Prisma include.
     *
     * For SYSTEM_COLUMN fields:
     *   PERSON        → "person.<columnName>"
     *   LEGAL_ENTITY  → "legalEntity.<columnName>"
     *   ADDRESS       → "address.<columnName>"
     *
     * For CUSTOM_JSON fields: "customProperties.<key>"
     * For CUSTOM_TABLE fields: resolved by NodeFieldValue table lookup.
     */
    storagePath: string;

    /** Whether the value is global to the entity or scoped per ClientLE. */
    scope: NodeFieldScope;

    /** True for fields managed by code (this registry). False for admin-created custom fields. */
    isSystem: boolean;

    /**
     * Whether this field may be included in pickerConfig.searchFields.
     * Only TEXT and COUNTRY_CODE fields are searchable by default.
     */
    isSearchable: boolean;

    /**
     * Whether this field may be included in pickerConfig.displayFields or subFields.
     * False fields are internal and should not be presented as display options.
     */
    isDisplayable: boolean;

    /**
     * Whether this field contains personally identifiable information.
     * Used for future data classification, export filtering, and access control.
     */
    isPii: boolean;

    /** Display order within the nodeType in the admin field selector. */
    order: number;
}

// ── System Field Registry ─────────────────────────────────────────────────

/**
 * Complete catalogue of system-defined fields for all graph node types.
 *
 * Rules:
 * - fieldKey must be unique within each nodeType.
 * - All system fields have storageKind = SYSTEM_COLUMN, scope = GLOBAL, isSystem = true.
 * - storagePath must start with the entity prefix for the nodeType:
 *     PERSON        → "person."
 *     LEGAL_ENTITY  → "legalEntity."
 *     ADDRESS       → "address."
 * - Fields that are not suitable for search have isSearchable = false.
 * - Fields that should not be offered as display options have isDisplayable = false.
 *
 * Custom fields (storageKind = CUSTOM_JSON | CUSTOM_TABLE) are not yet implemented.
 * When added, they will be stored in the DB and merged with this constant at runtime.
 */
export const NODE_FIELD_REGISTRY: NodeFieldDefinition[] = [

    // ── PERSON ─────────────────────────────────────────────────────────────

    {
        fieldKey:     "firstName",
        nodeType:     "PERSON",
        label:        "First Name",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.firstName",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        true,
        order:        1,
    },
    {
        fieldKey:     "middleName",
        nodeType:     "PERSON",
        label:        "Middle Name",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.middleName",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        true,
        order:        2,
    },
    {
        fieldKey:     "lastName",
        nodeType:     "PERSON",
        label:        "Last Name",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.lastName",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        true,
        order:        3,
    },
    {
        fieldKey:     "dateOfBirth",
        nodeType:     "PERSON",
        label:        "Date of Birth",
        dataType:     "DATE",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.dateOfBirth",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        true,
        order:        4,
    },
    {
        fieldKey:     "placeOfBirth",
        nodeType:     "PERSON",
        label:        "Place of Birth",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.placeOfBirth",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        true,
        order:        5,
    },
    {
        fieldKey:     "primaryNationality",
        nodeType:     "PERSON",
        label:        "Nationality",
        dataType:     "COUNTRY_CODE",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.primaryNationality",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        false,
        order:        6,
    },
    {
        fieldKey:     "isPublicFigure",
        nodeType:     "PERSON",
        label:        "Politically Exposed Person (PEP)",
        dataType:     "BOOLEAN",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "person.isPublicFigure",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        false,
        order:        7,
    },

    // ── LEGAL_ENTITY ───────────────────────────────────────────────────────

    {
        fieldKey:     "name",
        nodeType:     "LEGAL_ENTITY",
        label:        "Entity Name",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "legalEntity.name",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        false,
        order:        1,
    },
    {
        fieldKey:     "localRegistrationNumber",
        nodeType:     "LEGAL_ENTITY",
        label:        "Registration Number",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "legalEntity.localRegistrationNumber",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        false,
        order:        2,
    },

    // ── ADDRESS ────────────────────────────────────────────────────────────

    {
        fieldKey:     "line1",
        nodeType:     "ADDRESS",
        label:        "Address Line 1",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "address.line1",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        false,
        order:        1,
    },
    {
        fieldKey:     "line2",
        nodeType:     "ADDRESS",
        label:        "Address Line 2",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "address.line2",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        false,
        order:        2,
    },
    {
        fieldKey:     "city",
        nodeType:     "ADDRESS",
        label:        "City",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "address.city",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        false,
        order:        3,
    },
    {
        fieldKey:     "region",
        nodeType:     "ADDRESS",
        label:        "Region / County",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "address.region",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        false,
        order:        4,
    },
    {
        fieldKey:     "postalCode",
        nodeType:     "ADDRESS",
        label:        "Postal Code",
        dataType:     "TEXT",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "address.postalCode",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: false,
        isDisplayable: true,
        isPii:        false,
        order:        5,
    },
    {
        fieldKey:     "country",
        nodeType:     "ADDRESS",
        label:        "Country",
        dataType:     "COUNTRY_CODE",
        storageKind:  "SYSTEM_COLUMN",
        storagePath:  "address.country",
        scope:        "GLOBAL",
        isSystem:     true,
        isSearchable: true,
        isDisplayable: true,
        isPii:        false,
        order:        6,
    },
];

// ── Lookup Helpers ────────────────────────────────────────────────────────

/**
 * Returns all registered fields for the given node type, sorted by order.
 * Includes both system fields and any custom fields added at runtime.
 */
export function getNodeFields(nodeType: NodeType): NodeFieldDefinition[] {
    return NODE_FIELD_REGISTRY
        .filter(f => f.nodeType === nodeType)
        .sort((a, b) => a.order - b.order);
}

/**
 * Returns a single field definition by nodeType + fieldKey, or undefined if
 * not found. Case-sensitive on fieldKey.
 */
export function getNodeField(
    nodeType: NodeType,
    fieldKey: string
): NodeFieldDefinition | undefined {
    return NODE_FIELD_REGISTRY.find(
        f => f.nodeType === nodeType && f.fieldKey === fieldKey
    );
}

/**
 * Returns all fields that may be used in pickerConfig.displayFields or subFields
 * (isDisplayable = true), sorted by order.
 */
export function getDisplayableFields(nodeType: NodeType): NodeFieldDefinition[] {
    return NODE_FIELD_REGISTRY
        .filter(f => f.nodeType === nodeType && f.isDisplayable)
        .sort((a, b) => a.order - b.order);
}

/**
 * Returns all fields that may be used in pickerConfig.searchFields
 * (isSearchable = true), sorted by order.
 */
export function getSearchableFields(nodeType: NodeType): NodeFieldDefinition[] {
    return NODE_FIELD_REGISTRY
        .filter(f => f.nodeType === nodeType && f.isSearchable)
        .sort((a, b) => a.order - b.order);
}
