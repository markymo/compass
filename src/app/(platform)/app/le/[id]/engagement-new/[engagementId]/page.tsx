import { notFound } from "next/navigation";
import { getEngagementDetails } from "@/actions/client-le";
import { EngagementDetailView } from "@/components/client/engagement/engagement-detail-view";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

interface PageProps {
    params: Promise<{
        id: string;
        engagementId: string;
    }>;
}

export default async function EngagementPage({ params }: PageProps) {
    const { id, engagementId } = await params;

    const { success, engagement, questionnaires } = await getEngagementDetails(engagementId);

    if (!success || !engagement) {
        return notFound();
    }

    // Context Data
    const le = engagement.clientLE;
    const fiName = engagement.org.name;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 pt-6">
            {/* Breadcrumb Navigation */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/app/le">Legal Entities</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href={`/app/le/${le.id}`}>{le.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{fiName}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <EngagementDetailView
                le={le}
                engagement={engagement}
                questionnaires={questionnaires || []}
            />
        </div>
    );
}
