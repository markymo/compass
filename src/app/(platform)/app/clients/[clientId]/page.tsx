import { getClientDashboardData } from "@/actions/client";
import { ClientDashboardView } from "@/components/client/client-dashboard-view";

interface ClientDashboardPageProps {
    params: Promise<{ clientId: string }>;
}

export default async function ClientDashboardPage({ params }: ClientDashboardPageProps) {
    const { clientId } = await params;

    // 1. Fetch Data with Permissions
    const response = await getClientDashboardData(clientId);

    if (!response.success || !response.data) {
        return <div>Unauthorized or Organization not found</div>;
    }

    const { org, les, permissions, roleLabel, userId, email } = response.data;

    return (
        <ClientDashboardView 
            org={org}
            les={les}
            permissions={permissions}
            roleLabel={roleLabel}
            userId={userId}
            email={email}
        />
    );
}
