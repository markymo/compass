"use client";

import { BreadcrumbProvider, useBreadcrumbs } from "@/context/breadcrumb-context";
import { StandardPageHeader } from "@/components/layout/StandardPageHeader";
import { GuideHeader, GuideBreadcrumbItem } from "@/components/layout/GuideHeader";
import { ClientLEActions } from "@/components/client/client-le-actions";
import { getBreadcrumbIcon } from "@/lib/breadcrumb-icon-map";
import { DueDateBadge } from "@/components/client/due-date-badge";
import { EditableDescription } from "@/components/client/editable-description";
import { EditableLEI } from "@/components/client/editable-lei";
import { EditableHeaderTitle } from "@/components/client/editable-header-title";
import { HeaderNavList } from "@/components/layout/HeaderNavList";
import { getLegalEntityTabs } from "@/config/navigation-tabs";
import { cn } from "@/lib/utils";

interface LegalEntityLayoutShellProps {
    children: React.ReactNode;
    baseBreadcrumbs: GuideBreadcrumbItem[];
    leId: string;
    leName: string;
    isSystemAdmin: boolean;
    leData?: any;
    clientOrgName?: string;
    canEdit?: boolean;
}


function InnerShell({ children, baseBreadcrumbs, leId, leName, isSystemAdmin, leData, clientOrgName, canEdit }: LegalEntityLayoutShellProps) {
    const { extraBreadcrumbs, pageTitle, pageTypeLabel, secondaryNav: contextSecondaryNav, isWide } = useBreadcrumbs();

    // Merge base breadcrumbs with extra breadcrumbs from context
    // Map icon names to actual Lucide icons if present
    const combinedBreadcrumbs = [...baseBreadcrumbs, ...extraBreadcrumbs].map((item: any) => ({
        ...item,
        icon: item.icon || (item.iconName ? getBreadcrumbIcon(item.iconName) : undefined)
    }));

    const leTabs = getLegalEntityTabs(leId);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50">
            <StandardPageHeader
                title={pageTitle || (canEdit ? <EditableHeaderTitle leId={leId} initialValue={leName} /> : leName)}
                typeLabel={pageTypeLabel || "Legal Entity"}
                breadcrumbs={combinedBreadcrumbs}
                actions={!pageTypeLabel ? <ClientLEActions leId={leId} leName={leName} isSystemAdmin={isSystemAdmin} /> : undefined}
                secondaryNav={contextSecondaryNav || <HeaderNavList items={leTabs} />}
            />
            <main className={cn(
                "flex-1 mx-auto w-full p-8 space-y-8",
                isWide ? "max-w-screen-2xl" : "max-w-6xl"
            )}>
                {leData && !pageTypeLabel && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
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
                                    officialName={leData.gleifData?.attributes?.entity?.legalName?.name}
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
    return <InnerShell {...props} />;
}
