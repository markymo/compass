import { redirect } from "next/navigation";

export default async function FIEngagementOverviewPage({
    params
}: {
    params: Promise<{ id: string; engagementId: string }>;
}) {
    const { id, engagementId } = await params;

    // Legacy Relationship Detail Route Compatibility: Redirect to Supplier Relationships home with expand target
    return redirect(`/app/s/${id}?expand=${engagementId}`);
}
