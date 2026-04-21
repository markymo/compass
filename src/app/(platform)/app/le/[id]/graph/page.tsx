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

    // Fetch graph edges (PSC control relationships etc.)
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

    // Find persons mapped to Field 63 (Active Directors) for the Active Directors filter
    const activeDirectorClaims = await prisma.fieldClaim.findMany({
        where: {
            subjectLeId: le.legalEntityId,
            fieldNo: 63,
            valuePersonId: { not: null }
        },
        select: { valuePersonId: true },
        distinct: ['valuePersonId']
    });
    const activeDirectorPersonIds = activeDirectorClaims
        .map((c: any) => c.valuePersonId)
        .filter(Boolean) as string[];

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
                activeDirectorPersonIds={activeDirectorPersonIds}
            />
        </div>
    );
}
