"use server";

import prisma from "@/lib/prisma";
import { getNodeFields, type NodeType } from "@/lib/graph/node-field-registry";

// ── Types ─────────────────────────────────────────────────────────────────

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
     * Not currently consumed by the picker UI.
     * Future pickerConfig (Phase 2+) will select display/search fields from here.
     *
     * Example:
     *   { firstName: "Alan", lastName: "Bennett", primaryNationality: "British",
     *     dateOfBirth: Date("1952-04-30"), placeOfBirth: null, ... }
     */
    rawFields: Record<string, unknown>;
}

interface GetGraphNodesForPickerInput {
    clientLEId: string;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    filterEdgeType?: string | null;
    filterActiveOnly?: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────

/**
 * Build a Prisma select object for an entity (person / legalEntity / address)
 * from NODE_FIELD_REGISTRY. Always includes `id` plus every column referenced
 * by a SYSTEM_COLUMN storagePath for the given nodeType.
 *
 * This keeps the Prisma fetch in sync with the registry automatically:
 * adding a field to the registry widens the select without a separate code change.
 */
function buildEntitySelect(nodeType: NodeType): Record<string, boolean> {
    const select: Record<string, boolean> = { id: true };
    for (const field of getNodeFields(nodeType)) {
        const parts = field.storagePath.split(".");
        if (parts.length === 2) {
            select[parts[1]] = true; // e.g. "person.firstName" → "firstName"
        }
    }
    return select;
}

/**
 * Resolve all registry fields for a node into a flat Record<fieldKey, value>.
 *
 * Iterates NODE_FIELD_REGISTRY for the nodeType, reads each field's value by
 * navigating the included entity object using storagePath:
 *   "person.dateOfBirth"  → node.person?.dateOfBirth ?? null
 *   "address.country"     → node.address?.country ?? null
 *
 * Missing/null fields resolve to null (never undefined).
 */
function buildRawFields(node: any, nodeType: NodeType): Record<string, unknown> {
    const rawFields: Record<string, unknown> = {};
    for (const field of getNodeFields(nodeType)) {
        const parts = field.storagePath.split(".");
        if (parts.length === 2) {
            const [entityKey, columnKey] = parts;
            rawFields[field.fieldKey] = node[entityKey]?.[columnKey] ?? null;
        }
    }
    return rawFields;
}

// ── Server action ─────────────────────────────────────────────────────────

/**
 * getGraphNodesForPicker
 *
 * Fetches all graph nodes for a given LE scoped to a node type.
 * Returns items sorted alphabetically ascending by displayLabel.
 *
 * Phase 1: each item now carries rawFields — structured field values from
 * NODE_FIELD_REGISTRY. Display behaviour is unchanged.
 */
export async function getGraphNodesForPicker(
    input: GetGraphNodesForPickerInput
): Promise<{ success: true; items: GraphNodePickerItem[] } | { success: false; error: string }> {
    try {
        const { clientLEId, graphNodeType, filterEdgeType, filterActiveOnly = true } = input;

        // 1. Fetch all nodes of the requested type for this LE.
        //    Entity selects are derived from NODE_FIELD_REGISTRY so that widening
        //    the registry automatically widens the fetch without a separate code change.
        const nodes = await (prisma as any).clientLEGraphNode.findMany({
            where: {
                clientLEId,
                nodeType: graphNodeType,
            },
            include: {
                person: {
                    select: buildEntitySelect("PERSON"),
                },
                legalEntity: {
                    select: buildEntitySelect("LEGAL_ENTITY"),
                },
                address: {
                    select: buildEntitySelect("ADDRESS"),
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // 2. Fetch active edges for this LE (to know which nodes have which roles)
        const edges = await (prisma as any).clientLEGraphEdge.findMany({
            where: {
                clientLEId,
                ...(filterActiveOnly ? { isActive: true } : {}),
            },
            select: {
                fromNodeId: true,
                edgeType: true,
                isActive: true,
            },
        });

        // 3. Build nodeId → activeEdgeTypes map
        const edgeMap = new Map<string, string[]>();
        for (const e of edges) {
            if (!edgeMap.has(e.fromNodeId)) edgeMap.set(e.fromNodeId, []);
            if (!edgeMap.get(e.fromNodeId)!.includes(e.edgeType)) {
                edgeMap.get(e.fromNodeId)!.push(e.edgeType);
            }
        }

        // 4. Build picker items
        const items: GraphNodePickerItem[] = nodes.map((node: any) => {
            const activeEdgeTypes = edgeMap.get(node.id) ?? [];

            // Promotion sort is intentionally disabled.
            // filterEdgeType is kept in the binding config for future use,
            // but the picker currently shows all nodes sorted purely alphabetically.
            // Re-introduce isPromoted when a deliberate candidate-population strategy is agreed.
            const isPromoted = false;

            // ── displayLabel / subLabel — unchanged from pre-Phase-1 ─────────
            // These are still hardcoded and drive the current UI behaviour.
            // Future pickerConfig (Phase 2) will replace these with
            // registry-driven templates, using rawFields as the source.
            let displayLabel = "Unknown";
            let subLabel: string | null = null;

            if (node.nodeType === "PERSON" && node.person) {
                displayLabel = [node.person.firstName, node.person.middleName, node.person.lastName]
                    .filter(Boolean)
                    .join(" ") || "Unknown Person";
                subLabel = node.person.primaryNationality ?? null;
            } else if (node.nodeType === "LEGAL_ENTITY" && node.legalEntity) {
                displayLabel = node.legalEntity.name || node.legalEntity.localRegistrationNumber || "Unknown Entity";
                subLabel = node.legalEntity.localRegistrationNumber ?? null;
            } else if (node.nodeType === "ADDRESS" && node.address) {
                displayLabel = [node.address.line1, node.address.city, node.address.postalCode, node.address.country]
                    .filter(Boolean)
                    .join(", ") || "Unknown Address";
                subLabel = node.address.country ?? null;
            }

            return {
                nodeId: node.id,
                nodeType: node.nodeType,
                personId: node.personId ?? null,
                legalEntityId: node.legalEntityId ?? null,
                addressId: node.addressId ?? null,
                displayLabel,
                subLabel,
                source: node.source ?? "UNKNOWN",
                activeEdgeTypes,
                isPromoted,
                // Phase 1: structured field values from NODE_FIELD_REGISTRY.
                // Not currently consumed by the picker UI.
                rawFields: buildRawFields(node, node.nodeType as NodeType),
            };
        });

        // Sort: purely alphabetical ascending.
        items.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));

        return { success: true, items };
    } catch (e: any) {
        console.error("[getGraphNodesForPicker]", e);
        return { success: false, error: String(e) };
    }
}
