import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { KnowledgeGraphView } from "@/components/client/graph/knowledge-graph-view";

interface GraphPageProps {
    params: Promise<{ id: string }>;
}

export default async function KnowledgeGraphPage({ params }: GraphPageProps) {
    const { id } = await params;

    const le = await prisma.clientLE.findUnique({
        where: { id },
        include: {
            graphNodes: {
                include: {
                    person: true,
                    legalEntity: true,
                    address: true,
                    lastModifiedBy: true
                }
            }
        }
    });

    if (!le) {
        return notFound();
    }

    const personIds = le.graphNodes.map((n: any) => n.personId).filter(Boolean) as string[];
    const relatedLeIds = le.graphNodes
        .filter((n: any) => n.nodeType === 'LEGAL_ENTITY' && n.legalEntityId)
        .map((n: any) => n.legalEntityId as string);

    const allSubjectLeIds = [le.legalEntityId, ...relatedLeIds].filter(Boolean) as string[];
    const claims = await prisma.fieldClaim.findMany({
        where: {
            valueAddressId: { not: null },
            OR: [
                { subjectLeId: { in: allSubjectLeIds } },
                ...(personIds.length > 0 ? [{ subjectPersonId: { in: personIds } }] : [])
            ]
        },
        select: {
            subjectLeId: true,
            subjectPersonId: true,
            valueAddressId: true,
            valueLeId: true,
            valuePersonId: true,
            fieldNo: true
        }
    });

    // Fetch graph edges (director, PSC, secretary relationships etc.)
    const graphEdges = await prisma.clientLEGraphEdge.findMany({
        where: { clientLEId: le.id },
        select: {
            id: true,
            fromNodeId: true,
            toNodeId: true,
            edgeType: true,
            naturesOfControl: true,
            notifiedOn: true,
            ceasedOn: true,
            isActive: true,
            source: true,
        }
    });

    // ── Build personIdsByEdgeType from graph edges ─────────────────────────
    // Replaces the hardcoded fieldNo:63 / FieldClaim query.
    // Groups *active* edges by edgeType and resolves the personId for each fromNode.
    // RA-agnostic: when Phase 4 write-back creates a DIRECTOR edge, it automatically
    // appears here — zero code changes required.
    const nodeIdToPersonId = new Map<string, string>();
    for (const node of le.graphNodes) {
        if (node.personId) nodeIdToPersonId.set(node.id, node.personId as string);
    }

    const personIdsByEdgeType: Record<string, string[]> = {};
    for (const edge of graphEdges) {
        if (!edge.isActive) continue;
        const personId = nodeIdToPersonId.get(edge.fromNodeId);
        if (!personId) continue;
        if (!personIdsByEdgeType[edge.edgeType]) personIdsByEdgeType[edge.edgeType] = [];
        if (!personIdsByEdgeType[edge.edgeType].includes(personId)) {
            personIdsByEdgeType[edge.edgeType].push(personId);
        }
    }

    return (
        <div className="space-y-6">
            <SetPageBreadcrumbs
                items={[
                    { label: "Knowledge Graph", href: `/app/le/${id}/graph` }
                ]}
            />
            
            <KnowledgeGraphView 
                leId={le.id} 
                leName={le.name} 
                initialNodes={le.graphNodes}
                claims={claims}
                graphEdges={graphEdges}
                rootLegalEntityId={le.legalEntityId}
                personIdsByEdgeType={personIdsByEdgeType}
            />
        </div>
    );
}
