"use client";

import { useState, useMemo, useEffect } from "react";
import { DashboardContexts } from "@/actions/dashboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2, Landmark, Gavel, ChevronDown, ChevronRight,
    FileText, FileCheck, Briefcase, Factory, Loader2, HelpCircle
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Link from "next/link";
import { StandardTooltip } from "@/components/ui/standard-tooltip";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { OrgType, OrgChild, OrgNode, reshapeContexts } from "../dashboard-tree";
import { ExperimentalMetricSummary, MetricLinkContext } from "./experimental-metric-summary";

export interface ExperimentalDashboardContentProps {
    contexts: DashboardContexts;
}

const orgMeta: Record<OrgType, {
    icon: typeof Building2;
    label: string;
    primary: string;
    borderColor: string;
}> = {
    SUPPLIER: {
        icon: Building2,
        label: "Supplier",
        primary: "#0F766E",
        borderColor: "border-teal-100/80 hover:border-teal-200",
    },
    CLIENT: {
        icon: Factory,
        label: "Client",
        primary: "#4338CA",
        borderColor: "border-indigo-100/80 hover:border-indigo-200",
    },
    LAW_FIRM: {
        icon: Gavel,
        label: "Law Firm",
        primary: "#8B3D88",
        borderColor: "border-purple-100/80 hover:border-purple-200",
    },
    SYSTEM: {
        icon: Building2,
        label: "System",
        primary: "#475569",
        borderColor: "border-slate-100",
    },
};

export function ExperimentalDashboardContent({ contexts }: ExperimentalDashboardContentProps) {
    const { isLoading } = usePreferences();
    const orgNodes = useMemo(() => {
        if (!contexts) return [];
        return reshapeContexts(contexts);
    }, [contexts]);

    return (
        <div className="experimental-dashboard-wrapper min-h-[200px] space-y-5" data-testid="experimental-dashboard">
            {isLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-sm">Loading experimental homepage...</span>
                </div>
            ) : orgNodes.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-white rounded-full shadow-sm">
                            <Building2 className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No organisations found</h3>
                        <p className="text-slate-500 max-w-sm">
                            You aren't a member of any organisations yet.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    {orgNodes.map((org) => (
                        <ExperimentalOrgCard key={`${org.orgType}-${org.id}`} org={org} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ExperimentalOrgCard({ org }: { org: OrgNode }) {
    const { preferences, updatePreference } = usePreferences();
    const nodeKey = `org:${org.id}`;

    const isCollapsed = preferences.homePage?.collapsedTreeNodes?.[nodeKey] ?? false;
    const [isOpen, setIsOpen] = useState(!isCollapsed);

    useEffect(() => {
        setIsOpen(!isCollapsed);
    }, [isCollapsed]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        const currentCollapsedNodes = preferences.homePage?.collapsedTreeNodes || {};
        updatePreference("homePage", {
            collapsedTreeNodes: {
                ...currentCollapsedNodes,
                [nodeKey]: !open,
            },
        });
    };

    const meta = orgMeta[org.orgType];
    const Icon = meta.icon;
    const hasChildren = org.children && org.children.length > 0;

    return (
        <Card variant="structural" className={cn("shadow-xs overflow-hidden border bg-white", meta.borderColor)}>
            <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
                {/* 1. Section Header Row (Rendered ONCE per organization section) */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2 bg-slate-100/60 dark:bg-zinc-800/40 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2 min-w-0">
                        {hasChildren ? (
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200/60 rounded-md shrink-0">
                                    {isOpen ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        ) : (
                            <div className="w-6 shrink-0" />
                        )}
                        <Icon className="h-4 w-4 shrink-0" style={{ color: meta.primary }} />
                        <span className="truncate">{org.name}</span>
                        <Badge variant="outline" className="text-[9px] font-medium px-1 py-0 h-3.5 uppercase shrink-0">
                            {org.role}
                        </Badge>
                    </div>

                    {/* Section Metric Column Titles (2-Tier Header: Questions | Answers) */}
                    <div className="flex flex-col text-right shrink-0 space-y-1">
                        {/* Tier 1: Category Titles */}
                        <div className="grid grid-cols-[80px_324px] gap-2 text-[10px] font-bold uppercase tracking-wider">
                            <span className="pr-3 border-r border-slate-200/80 text-slate-400">Questions</span>
                            <span className="text-center text-slate-500 dark:text-zinc-400 border-b border-slate-200/80 pb-0.5">Answers</span>
                        </div>

                        {/* Tier 2: Sub-column Labels */}
                        <div className="grid grid-cols-[80px_80px_80px_75px_85px] gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider items-center">
                            <div className="pr-3 border-r border-slate-200/80 justify-end flex">
                                <StandardTooltip content="Total Questions / Questionnaires Count (e.g. 54/3 = 54 questions across 3 questionnaires)">
                                    <span className="font-bold text-slate-700 dark:text-zinc-300">
                                        Total
                                    </span>
                                </StandardTooltip>
                            </div>
                            <span>External</span>
                            <span>User Input</span>
                            <span>Default</span>
                            <span>Unanswered</span>
                        </div>
                    </div>
                </div>

                {/* 2. Org Summary Row (Org-level summary totals span multiple LEs, so metrics remain non-clickable) */}
                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0 pl-8">
                        {org.orgType === "SUPPLIER" ? (
                            <Link href={`/app/s/${org.id}`} className="font-semibold text-sm text-slate-900 hover:text-teal-700 truncate">
                                Organisation Totals
                            </Link>
                        ) : org.orgType === "CLIENT" ? (
                            <Link href={`/app/clients/${org.id}`} className="font-semibold text-sm text-slate-900 hover:text-indigo-700 truncate">
                                Organisation Totals
                            </Link>
                        ) : (
                            <span className="font-semibold text-sm text-slate-900 truncate">Organisation Totals</span>
                        )}
                    </div>

                    {/* V2 Metric Summary for Org (No linkContext: non-clickable) */}
                    <ExperimentalMetricSummary metrics={org.v2Metrics} />
                </div>

                {hasChildren && (
                    <CollapsibleContent>
                        <div className="divide-y divide-slate-100 bg-white">
                            {org.children.map((child) => (
                                <ExperimentalTreeNode key={child.id} item={child} level={1} />
                            ))}
                        </div>
                    </CollapsibleContent>
                )}
            </Collapsible>
        </Card>
    );
}

function ExperimentalTreeNode({ item, level }: { item: OrgChild; level: number }) {
    const { preferences, updatePreference } = usePreferences();
    const prefix = item.type === "client" ? "org" : item.type;
    const nodeKey = `${prefix}:${item.id}`;

    const defaultIsCollapsed = level >= 2;
    const isCollapsed = preferences.homePage?.collapsedTreeNodes?.[nodeKey] ?? defaultIsCollapsed;

    const [isOpen, setIsOpen] = useState(!isCollapsed);
    const hasChildren = item.children && item.children.length > 0;

    useEffect(() => {
        setIsOpen(!isCollapsed);
    }, [isCollapsed]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        const currentCollapsedNodes = preferences.homePage?.collapsedTreeNodes || {};
        updatePreference("homePage", {
            collapsedTreeNodes: {
                ...currentCollapsedNodes,
                [nodeKey]: !open,
            },
        });
    };

    // Determine linkContext for Workbench4 deep linking
    const linkContext = useMemo((): MetricLinkContext | undefined => {
        const leIdToUse = item.leId;
        if (!leIdToUse) return undefined;

        if (item.type === "le") {
            return { leId: leIdToUse };
        }
        if (item.type === "engagement") {
            return { leId: leIdToUse, relationshipId: item.id };
        }
        if (item.type === "questionnaire") {
            return { leId: leIdToUse, questionnaireId: item.id };
        }
        return undefined;
    }, [item.type, item.id, item.leId]);

    const isCQ = item.type === "questionnaire" && (item.subtitle === "Common Questionnaire" || item.name === "Common Questionnaires");

    return (
        <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
            <div
                className={cn(
                    "flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 transition-colors",
                    level > 1 && "bg-slate-50/20",
                    isCQ && "bg-slate-50/40"
                )}
            >
                <div
                    className="flex items-center gap-2.5 min-w-0"
                    style={{ paddingLeft: `${(level - 1) * 20}px` }}
                >
                    <div className="w-6 flex justify-center shrink-0">
                        {hasChildren ? (
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-slate-200/60 shrink-0">
                                    {isOpen ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        ) : (
                            <div className="w-3.5" />
                        )}
                    </div>

                    <ExperimentalRowIcon type={item.type} isCQ={isCQ} />

                    <Link
                        href={item.href}
                        className={cn(
                            "truncate hover:underline hover:text-indigo-600 text-sm font-medium",
                            isCQ ? "text-slate-900 font-semibold" : "text-slate-800"
                        )}
                        title={item.name}
                    >
                        {item.name}
                    </Link>

                    {item.subtitle && (
                        <span className="text-xs text-slate-400 truncate hidden sm:inline">
                            {item.subtitle}
                        </span>
                    )}
                </div>

                {/* V2 Metric Summary for child node with drill-down linkContext */}
                <ExperimentalMetricSummary metrics={item.v2Metrics} linkContext={linkContext} />
            </div>

            {hasChildren && (
                <CollapsibleContent>
                    <div className="divide-y divide-slate-100">
                        {item.children?.map((child) => (
                            <ExperimentalTreeNode key={child.id} item={child} level={level + 1} />
                        ))}
                    </div>
                </CollapsibleContent>
            )}
        </Collapsible>
    );
}

function ExperimentalRowIcon({ type, isCQ }: { type: string; isCQ?: boolean }) {
    if (isCQ) {
        return <FileCheck className="h-4 w-4 shrink-0 text-slate-600" />;
    }
    switch (type) {
        case "client":
            return <Factory className="h-4 w-4 shrink-0 text-indigo-600" />;
        case "le":
            return <Landmark className="h-4 w-4 shrink-0 text-slate-600" />;
        case "engagement":
            return <Briefcase className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
        case "questionnaire":
            return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
        default:
            return <div className="h-4 w-4" />;
    }
}
