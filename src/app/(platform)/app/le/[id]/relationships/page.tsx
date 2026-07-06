import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { EngagementManager } from "@/components/client/engagement/engagement-manager";
import { CommonQuestionnaires } from "@/components/client/engagement/common-questionnaires";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function RelationshipsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const { le } = data;

    return (
        <div className="space-y-6">
            <SetPageBreadcrumbs 
                items={[{ label: "Relationships", iconName: "link-2" }]}
                title="Supplier Relationships"
                typeLabel="Active Connections"
            />
            <CommonQuestionnaires 
                leId={le.id} 
                initialQuestionnaires={(le as any).commonQuestionnaires || []}
            />

            <EngagementManager
                leId={le.id}
                initialEngagements={(le as any).fiEngagements || []}
                commonQuestionnaires={(le as any).commonQuestionnaires || []}
                leDueDate={(le as any).dueDate}
            />
        </div>
    );
}
