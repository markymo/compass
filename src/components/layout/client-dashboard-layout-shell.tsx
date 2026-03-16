"use client"

import { Building2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { getClientDashboardTabs } from "@/config/navigation-tabs";

interface ClientDashboardLayoutShellProps {
    children: React.ReactNode;
    clientId: string;
    orgName: string;
    roleLabel: string;
}

export function ClientDashboardLayoutShell({ 
    children, 
    clientId, 
    orgName, 
    roleLabel 
}: ClientDashboardLayoutShellProps) {
    const tabs = getClientDashboardTabs(clientId);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/10">
            <StandardPageHeader
                title={orgName}
                typeLabel="Client Organization"
                subtitle={`Manage your legal entities and banking relationships for ${orgName}.`}
                breadcrumbs={[
                    { label: "Home", href: "/app", icon: Home },
                    { label: orgName, icon: Building2 }
                ]}
                actions={
                    <Badge variant="secondary" className="text-xs uppercase tracking-wider font-mono px-3 py-1 bg-slate-100 text-slate-700 border-slate-200">
                        {roleLabel}
                    </Badge>
                }
                secondaryNav={<HeaderNavList items={tabs} />}
            />
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}
