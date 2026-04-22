"use server";

import prisma from "@/lib/prisma";

export interface GraphNodePickerItem {
    nodeId: string;
    nodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    personId: string | null;
    legalEntityId: string | null;
    addressId: string | null;
    displayLabel: string;
    subLabel: string | null;   // e.g. nationality, country
    source: string;
    /** edgeTypes this node has in the LE graph (for promoted / role badges) */
    activeEdgeTypes: string[];
    /** Whether this node has an active edge matching filterEdgeType */
    isPromoted: boolean;
}

interface GetGraphNodesForPickerInput {
    clientLEId: string;
    graphNodeType: "PERSON" | "LEGAL_ENTITY" | "ADDRESS";
    /** If supplied, nodes with this edge type are marked isPromoted and sorted first */
    filterEdgeType?: string | null;
    filterActiveOnly?: boolean;
}

/**
 * getGraphNodesForPicker
 *
 * Fetches all graph nodes for a given LE scoped to a node type.
 * Marks nodes as "promoted" if they have an active edge matching filterEdgeType.
 * Used by the GraphNodePicker component.
 */
export async function getGraphNodesForPicker(
    input: GetGraphNodesForPickerInput
): Promise<{ success: true; items: GraphNodePickerItem[] } | { success: false; error: string }> {
    try {
        const { clientLEId, graphNodeType, filterEdgeType, filterActiveOnly = true } = input;

        // 1. Fetch all nodes of the requested type for this LE
        const nodes = await (prisma as any).clientLEGraphNode.findMany({
            where: {
                clientLEId,
                nodeType: graphNodeType,
            },
            include: {
                person: {
                    select: { id: true, firstName: true, middleName: true, lastName: true, primaryNationality: true },
                },
                legalEntity: {
                    select: { id: true, name: true, localRegistrationNumber: true },
                },
                address: {
                    select: { id: true, line1: true, line2: true, city: true, postalCode: true, country: true },
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
            const isPromoted = filterEdgeType
                ? activeEdgeTypes.includes(filterEdgeType)
                : false;

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
            };
        });

        // 5. Sort: promoted nodes first, then alphabetical
        items.sort((a, b) => {
            if (a.isPromoted && !b.isPromoted) return -1;
            if (!a.isPromoted && b.isPromoted) return 1;
            return a.displayLabel.localeCompare(b.displayLabel);
        });

        return { success: true, items };
    } catch (e: any) {
        console.error("[getGraphNodesForPicker]", e);
        return { success: false, error: String(e) };
    }
}
