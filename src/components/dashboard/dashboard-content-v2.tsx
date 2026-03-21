"use client";

import { useState, useMemo } from "react";
import { DashboardContexts } from "@/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Building2, Landmark, Gavel, ArrowRight,
    ChevronDown, ChevronRight, FileText, Briefcase,
    Factory
} from "lucide-react";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DashboardMetric, emptyMetrics, rollupMetrics } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────

type OrgType = "SUPPLIER" | "CLIENT" | "LAW_FIRM" | "SYSTEM";

interface OrgChild {
    type: "le" | "engagement" | "questionnaire" | "client";
    id: string;
    name: string;
    subtitle?: string;
    status?: string;
    href: string;
    metrics: DashboardMetric;
    children?: OrgChild[];
}

interface OrgNode {
    id: string;
    name: string;
    orgType: OrgType;
    role: string;
    source?: "DIRECT" | "DERIVED";
    metrics: DashboardMetric;
    children: OrgChild[];
}

// Increased spacing for the charts.
const DASHBOARD_GRID_V2 = "grid-cols-[minmax(350px,1fr)_60px_160px_160px_100px]";

// ─── Reshaping Logic ─────────────────────────────────────────────────

function reshapeContexts(ctx: DashboardContexts): OrgNode[] {
    const nodes: OrgNode[] = [];

    // 1. Client orgs
    const sortedClients = [...ctx.clients].sort((a: any, b: any) => a.name.localeCompare(b.name));
    for (const client of sortedClients) {
        const les: OrgChild[] = ctx.legalEntities
            .filter((le: any) => le.clientName === client.name)
            .map((le: any) => {
                const leEngagements = ctx.relationships
                    .filter((r: any) => r.clientLEId === le.id && r.userIsClient)
                    .map((r: any) => ({
                        type: "engagement" as const,
                        id: r.id,
                        name: r.supplierName,
                        status: r.status,
                        href: `/app/le/${r.clientLEId}/engagement-new/${r.id}`,
                        metrics: r.metrics
                    }));

                return {
                    type: "le" as const,
                    id: le.id,
                    name: le.name,
                    subtitle: le.role,
                    href: `/app/le/${le.id}`,
                    metrics: le.metrics,
                    children: leEngagements
                };
            });

        nodes.push({
            id: client.id,
            name: client.name,
            orgType: "CLIENT",
            role: client.role,
            source: client.source,
            metrics: client.metrics,
            children: les,
        });
    }

    // 2. Supplier orgs
    const sortedFIs = [...ctx.financialInstitutions].sort((a: any, b: any) => a.name.localeCompare(b.name));
    for (const fi of sortedFIs) {
        const clientEngagementMap = new Map<string, typeof ctx.relationships>();

        ctx.relationships
            .filter((r: any) => r.fiOrgId === fi.id)
            .forEach((r: any) => {
                const clientId = r.clientId || r.clientName;
                if (!clientEngagementMap.has(clientId)) {
                    clientEngagementMap.set(clientId, []);
                }
                clientEngagementMap.get(clientId)!.push(r);
            });

        const clientNodes: OrgChild[] = Array.from(clientEngagementMap.entries()).map(([clientId, rels]) => {
            const clientName = rels[0].clientName;
            const clientMetrics = emptyMetrics();

            const leNodes: OrgChild[] = rels.map((r: any) => {
                const questionnaires: OrgChild[] = (r.questionnaires || []).map((q: any) => ({
                    type: "questionnaire" as const,
                    id: q.id,
                    name: q.name,
                    subtitle: `Last updated ${format(new Date(q.updatedAt), "dd MMM yy")}`,
                    status: q.status,
                    href: `/app/s/${fi.id}/engagements/${r.id}?q=${q.id}`,
                    metrics: emptyMetrics()
                }));

                rollupMetrics(clientMetrics, r.metrics);

                return {
                    type: "le" as const,
                    id: r.id,
                    name: r.leName,
                    subtitle: "Engagement",
                    status: r.status,
                    href: `/app/s/${fi.id}/engagements/${r.id}`,
                    metrics: r.metrics,
                    children: questionnaires
                };
            });

            return {
                type: "client" as const,
                id: clientId,
                name: clientName,
                subtitle: "Client Organization",
                href: "#",
                metrics: clientMetrics,
                children: leNodes
            };
        });

        nodes.push({
            id: fi.id,
            name: fi.name,
            orgType: "SUPPLIER",
            role: fi.role,
            metrics: fi.metrics,
            children: clientNodes,
        });
    }

    // 3. Law firms
    const sortedLawFirms = [...ctx.lawFirms].sort((a: any, b: any) => a.name.localeCompare(b.name));
    for (const lf of sortedLawFirms) {
        nodes.push({
            id: lf.id,
            name: lf.name,
            orgType: "LAW_FIRM",
            role: lf.role,
            metrics: emptyMetrics(),
            children: [],
        });
    }

    return nodes;
}

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
    if (org.orgType === "CLIENT" || org.orgType === "SUPPLIER") {
        return <ClientOrgCard org={org} />;
    }

    const [isOpen, setIsOpen] = useState(true);
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
        <Card className={`${meta.borderColor} shadow-sm transition-all border`}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                    {isOpen
                                        ? <ChevronDown className="h-5 w-5 text-slate-400" />
                                        : <ChevronRight className="h-5 w-5 text-slate-400" />}
                                </Button>
                            </CollapsibleTrigger>
                            <div className="p-2.5 rounded-xl border border-white" style={{ backgroundColor: meta.soft }}>
                                <Icon className="h-5 w-5" style={{ color: meta.primary }} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <CardTitle className="text-lg">{org.name}</CardTitle>
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
                    <CardContent className="pt-0 pb-4 bg-white rounded-b-xl">
                        {org.children.length === 0 ? (
                            <div className="text-sm text-muted-foreground italic py-4 text-center border-t border-dashed border-slate-200 mt-1">
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
    const [isOpen, setIsOpen] = useState(true);
    const meta = orgMeta[org.orgType];

    return (
        <Card className={cn("shadow-sm overflow-hidden", meta.borderColor)}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                {/* 2-Tier Header Row */}
                <div className={cn(
                    "hidden md:grid items-end px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-200",
                    DASHBOARD_GRID_V2
                )}>
                    {/* 1. Entity Col Header */}
                    <div className="pl-[28px]">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entity & Relationships</span>
                    </div>

                    {/* 2. Anchor (Total) */}
                    <div className="text-center pb-0.5">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total</span>
                    </div>

                    {/* 3. Sourcing Group */}
                    <div className="flex flex-col border-l border-slate-200 pl-4 h-full">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-[2px]">Data Sourcing</span>
                        <div className="flex justify-between pr-4 items-end">
                            <span className="text-[10px] font-bold text-sky-600 uppercase">Mapped</span>
                        </div>
                    </div>
                    
                    {/* 4. Completion Group */}
                    <div className="flex flex-col border-l border-slate-200 pl-4 h-full">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-[2px]">Completion</span>
                        <div className="flex justify-between pr-4 items-end">
                            <span className="text-[10px] font-bold text-amber-600 uppercase">Answered</span>
                        </div>
                    </div>

                    {/* 5. Workflow Group */}
                    <div className="flex flex-col border-l border-slate-200 pl-4 h-full">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-[2px]">Sign-Off</span>
                        <div className="flex justify-between pr-2 items-end">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase">APPR</span>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">RLSD</span>
                        </div>
                    </div>
                </div>

                {/* Organization Anchor Row */}
                <div className={cn(
                    "hidden md:grid items-center px-4 py-3 bg-white border-b border-slate-100",
                    DASHBOARD_GRID_V2
                )}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100 rounded-md shrink-0">
                                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </Button>
                        </CollapsibleTrigger>
                        {org.orgType === "SUPPLIER" ? (
                            <Link href={`/app/s/${org.id}`} className="flex items-center gap-2 hover:underline group/org">
                                <Building2 className="h-4 w-4 shrink-0 transition-colors" style={{ color: "#0F766E" }} />
                                <span className="font-bold text-[15px] text-slate-900 truncate group-hover/org:text-[#0F766E] transition-colors">{org.name}</span>
                            </Link>
                        ) : org.orgType === "CLIENT" ? (
                            <Link href={`/app/clients/${org.id}`} className="flex items-center gap-2 hover:underline group/org">
                                <Factory className="h-4 w-4 shrink-0 transition-colors" style={{ color: "#4338CA" }} />
                                <span className="font-bold text-[15px] text-slate-900 truncate group-hover/org:text-[#4338CA] transition-colors">{org.name}</span>
                            </Link>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 shrink-0" style={{ color: "#0F766E" }} />
                                <span className="font-bold text-[15px] text-slate-900 truncate">{org.name}</span>
                            </div>
                        )}
                        <RoleBadge role={org.role} />
                    </div>

                    <>
                        {/* Anchor Total */}
                        <div className="text-center font-bold text-slate-700 text-[15px]">
                            {org.metrics.total}
                        </div>

                        {/* Chart: Sourcing */}
                        <div className="border-l border-slate-100 pl-4 flex items-center h-full text-sky-500">
                            <MicroChart value={org.metrics.mapped} total={org.metrics.total} colorClass="text-sky-500" emptyClass="bg-slate-100" numeratorLabel="Mapped" denominatorLabel="Unmapped" />
                        </div>

                        {/* Chart: Completion */}
                        <div className="border-l border-slate-100 pl-4 flex items-center h-full text-amber-500">
                            <MicroChart value={org.metrics.answered} total={org.metrics.total} colorClass="text-amber-500" emptyClass="bg-slate-100" numeratorLabel="Answered" denominatorLabel="Blank" />
                        </div>

                        {/* Sign-off Fractions */}
                        <div className="border-l border-slate-100 pl-4 pr-1 flex items-center justify-between h-full">
                             <div className="flex items-baseline gap-0.5">
                                 <span className={cn("text-[13px] font-bold font-mono", org.metrics.approved > 0 ? "text-indigo-600" : "text-slate-300")}>{org.metrics.approved}</span>
                             </div>
                             <div className="flex items-baseline gap-0.5">
                                 <span className={cn("text-[13px] font-bold font-mono", org.metrics.released > 0 ? "text-emerald-600" : "text-slate-300")}>{org.metrics.released}</span>
                             </div>
                        </div>
                    </>
                </div>

                {/* Mobile Client Header */}
                <div className="md:hidden px-4 py-3 bg-white border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                </Button>
                            </CollapsibleTrigger>
                            {org.orgType === "SUPPLIER" ? (
                                <Link href={`/app/s/${org.id}`} className="flex items-center gap-2 hover:underline">
                                    <Building2 className="h-4 w-4" style={{ color: "#0F766E" }} />
                                    <span className="font-bold text-[15px] text-slate-900">{org.name}</span>
                                </Link>
                            ) : org.orgType === "CLIENT" ? (
                                <Link href={`/app/clients/${org.id}`} className="flex items-center gap-2 hover:underline">
                                    <Factory className="h-4 w-4" style={{ color: "#4338CA" }} />
                                    <span className="font-bold text-[15px] text-slate-900">{org.name}</span>
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" style={{ color: "#64748b" }} />
                                    <span className="font-bold text-[15px] text-slate-900">{org.name}</span>
                                </div>
                            )}
                        </div>
                        <RoleBadge role={org.role} />
                    </div>
                </div>

                <CollapsibleContent>
                    <div className="divide-y divide-slate-50 bg-white">
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
    const [isOpen, setIsOpen] = useState(level < 2);
    const hasChildren = item.children && item.children.length > 0;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className={cn(
                "group hover:bg-slate-50/50 transition-colors",
                level === 1 && "bg-white",
                level === 2 && "bg-slate-50/30",
                level > 2 && "bg-slate-50"
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
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-slate-200 shrink-0">
                                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                                    </Button>
                                </CollapsibleTrigger>
                            ) : (
                                <div className="w-4" />
                            )}
                        </div>

                        <RowIcon type={item.type.toUpperCase()} />

                        <Link href={item.href} className="truncate hover:underline hover:text-indigo-600 cursor-pointer text-[13.5px] font-medium text-slate-800" title={item.name}>
                            {item.name}
                        </Link>

                        <RoleBadge role={item.subtitle || ""} />
                    </div>

                    <div className="hidden md:contents">
                        {item.type === "questionnaire" || item.metrics.total === 0 ? (
                            <div className="col-span-4" />
                        ) : (
                            <>
                                {/* Total Label */}
                                <div className="text-center font-bold text-slate-700 text-sm">
                                    {item.metrics.total}
                                </div>
                                {/* Mapped Chart */}
                                <div className="border-l border-slate-100 pl-4 flex items-center h-full text-sky-500 opacity-90">
                                    <MicroChart value={item.metrics.mapped} total={item.metrics.total} colorClass="text-sky-500" emptyClass="bg-slate-100" numeratorLabel="Mapped" denominatorLabel="Unmapped" />
                                </div>
                                {/* Answered Chart */}
                                <div className="border-l border-slate-100 pl-4 flex items-center h-full text-amber-500 opacity-90">
                                    <MicroChart value={item.metrics.answered} total={item.metrics.total} colorClass="text-amber-500" emptyClass="bg-slate-100" numeratorLabel="Answered" denominatorLabel="Blank" />
                                </div>
                                {/* Signoff Fractions */}
                                <div className="border-l border-slate-100 pl-4 pr-1 flex items-center justify-between h-full opacity-90">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={cn("text-xs font-bold font-mono", item.metrics.approved > 0 ? "text-indigo-600" : "text-slate-300")}>{item.metrics.approved}</span>
                                    </div>
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={cn("text-xs font-bold font-mono", item.metrics.released > 0 ? "text-emerald-600" : "text-slate-300")}>{item.metrics.released}</span>
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

// ─── Child Row Component (Fallback for generic views) ────────────────
function ChildRow({ child, orgType }: { child: OrgChild; orgType: OrgType }) {
    const isEngagement = child.type === "engagement";

    return (
        <Link href={child.href} className="block">
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
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
            </div>
        </Link>
    );
}

export function DashboardContentV2({ contexts }: { contexts: DashboardContexts }) {
    const orgNodes = useMemo(() => {
        if (!contexts) return [];
        return reshapeContexts(contexts);
    }, [contexts]);

    if (orgNodes.length === 0) {
        return (
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
        );
    }

    return (
        <div className="space-y-6">
            {orgNodes.map((org: any) => (
                <OrgCard key={org.id} org={org} />
            ))}
        </div>
    );
}
