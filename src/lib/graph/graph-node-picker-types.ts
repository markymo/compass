/**
 * graph-node-picker-types.ts
 *
 * Neutral (no "use server" / "use client") type definitions for
 * the GraphNodePicker system.
 *
 * Kept separate so client components can import the types without
 * touching the "use server" action file — which would cause
 * Turbopack to refuse the import at the client bundle boundary.
 */

export interface GraphNodePickerItem {
    nodeId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    personId: string | null;
    legalEntityId: string | null;
    addressId: string | null;
    displayLabel: string;
    subLabel: string | null;
    source: string;
    /** edgeTypes this node has in the LE graph (for role badges) */
    activeEdgeTypes: string[];
    /** Whether this node has an active edge matching filterEdgeType */
    isPromoted: boolean;
    /**
     * Structured field values keyed by fieldKey from NODE_FIELD_REGISTRY.
     *
     * Phase 1 infrastructure — populated from registry storagePaths.
     * Phase 3: consumed by buildConfiguredDisplay() when pickerConfig is present.
     *
     * Example:
     *   { firstName: "Alan", lastName: "Bennett", primaryNationality: "British",
     *     dateOfBirth: Date("1952-04-30"), placeOfBirth: null, ... }
     */
    rawFields: Record<string, unknown>;
}
