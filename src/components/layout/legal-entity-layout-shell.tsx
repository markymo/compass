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
import { Fingerprint, CheckCircle, Pencil } from "lucide-react";

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
                title={
                    pageTitle ? (
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 truncate">
                            {pageTitle}
                        </h1>
                    ) : (
                        <div className="flex flex-col gap-1 min-w-0">
                            {/* Row 1: Name + LEI Metadata */}
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                {canEdit ? (
                                    <EditableHeaderTitle 
                                        leId={leId} 
                                        initialValue={leName} 
                                        isVerified={!!leData?.lei}
                                    />
                                ) : (
                                    <h1 className={cn(
                                        "text-2xl md:text-3xl font-bold tracking-tight truncate",
                                        leData?.lei ? "text-emerald-600" : "text-slate-900"
                                    )}>
                                        {leName}
                                    </h1>
                                )}
                                
                                <div className="shrink-0 flex items-center">
                                    <EditableLEI
                                        leId={leId}
                                        initialLei={leData.lei}
                                        initialFetchedAt={leData.gleifFetchedAt}
                                        officialName={leData.gleifData?.attributes?.entity?.legalName?.name}
                                        variant="minimal"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Description */}
                            <div className="max-w-4xl -mt-0.5">
                                <EditableDescription
                                    leId={leId}
                                    initialValue={leData?.description}
                                    leName={leName}
                                    clientOrgName={clientOrgName || "Client"}
                                />
                            </div>
                        </div>
                    )
                }
                typeLabel={pageTypeLabel || "Legal Entity"}
                breadcrumbs={combinedBreadcrumbs}
                actions={
                    <div className="flex items-center gap-4">
                        {!pageTypeLabel && leData && (
                            <DueDateBadge
                                id={leData.id}
                                date={leData.dueDate}
                                effectiveDate={leData.dueDate}
                                source="LE"
                                level="LE"
                                label="Deadline"
                            />
                        )}
                        <ClientLEActions 
                            leId={leId} 
                            leName={leName} 
                            isSystemAdmin={isSystemAdmin} 
                        />
                    </div>
                }
                secondaryNav={contextSecondaryNav || <HeaderNavList items={leTabs} />}
            />
            <main className={cn(
                "flex-1 mx-auto w-full p-8 space-y-8",
                isWide ? "max-w-screen-2xl" : "max-w-6xl"
            )}>
                {/* Content moved to Header */}

                {children}
            </main>
        </div>
    );
}

export function LegalEntityLayoutShell(props: LegalEntityLayoutShellProps) {
    return <InnerShell {...props} />;
}
