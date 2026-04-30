/**
 * Graph Binding Test Page — /app/admin/graph-binding-test
 *
 * A focused test harness to validate the full Step 1-4 implementation:
 *  1. Create a MasterFieldGraphBinding for field 63
 *  2. Render the GraphNodePicker for a specific LE
 *  3. Show the write-back result (edges created)
 *  4. Show the personIdsByEdgeType that the Graph Explorer will read
 *
 * REMOVE THIS PAGE before going to production.
 */
import prisma from "@/lib/prisma";
import { GraphBindingTestClient } from "./test-client";

interface Props {
    searchParams: Promise<{ leId?: string; fieldNo?: string }>;
}

export default async function GraphBindingTestPage({ searchParams }: Props) {
    const { leId, fieldNo: fieldNoParam } = await searchParams;
    const fieldNo = parseInt(fieldNoParam || "63");

    // 1. Load field definition + its bindings
    const field = await (prisma as any).masterFieldDefinition.findUnique({
        where: { fieldNo },
        include: {
            graphBindings: { where: { isActive: true } },
            sourceMappings: { where: { isActive: true }, select: { sourceType: true, sourcePath: true } },
        },
    });

    // 2. Load all ClientLEs for the LE selector
    const clientLEs = await prisma.clientLE.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
    });

    // 3. If leId provided, load graph nodes + edges for that LE
    let graphNodes: any[] = [];
    let graphEdges: any[] = [];
    let personIdsByEdgeType: Record<string, string[]> = {};

    if (leId) {
        const le = await prisma.clientLE.findUnique({
            where: { id: leId },
            include: {
                graphNodes: {
                    include: { person: true, legalEntity: true, address: true },
                },
            },
        });

        if (le) {
            graphNodes = le.graphNodes;
            graphEdges = await prisma.clientLEGraphEdge.findMany({
                where: { clientLEId: leId },
                orderBy: { edgeType: "asc" },
            });

            // Build personIdsByEdgeType (same logic as graph/page.tsx)
            const nodeIdToPersonId = new Map<string, string>();
            for (const node of le.graphNodes) {
                if (node.personId) nodeIdToPersonId.set(node.id, node.personId as string);
            }
            for (const edge of graphEdges) {
                if (!edge.isActive) continue;
                const personId = nodeIdToPersonId.get(edge.fromNodeId);
                if (!personId) continue;
                if (!personIdsByEdgeType[edge.edgeType]) personIdsByEdgeType[edge.edgeType] = [];
                if (!personIdsByEdgeType[edge.edgeType].includes(personId)) {
                    personIdsByEdgeType[edge.edgeType].push(personId);
                }
            }
        }
    }

    return (
        <GraphBindingTestClient
            field={field}
            clientLEs={clientLEs}
            selectedLeId={leId || null}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            personIdsByEdgeType={personIdsByEdgeType}
            fieldNo={fieldNo}
        />
    );
}
