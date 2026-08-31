"use client";

import { useState, useMemo, useEffect } from "react";
import { DashboardContexts } from "@/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2, Landmark, Gavel, ArrowRight,
    ChevronDown, ChevronRight, FileText, Briefcase,
    Factory, Loader2
} from "lucide-react";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DashboardMetric, emptyMetrics, rollupMetrics } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { usePreferences } from "@/components/providers/user-preferences-provider";

import { OrgType, OrgChild, OrgNode, reshapeContexts } from "./dashboard-tree";

// Increased spacing for the charts.
const DASHBOARD_GRID_V2 = "grid-cols-[minmax(350px,1fr)_60px_160px_160px_150px]";

// ─── Org Type Styling ────────────────────────────────────────────────

const orgMeta: Record<OrgType, {
    icon: typeof Building2;
    label: string;
    primary: string;
    hover: string;
    soft: string;
    borderColor: string;
}> = {
    SUPPLIER: {
        icon: Building2,
        label: "Supplier",
        primary: "#0F766E",
        hover: "#0D5F59",
        soft: "#E6F4F3",
        borderColor: "border-teal-100 hover:border-teal-200",
    },
    CLIENT: {
        icon: Factory,
        label: "Client",
        primary: "#4338CA",
        hover: "#3730A3",
        soft: "#EEF2FF",
        borderColor: "border-indigo-100 hover:border-indigo-200",
    },
    LAW_FIRM: {
        icon: Gavel,
        label: "Law Firm",
        primary: "#8B3D88",
        hover: "#742F72",
        soft: "#F5E9F4",
        borderColor: "border-purple-100 hover:border-purple-200",
    },
    SYSTEM: {
        icon: Building2,
        label: "System",
        primary: "#475569",
        hover: "#334155",
        soft: "#F1F5F9",
        borderColor: "border-slate-100",
    },
};

// ─── Atoms & Progress Charts ─────────────────────────────────────────

function MicroChart({ value, total, colorClass, emptyClass, numeratorLabel, denominatorLabel }: { value: number, total: number, colorClass: string, emptyClass: string, numeratorLabel: string, denominatorLabel: string }) {
    if (total === 0) {
        return <div className="text-xs text-slate-300 h-full w-full flex items-center justify-center italic">No data</div>;
    }
    
    const percent = Math.min(100, Math.max(0, (value / total) * 100));
    
    return (
        <div className="flex flex-col gap-1.5 w-full pr-4">
            <div className="flex justify-between items-baseline leading-none">
                <span className={cn("text-xs font-bold font-mono", percent > 0 ? colorClass : "text-slate-300")}>
                    {value}
                </span>
                <span className="text-[10px] text-slate-400 font-medium font-mono">
                    {(total - value)} {denominatorLabel}
                </span>
            </div>
            <div className={cn("h-1.5 w-full rounded-full overflow-hidden flex", emptyClass)}>
                <div className={cn("h-full transition-all duration-500")} style={{ width: `${percent}%`, backgroundColor: 'currentColor' }} />
            </div>
        </div>
    );
}

// ─── Org Card Component ──────────────────────────────────────────────

function OrgCard({ org }: { org: OrgNode }) {
    const { preferences, updatePreference } = usePreferences();
    const nodeKey = `org:${org.id}`;
    
    // Default: OrgCard defaults open (collapsed = false)
    const isCollapsed = preferences.homePage?.collapsedTreeNodes?.[nodeKey] ?? false;
    const [isOpen, setIsOpen] = useState(!isCollapsed);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        const newCollapsed = !open;
        const currentCollapsedNodes = preferences.homePage?.collapsedTreeNodes || {};
        
        updatePreference("homePage", {
            collapsedTreeNodes: {
                ...currentCollapsedNodes,
                [nodeKey]: newCollapsed
            }
        });
    };

    if (org.orgType === "CLIENT" || org.orgType === "SUPPLIER") {
        return <ClientOrgCard org={org} />;
    }

    const meta = orgMeta[org.orgType];
    const Icon = meta.icon;

    const leCount = org.children.filter((c: any) => c.type === "le").length;
    const engCount = org.children.filter((c: any) => c.type === "engagement").length;

    const summaryParts: string[] = [];
    if (leCount > 0) summaryParts.push(`${leCount} Legal ${leCount === 1 ? "Entity" : "Entities"}`);
    if (engCount > 0) summaryParts.push(`${engCount} ${engCount === 1 ? "Engagement" : "Engagements"}`);
    const summary = summaryParts.join(" · ") || "No items";

    const roleBadge = org.role;
    const les = org.children.filter((c: any) => c.type === "le");
    const engagements = org.children.filter((c: any) => c.type === "engagement");

    return (
        <Card variant="structural" className={`${meta.borderColor} shadow-sm transition-all border bg-card text-card-foreground`}>
            <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
                <CardHeader className="pb-3 bg-card text-card-foreground">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                    {isOpen
                                        ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                </Button>
                            </CollapsibleTrigger>
                            <div className="p-2.5 rounded-xl border border-border" style={{ backgroundColor: meta.soft }}>
                                <Icon className="h-5 w-5" style={{ color: meta.primary }} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <CardTitle className="text-lg text-foreground">{org.name}</CardTitle>
                                    <Badge variant="outline" className="text-[10px] h-5 font-medium border" style={{ backgroundColor: meta.soft, color: meta.primary, borderColor: `${meta.primary}20` }}>
                                        {meta.label}
                                    </Badge>
                                </div>
                                <CardDescription className="mt-0.5">
                                    {summary}
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="secondary" className="text-xs font-medium">
                            {roleBadge}
                        </Badge>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 bg-card text-card-foreground rounded-b-md">
                        {org.children.length === 0 ? (
                            <div className="text-sm text-muted-foreground italic py-4 text-center border-t border-dashed border-border mt-1">
                                No items yet
                            </div>
                        ) : (
                            <div className="space-y-3 border-t border-slate-100 pt-3">
                                {les.length > 0 && (
                                    <div>
                                        {engagements.length > 0 && (
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">
                                                Legal Entities
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {les.map((child: any) => (
                                                <ChildRow key={child.id} child={child} orgType={org.orgType} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {engagements.length > 0 && (
                                    <div>
                                        {les.length > 0 && (
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1 mt-4">
                                                Supplier Relationships
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {engagements.map((child: any) => (
                                                <ChildRow key={child.id} child={child} orgType={org.orgType} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

// ─── Client Org Card (New V2 Style) ───────────────────────────────────

function ClientOrgCard({ org }: { org: OrgNode }) {
    const { preferences, updatePreference } = usePreferences();
    const nodeKey = `org:${org.id}`;
    
    // Default: OrgCard (ClientOrgCard) defaults open (collapsed = false)
    const isCollapsed = preferences.homePage?.collapsedTreeNodes?.[nodeKey] ?? false;
    const [isOpen, setIsOpen] = useState(!isCollapsed);

    // Sync local state when preferences load asynchronously
    useEffect(() => {
        setIsOpen(!isCollapsed);
    }, [isCollapsed]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        const newCollapsed = !open;
        const currentCollapsedNodes = preferences.homePage?.collapsedTreeNodes || {};
        
        updatePreference("homePage", {
            collapsedTreeNodes: {
                ...currentCollapsedNodes,
                [nodeKey]: newCollapsed
            }
        });
    };

    const meta = orgMeta[org.orgType];

    return (
        <Card variant="structural" className={cn("shadow-sm overflow-hidden", meta.borderColor)}>
            <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
                {/* 2-Tier Header Row */}
                <div className={cn(
                    "hidden md:grid items-end px-4 pt-4 pb-2 bg-muted/50 border-b border-border text-foreground",
                    DASHBOARD_GRID_V2
                )}>
                    {/* 1. Entity Col Header */}
                    <div className="flex flex-col justify-end">
                        <div className="flex items-center gap-2 mb-3 -ml-1">
                            {org.orgType === "SUPPLIER" ? (
                                <Link href={`/app/s/${org.id}`} className="flex items-center gap-2 hover:underline group/org px-1">
                                    <Building2 className="h-5 w-5 shrink-0 transition-colors" style={{ color: "#0F766E" }} />
                                    <h2 className="text-[17px] font-bold text-foreground truncate group-hover/org:text-[#0F766E] transition-colors tracking-tight">{org.name}</h2>
                                </Link>
                            ) : org.orgType === "CLIENT" ? (
                                <Link href={`/app/clients/${org.id}`} className="flex items-center gap-2 hover:underline group/org px-1">
                                    <Factory className="h-5 w-5 shrink-0 transition-colors" style={{ color: "#4338CA" }} />
                                    <h2 className="text-[17px] font-bold text-foreground truncate group-hover/org:text-[#4338CA] transition-colors tracking-tight">{org.name}</h2>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2 px-1">
                                    <Building2 className="h-5 w-5 shrink-0" style={{ color: "#0F766E" }} />
                                    <h2 className="text-[17px] font-bold text-foreground truncate tracking-tight">{org.name}</h2>
                                </div>
                            )}
                            <RoleBadge role={org.role} />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-[28px]">Entity Relationships</span>
                    </div>

                    {/* 2. Anchor (Total) */}
                    <div className="text-center pb-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                    </div>

                    {/* 3. Sourcing Group */}
                    <div className="flex flex-col border-l border-border pl-4 h-full">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-[2px]">Data Sourcing</span>
                        <div className="flex justify-between pr-4 items-end">
                            <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 uppercase">Mapped</span>
                        </div>
                    </div>
                    
                    {/* 4. Completion Group */}
                    <div className="flex flex-col border-l border-border pl-4 h-full">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-[2px]">Completion</span>
                        <div className="flex justify-between pr-4 items-end">
                            <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase">Answered</span>
                        </div>
                    </div>

                    {/* 5. Workflow Group */}
                    <div className="flex flex-col border-l border-border pl-4 h-full">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-[2px]">Sign-Off</span>
                        <div className="flex justify-between pr-2 items-end">
                            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase">Approved</span>
                            <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase">Released</span>
                        </div>
                    </div>
                </div>

                {/* Organization Anchor Row */}
                <div className={cn(
                    "hidden md:grid items-center px-4 py-3 bg-card border-b border-border text-card-foreground",
                    DASHBOARD_GRID_V2
                )}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted rounded-md shrink-0">
                                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                        </CollapsibleTrigger>
                        <span className="font-semibold text-[13.5px] text-secondary-foreground truncate cursor-pointer hover:text-foreground transition-colors" onClick={() => setIsOpen(!isOpen)}>
                            Organisation Totals
                        </span>
                    </div>

                    <>
                        {/* Anchor Total */}
                        <div className="text-center font-bold text-foreground text-[15px]">
                            {org.metrics.total}
                        </div>

                        {/* Chart: Sourcing */}
                        <div className="border-l border-border pl-4 flex items-center h-full text-sky-500">
                            <MicroChart value={org.metrics.mapped} total={org.metrics.total} colorClass="text-sky-500 dark:text-sky-400" emptyClass="bg-muted" numeratorLabel="Mapped" denominatorLabel="Unmapped" />
                        </div>

                        {/* Chart: Completion */}
                        <div className="border-l border-border pl-4 flex items-center h-full text-amber-500">
                            <MicroChart value={org.metrics.answered} total={org.metrics.total} colorClass="text-amber-500 dark:text-amber-400" emptyClass="bg-muted" numeratorLabel="Answered" denominatorLabel="Blank" />
                        </div>

                        {/* Sign-off Fractions */}
                        <div className="border-l border-border pl-4 pr-1 flex items-center justify-between h-full">
                             <div className="flex items-baseline gap-0.5">
                                 <span className={cn("text-[13px] font-bold font-mono", org.metrics.approved > 0 ? "text-indigo-500 dark:text-indigo-400" : "text-muted-foreground/40")}>{org.metrics.approved}</span>
                             </div>
                             <div className="flex items-baseline gap-0.5">
                                 <span className={cn("text-[13px] font-bold font-mono", org.metrics.released > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/40")}>{org.metrics.released}</span>
                             </div>
                        </div>
                    </>
                </div>

                {/* Mobile Client Header */}
                <div className="md:hidden px-4 py-3 bg-card border-b border-border text-card-foreground">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                            </CollapsibleTrigger>
                            {org.orgType === "SUPPLIER" ? (
                                <Link href={`/app/s/${org.id}`} className="flex items-center gap-2 hover:underline">
                                    <Building2 className="h-4 w-4" style={{ color: "#0F766E" }} />
                                    <span className="font-bold text-[15px] text-foreground">{org.name}</span>
                                </Link>
                            ) : org.orgType === "CLIENT" ? (
                                <Link href={`/app/clients/${org.id}`} className="flex items-center gap-2 hover:underline">
                                    <Factory className="h-4 w-4" style={{ color: "#4338CA" }} />
                                    <span className="font-bold text-[15px] text-foreground">{org.name}</span>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" style={{ color: "#64748b" }} />
                                    <span className="font-bold text-[15px] text-foreground">{org.name}</span>
                                </div>
                            )}
                        </div>
                        <RoleBadge role={org.role} />
                    </div>
                </div>

                <CollapsibleContent>
                    <div className="divide-y divide-border bg-card text-card-foreground">
                        {org.children.map((child: any) => (
                            <NestedTreeRow key={child.id} item={child} level={1} orgType={org.orgType} />
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

function NestedTreeRow({ item, level, orgType }: { item: OrgChild; level: number; orgType: OrgType }) {
    const { preferences, updatePreference } = usePreferences();
    
    // Stable key mapping
    const prefix = item.type === 'client' ? 'org' : item.type;
    const nodeKey = `${prefix}:${item.id}`;
    
    // Default: NestedTreeRow defaults open if level < 2
    const defaultIsCollapsed = level >= 2;
    const isCollapsed = preferences.homePage?.collapsedTreeNodes?.[nodeKey] ?? defaultIsCollapsed;
    
    const [isOpen, setIsOpen] = useState(!isCollapsed);
    const hasChildren = item.children && item.children.length > 0;

    // Sync local state when preferences load asynchronously
    useEffect(() => {
        setIsOpen(!isCollapsed);
    }, [isCollapsed]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        const newCollapsed = !open;
        const currentCollapsedNodes = preferences.homePage?.collapsedTreeNodes || {};
        
        updatePreference("homePage", {
            collapsedTreeNodes: {
                ...currentCollapsedNodes,
                [nodeKey]: newCollapsed
            }
        });
    };

    return (
        <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
            <div className={cn(
                "group hover:bg-muted/40 transition-colors",
                level === 1 && "bg-card text-card-foreground",
                level === 2 && "bg-muted/20 text-card-foreground",
                level > 2 && "bg-muted/40 text-card-foreground"
            )}>
                <div className={cn(
                    "flex flex-wrap items-center gap-2 p-3 md:px-4 md:py-[10px] md:grid md:gap-0",
                    DASHBOARD_GRID_V2
                )}>
                    {/* Entity Details */}
                    <div className="flex items-center gap-2 overflow-hidden flex-1 md:flex-none" style={{ paddingLeft: `${(level - 1) * 24}px` }}>
                        <div className="w-8 flex justify-center shrink-0">
                            {hasChildren ? (
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-muted shrink-0">
                                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                    </Button>
                                </CollapsibleTrigger>
                            ) : (
                                <div className="w-4" />
                            )}
                        </div>

                        {item.href && item.href !== "#" ? (
                            <Link href={item.href} className="truncate hover:underline hover:text-indigo-500 cursor-pointer text-[13.5px] font-medium text-foreground" title={item.name}>
                                {item.name}
                            </Link>
                        ) : (
                            <span className="truncate text-[13.5px] font-medium text-foreground" title={item.name}>
                                {item.name}
                            </span>
                        )}

                        <RoleBadge role={item.subtitle || ""} />
                    </div>

                    <div className="hidden md:contents">
                        {item.type === "questionnaire" || item.metrics.total === 0 ? (
                            <div className="col-span-4" />
                        ) : (
                            <>
                                {/* Total Label */}
                                <div className="text-center font-bold text-foreground text-sm">
                                    {item.metrics.total}
                                </div>
                                {/* Mapped Chart */}
                                <div className="border-l border-border pl-4 flex items-center h-full text-sky-500 opacity-90">
                                    <MicroChart value={item.metrics.mapped} total={item.metrics.total} colorClass="text-sky-500 dark:text-sky-400" emptyClass="bg-muted" numeratorLabel="Mapped" denominatorLabel="Unmapped" />
                                </div>
                                {/* Answered Chart */}
                                <div className="border-l border-border pl-4 flex items-center h-full text-amber-500 opacity-90">
                                    <MicroChart value={item.metrics.answered} total={item.metrics.total} colorClass="text-amber-500 dark:text-amber-400" emptyClass="bg-muted" numeratorLabel="Answered" denominatorLabel="Blank" />
                                </div>
                                {/* Signoff Fractions */}
                                <div className="border-l border-border pl-4 pr-1 flex items-center justify-between h-full opacity-90">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={cn("text-xs font-bold font-mono", item.metrics.approved > 0 ? "text-indigo-500 dark:text-indigo-400" : "text-muted-foreground/40")}>{item.metrics.approved}</span>
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={cn("text-xs font-bold font-mono", item.metrics.released > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/40")}>{item.metrics.released}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {hasChildren && (
                    <CollapsibleContent>
                        {item.children?.map((child: any) => (
                            <NestedTreeRow key={child.id} item={child} level={level + 1} orgType={orgType} />
                        ))}
                    </CollapsibleContent>
                )}
            </div>
        </Collapsible>
    );
}

function RowIcon({ type }: { type: string }) {
    const t = type.toUpperCase();
    switch (t) {
        case "CLIENT": return <Factory className="h-4 w-4 shrink-0" style={{ color: "#4338CA" }} />;
        case "LE": return <Landmark className="h-4 w-4 shrink-0 text-slate-600" />;
        case "ENGAGEMENT": return <Briefcase className="h-[14px] w-[14px] shrink-0 text-emerald-600" />;
        case "QUESTIONNAIRE": return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
        default: return <div className="h-4 w-4" />;
    }
}

function RoleBadge({ role }: { role: string }) {
    if (!role || role === "NO_ACCESS") return null;

    let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
    if (["ADMIN", "ORG_ADMIN", "CLIENT_ADMIN", "LE_ADMIN", "ADMIN_VISIBILITY"].includes(role)) {
        colorClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
    }

    const label = role === "ADMIN_VISIBILITY" ? "ORG_ADMIN (NO DATA ACCESS)" : role;

    return (
        <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0 h-[18px] uppercase tracking-tighter shrink-0", colorClass)}>
            {label}
        </Badge>
    );
}

function ChildRow({ child, orgType }: { child: OrgChild; orgType: OrgType }) {
    const isEngagement = child.type === "engagement";

    const content = (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 group transition-colors cursor-pointer">
            <div className={`p-1.5 rounded-md ${isEngagement ? "bg-emerald-50" : "bg-slate-100"}`}>
                {isEngagement
                    ? <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                    : <FileText className="h-3.5 w-3.5 text-slate-500" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                        {child.name}
                    </span>
                    {child.status && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal bg-slate-50 text-slate-500 shrink-0">
                            {child.status}
                        </Badge>
                    )}
                </div>
                {child.subtitle && (
                    <span className="text-xs text-slate-400 truncate block">
                        {child.subtitle}
                    </span>
                )}
            </div>
            {child.href && <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />}
        </div>
    );

    if (child.href && child.href !== "#") {
        return (
            <Link href={child.href} className="block">
                {content}
            </Link>
        );
    }

    return <div className="block">{content}</div>;
}

export function DashboardContentV2({ contexts }: { contexts: DashboardContexts }) {
    const { isLoading } = usePreferences();
    const orgNodes = useMemo(() => {
        if (!contexts) return [];
        return reshapeContexts(contexts);
    }, [contexts]);

    return (
        <div className="dashboard-content-wrapper min-h-[200px]">
            {isLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-sm">Loading dashboard...</span>
                </div>
            ) : orgNodes.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-xl bg-slate-50/50">
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-white rounded-full shadow-sm">
                            <Building2 className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No organisations found</h3>
                        <p className="text-slate-500 max-w-sm">
                            You aren't a member of any organisations yet. Contact your administrator to get started.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {orgNodes.map((org: any) => (
                        <OrgCard key={`${org.orgType}-${org.id}`} org={org} />
                    ))}
                </div>
            )}
        </div>
    );
}
