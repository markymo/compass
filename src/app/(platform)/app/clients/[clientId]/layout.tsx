import { getClientDashboardData } from "@/actions/client";
import { ClientDashboardLayoutShell } from "@/components/layout/client-dashboard-layout-shell";

interface ClientDashboardLayoutProps {
    children: React.ReactNode;
    params: Promise<{ clientId: string }>;
}

export default async function ClientDashboardLayout({ children, params }: ClientDashboardLayoutProps) {
    const { clientId } = await params;
    const response = await getClientDashboardData(clientId);

    if (!response.success || !response.data) {
        return <div>Unauthorized or Organization not found</div>;
    }

    const { org, roleLabel } = response.data;

    return (
        <ClientDashboardLayoutShell
            clientId={clientId}
            orgName={org.name}
            roleLabel={roleLabel}
        >
            {children}
        </ClientDashboardLayoutShell>
    );
}
