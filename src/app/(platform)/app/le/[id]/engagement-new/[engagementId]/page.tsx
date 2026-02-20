import { notFound } from "next/navigation";
import { getEngagementDetails, getFullMasterData } from "@/actions/client-le";
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

    const { success, engagement, questionnaires, metrics } = await getEngagementDetails(engagementId);

    if (!success || !engagement) {
        return notFound();
    }

    // Context Data
    const le = engagement.clientLE;
    const fiName = engagement.org.name;
    const activeTab = typeof tab === 'string' ? tab : undefined;

    // Check if sharedDocuments is array, if not empty
    // Typescript might complain if engagement type is not inferred fully yet due to pending generation
    // But runtime it should avail.
    const sharedDocuments = (engagement as any).sharedDocuments || [];

    // Fetch Master Data Values (Standing Data)
    const { data: standingData } = await getFullMasterData(le.id);

    return (
        <div className="w-full px-2 md:px-6 space-y-6 pb-20 pt-6">
            <SetPageBreadcrumbs
                items={[
                    { label: fiName, iconName: "link-2" }
                ]}
            />
            <EngagementDetailView
                le={le}
                engagement={engagement}
                questionnaires={questionnaires || []}
                sharedDocuments={sharedDocuments}
                initialTab={activeTab}
                metrics={metrics}
                standingData={standingData}
            />
        </div>
    );
}
