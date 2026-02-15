import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { EngagementManager } from "@/components/client/engagement/engagement-manager";

export default async function RelationshipsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const { le } = data;

    return (
        <EngagementManager
            leId={le.id}
            initialEngagements={(le as any).fiEngagements || []}
        />
    );
}
