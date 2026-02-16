"use client";

import { BreadcrumbProvider, useBreadcrumbs } from "@/context/breadcrumb-context";
import { GuideHeader, GuideBreadcrumbItem } from "@/components/layout/GuideHeader";
import { LegalEntityNav } from "@/components/layout/legal-entity-nav";
import { ClientLEActions } from "@/components/client/client-le-actions";
import { getBreadcrumbIcon } from "@/lib/breadcrumb-icon-map";

interface LegalEntityLayoutShellProps {
    children: React.ReactNode;
    baseBreadcrumbs: GuideBreadcrumbItem[];
    leId: string;
    leName: string;
    isSystemAdmin: boolean;
}

function InnerShell({ children, baseBreadcrumbs, leId, leName, isSystemAdmin }: LegalEntityLayoutShellProps) {
    const { extraBreadcrumbs } = useBreadcrumbs();

    // Merge base breadcrumbs with extra breadcrumbs from context
    // Map icon names to actual Lucide icons if present
    const combinedBreadcrumbs = [...baseBreadcrumbs, ...extraBreadcrumbs].map(item => ({
        ...item,
        icon: item.icon || (item.iconName ? getBreadcrumbIcon(item.iconName) : undefined)
    }));

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50">
            <GuideHeader
                breadcrumbs={combinedBreadcrumbs}
                actions={<ClientLEActions leId={leId} leName={leName} isSystemAdmin={isSystemAdmin} />}
            />
            <LegalEntityNav leId={leId} />
            <main className="flex-1 max-w-6xl mx-auto w-full p-8">
                {children}
            </main>
        </div>
    );
}

import { AuthSessionProvider } from "@/components/providers/session-provider";

export function LegalEntityLayoutShell(props: LegalEntityLayoutShellProps) {
    return (
        <AuthSessionProvider>
            <BreadcrumbProvider>
                <InnerShell {...props} />
            </BreadcrumbProvider>
        </AuthSessionProvider>
    );
}
