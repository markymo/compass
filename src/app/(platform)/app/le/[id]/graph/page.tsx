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

    // Fetch relational edges
    const claims = await prisma.fieldClaim.findMany({
        where: { 
            OR: [
                { subjectLeId: le.legalEntityId },
                { subjectPersonId: { in: le.graphNodes.map(n => n.personId).filter(Boolean) as string[] } }
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

    return (
        <div className="space-y-6">
            <SetPageBreadcrumbs
                items={[
                    { label: "Knowledge Graph", href: `/app/le/${id}/graph` }
                ]}
                pageTitle={`Graph: ${le.name}`}
            />
            
            <KnowledgeGraphView 
                leId={le.id} 
                leName={le.name} 
                initialNodes={le.graphNodes}
                claims={claims}
            />
        </div>
    );
}
