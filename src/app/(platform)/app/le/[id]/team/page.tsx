import { LEUsersTab } from "@/components/client/le-users-tab";
import { SetPageBreadcrumbs } from "@/context/breadcrumb-context";
import { getCurrentUserLERole } from "@/actions/client";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const leRole = await getCurrentUserLERole(id);

    return (
        <>
            <SetPageBreadcrumbs 
                items={[{ label: "Team" }]}
            />
            <LEUsersTab 
                leId={id} 
                canManageUsers={leRole === "LE_ADMIN" || leRole === "ORG_ADMIN" || leRole === "SYSTEM_ADMIN"}
            />
        </>
    );
}
