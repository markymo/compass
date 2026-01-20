import { notFound } from "next/navigation";
import { getEngagementDetails } from "@/actions/client-le";
import { EngagementDetailView } from "@/components/client/engagement/engagement-detail-view";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

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

    const { success, engagement, questionnaires } = await getEngagementDetails(engagementId);

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

    return (
        <div className="w-full px-6 space-y-6 pb-20 pt-6">
            {/* Breadcrumb Navigation */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/app">Client Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href={`/app/le/${le.id}/v2`}>Legal Entity: {le.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Engagement: {fiName}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <EngagementDetailView
                le={le}
                engagement={engagement}
                questionnaires={questionnaires || []}
                sharedDocuments={sharedDocuments}
                initialTab={activeTab}
            />
        </div>
    );
}
