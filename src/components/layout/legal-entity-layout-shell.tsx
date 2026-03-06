"use client";

import { BreadcrumbProvider, useBreadcrumbs } from "@/context/breadcrumb-context";
import { GuideHeader, GuideBreadcrumbItem } from "@/components/layout/GuideHeader";
import { LegalEntityNav } from "@/components/layout/legal-entity-nav";
import { ClientLEActions } from "@/components/client/client-le-actions";
import { getBreadcrumbIcon } from "@/lib/breadcrumb-icon-map";
import { DueDateBadge } from "@/components/client/due-date-badge";
import { EditableDescription } from "@/components/client/editable-description";
import { EditableLEI } from "@/components/client/editable-lei";

interface LegalEntityLayoutShellProps {
    children: React.ReactNode;
    baseBreadcrumbs: GuideBreadcrumbItem[];
    leId: string;
    leName: string;
    isSystemAdmin: boolean;
    leData?: any;
    clientOrgName?: string;
}

function InnerShell({ children, baseBreadcrumbs, leId, leName, isSystemAdmin, leData, clientOrgName }: LegalEntityLayoutShellProps) {
    const { extraBreadcrumbs } = useBreadcrumbs();

    // Merge base breadcrumbs with extra breadcrumbs from context
    // Map icon names to actual Lucide icons if present
    const combinedBreadcrumbs = [...baseBreadcrumbs, ...extraBreadcrumbs].map((item: any) => ({
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
            <main className="flex-1 max-w-6xl mx-auto w-full p-8 space-y-8">
                {leData && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                                {leData.name}
                            </h1>
                            <DueDateBadge
                                id={leData.id}
                                date={leData.dueDate}
                                effectiveDate={leData.dueDate}
                                source="LE"
                                level="LE"
                                label="Deadline"
                            />
                        </div>

                        <div className="max-w-2xl">
                            <EditableDescription
                                leId={leData.id}
                                initialValue={leData.description}
                                leName={leData.name}
                                clientOrgName={clientOrgName || "Client"}
                            />
                            <div className="mt-4">
                                <EditableLEI
                                    leId={leData.id}
                                    initialLei={leData.lei}
                                    initialFetchedAt={leData.gleifFetchedAt}
                                />
                            </div>
                        </div>
                    </div>
                )}

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
