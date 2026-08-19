import { Suspense } from "react";
import { getClientLEData } from "@/actions/client";
import { notFound } from "next/navigation";
import { ApprovalsView } from "@/components/client/approvals/approvals-view";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function ApprovalsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getClientLEData(id);

    if (!data) return notFound();

    const { le } = data;

    return (
        <div className="space-y-6">
            <SetPageBreadcrumbs 
                items={[{ label: "Approvals", iconName: "shield-check" }]}
                title="Questionnaire Approvals"
                typeLabel="Formal Approvals"
            />
            <Suspense fallback={null}>
                <ApprovalsView
                    leId={le.id}
                    leName={le.name}
                    initialRelationships={(le as any).fiEngagements || []}
                />
            </Suspense>
        </div>
    );
}
