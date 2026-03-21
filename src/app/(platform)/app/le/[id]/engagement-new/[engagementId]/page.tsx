import { notFound } from "next/navigation";
import { getEngagementDetails, getFullMasterData } from "@/actions/client-le";
import { getEngagementEvidenceDocuments } from "@/actions/kanban-actions";
import { EngagementDetailView } from "@/components/client/engagement/engagement-detail-view";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";


interface PageProps {
    params: Promise<{
        id: string;
        engagementId: string;
    }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EngagementPage({ params, searchParams }: PageProps) {
    const { id, engagementId } = await params;
    const { tab } = await searchParams;

    const [detailsRes, evidenceRes] = await Promise.all([
        getEngagementDetails(engagementId),
        getEngagementEvidenceDocuments(engagementId),
    ]);

    const { success, engagement, questionnaires, invitations, members, metrics } = detailsRes;

    if (!success || !engagement) {
        return notFound();
    }

    // Context Data
    const le = engagement.clientLE;
    const fiName = engagement.org.name;
    const activeTab = typeof tab === 'string' ? tab : undefined;

    const sharedDocuments = (engagement as any).sharedDocuments || [];
    const evidenceDocuments = evidenceRes.success ? (evidenceRes.documents || []) : [];

    // Fetch Master Data Values (Standing Data)
    const { data: standingData } = await getFullMasterData(le.id);

    return (
        <div className="w-full px-2 md:px-6 space-y-6 pb-20 pt-6">
            <EngagementDetailView
                le={le}
                engagement={engagement}
                questionnaires={questionnaires || []}
                sharedDocuments={sharedDocuments}
                evidenceDocuments={evidenceDocuments}
                invitations={invitations || []}
                members={members || []}
                initialTab={activeTab}
                metrics={metrics}
                standingData={standingData}
            />
        </div>
    );
}
