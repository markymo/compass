import { LEUsersTab } from "@/components/client/le-users-tab";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <>
            <SetPageBreadcrumbs 
                items={[]}
            />
            <LEUsersTab leId={id} />
        </>
    );
}
