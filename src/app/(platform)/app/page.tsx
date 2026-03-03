"use client";

import { useEffect, useState, useMemo } from "react";
import { getUserContexts, DashboardContexts } from "@/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Loader2, Building2, Landmark, Gavel, ArrowRight, Home,
    ChevronDown, ChevronRight, FileText, Briefcase,
    Link as LinkIcon, Plus, Factory
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

const DASHBOARD_GRID = "grid-cols-[minmax(350px,1fr)_repeat(6,80px)]";

// ─── Reshaping Logic ─────────────────────────────────────────────────

function reshapeContexts(ctx: DashboardContexts): OrgNode[] {
    const nodes: OrgNode[] = [];

    // 1. Client orgs — children are LEs, each LE has engagements
    const sortedClients = [...ctx.clients].sort((a, b) => a.name.localeCompare(b.name));
    for (const client of sortedClients) {
        const les: OrgChild[] = ctx.legalEntities
            .filter(le => le.clientName === client.name)
            .map(le => {
                // Engagements for this specific LE
                const leEngagements = ctx.relationships
                    .filter(r => r.clientLEId === le.id && r.userIsClient)
                    .map(r => ({
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

    // 2. Supplier orgs (FI) — hierarchy: Supplier -> Client -> LE -> Questionnaires
    const sortedFIs = [...ctx.financialInstitutions].sort((a, b) => a.name.localeCompare(b.name));
    for (const fi of sortedFIs) {
        const clientEngagementMap = new Map<string, typeof ctx.relationships>();

        // Group relationships by Client
        ctx.relationships
            .filter(r => r.fiOrgId === fi.id)
            .forEach(r => {
                const clientId = r.clientId || r.clientName; // Fallback to name if ID missing
                if (!clientEngagementMap.has(clientId)) {
                    clientEngagementMap.set(clientId, []);
                }
                clientEngagementMap.get(clientId)!.push(r);
            });

        const clientNodes: OrgChild[] = Array.from(clientEngagementMap.entries()).map(([clientId, rels]) => {
            const clientName = rels[0].clientName;
            const clientMetrics = emptyMetrics();

            const leNodes: OrgChild[] = rels.map(r => {
                const questionnaires: OrgChild[] = (r.questionnaires || []).map(q => ({
                    type: "questionnaire" as const,
                    id: q.id,
                    name: q.name,
                    subtitle: `Last updated ${format(new Date(q.updatedAt), "dd MMM yy")}`,
                    status: q.status,
                    href: `/app/s/${fi.id}/engagements/${r.id}?q=${q.id}`,
                    metrics: emptyMetrics()
                }));

                // Rollup to client
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
                href: "#", // No specific client landing page for suppliers yet
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
    const sortedLawFirms = [...ctx.lawFirms].sort((a, b) => a.name.localeCompare(b.name));
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

// ─── Org Card Component ──────────────────────────────────────────────

function OrgCard({ org }: { org: OrgNode }) {
    if (org.orgType === "CLIENT" || org.orgType === "SUPPLIER") {
        return <ClientOrgCard org={org} />;
    }

    const [isOpen, setIsOpen] = useState(true);
    const meta = orgMeta[org.orgType];
    const Icon = meta.icon;

    const leCount = org.children.filter(c => c.type === "le").length;
    const engCount = org.children.filter(c => c.type === "engagement").length;

    const summaryParts: string[] = [];
    if (leCount > 0) summaryParts.push(`${leCount} Legal ${leCount === 1 ? "Entity" : "Entities"}`);
    if (engCount > 0) summaryParts.push(`${engCount} ${engCount === 1 ? "Engagement" : "Engagements"}`);
    const summary = summaryParts.join(" · ") || "No items";

    const roleBadge = org.role === "ORG_ADMIN" ? "Admin" :
        org.role === "ORG_MEMBER" ? "Member" :
            org.role === "DERIVED" ? "Derived" : org.role;

    const les = org.children.filter(c => c.type === "le");
    const engagements = org.children.filter(c => c.type === "engagement");

    return (
        <Card className={`${meta.borderColor} shadow-sm transition-all border`}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
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
                    <CardContent className="pt-0 pb-4">
                        {org.children.length === 0 ? (
                            <div className="text-sm text-muted-foreground italic py-4 text-center border-t border-dashed border-slate-200 mt-1">
                                No items yet
                            </div>
                        ) : (
                            <div className="space-y-3 border-t border-slate-100 pt-3">
                                {/* Legal Entities Section */}
                                {les.length > 0 && (
                                    <div>
                                        {engagements.length > 0 && (
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1">
                                                Legal Entities
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {les.map(child => (
                                                <ChildRow key={child.id} child={child} orgType={org.orgType} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Engagements Section */}
                                {engagements.length > 0 && (
                                    <div>
                                        {les.length > 0 && (
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-1 mt-4">
                                                Supplier Relationships
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {engagements.map(child => (
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

// ─── Client Org Card (Classic Style) ───────────────────────────────────

function ClientOrgCard({ org }: { org: OrgNode }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Card className="border-indigo-200 shadow-sm overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                {/* Header with Column Names */}
                <div className={cn(
                    "hidden md:grid items-center px-4 pt-2.5 pb-0.5 bg-slate-50 text-[9px] font-semibold text-slate-400 uppercase tracking-wider",
                    DASHBOARD_GRID
                )}>
                    <div className="pl-[44px]">Name</div>
                    {org.orgType === "CLIENT" ? (
                        <>
                            <div className="text-right pr-2">Total</div>
                            <div className="text-right pr-2">No Data</div>
                            <div className="text-right pr-2">Mapped</div>
                            <div className="text-right pr-2">Answered</div>
                            <div className="text-right pr-2">Approved</div>
                            <div className="text-right pr-2">Released</div>
                        </>
                    ) : (
                        <div className="col-span-6" />
                    )}
                </div>

                {/* Client Main Row */}
                <div className={cn(
                    "hidden md:grid items-center px-4 pt-0.5 pb-2.5 bg-slate-50 border-b border-slate-200",
                    DASHBOARD_GRID
                )}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
                                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            </Button>
                        </CollapsibleTrigger>
                        {org.orgType === "SUPPLIER" ? (
                            <Link href={`/app/s/${org.id}`} className="flex items-center gap-2 hover:underline group/org">
                                <Building2 className="h-4 w-4 shrink-0 transition-colors" style={{ color: "#0F766E" }} />
                                <span className="font-bold text-sm text-slate-900 truncate group-hover/org:text-[#0F766E] transition-colors">{org.name}</span>
                            </Link>
                        ) : (
                            <>
                                {org.orgType === "CLIENT" ? (
                                    <Factory className="h-4 w-4 shrink-0" style={{ color: "#4338CA" }} />
                                ) : (
                                    <Building2 className="h-4 w-4 shrink-0" style={{ color: "#0F766E" }} />
                                )}
                                <span className="font-bold text-sm text-slate-900 truncate">{org.name}</span>
                            </>
                        )}
                        <RoleBadge role={org.role} />
                    </div>
                    {org.orgType === "CLIENT" ? (
                        <>
                            <MetricCell value={org.metrics.total} />
                            <MetricCell value={org.metrics.noData} />
                            <MetricCell value={org.metrics.mapped} />
                            <MetricCell value={org.metrics.answered} />
                            <MetricCell value={org.metrics.approved} />
                            <MetricCell value={org.metrics.released} />
                        </>
                    ) : (
                        <>
                            <div /><div /><div /><div /><div />
                        </>
                    )}
                </div>

                {/* Mobile Client Header */}
                <div className="md:hidden px-4 py-3 bg-slate-50 border-b border-slate-200">
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
                                    <span className="font-bold text-sm text-slate-900">{org.name}</span>
                                </Link>
                            ) : (
                                <>
                                    {org.orgType === "CLIENT" ? (
                                        <Factory className="h-4 w-4" style={{ color: "#4338CA" }} />
                                    ) : (
                                        <Building2 className="h-4 w-4" style={{ color: "#64748b" }} />
                                    )}
                                    <span className="font-bold text-sm text-slate-900">{org.name}</span>
                                </>
                            )}
                        </div>
                        <RoleBadge role={org.role} />
                    </div>
                </div>

                <CollapsibleContent>
                    <div className="divide-y divide-slate-50">
                        {org.children.map(child => (
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
                level === 2 && "bg-slate-50/30"
            )}>
                <div className={cn(
                    "flex flex-wrap items-center gap-2 p-3 md:px-4 md:py-2 md:grid md:gap-0",
                    DASHBOARD_GRID
                )}>
                    <div className="flex items-center gap-2 overflow-hidden flex-1 md:flex-none" style={{ paddingLeft: `${(level - 1) * 24}px` }}>
                        <div className="w-8 flex justify-center shrink-0">
                            {hasChildren ? (
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-slate-200 shrink-0">
                                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    </Button>
                                </CollapsibleTrigger>
                            ) : (
                                <div className="w-4" />
                            )}
                        </div>

                        <RowIcon type={item.type.toUpperCase()} />

                        <Link href={item.href} className="truncate hover:underline hover:text-indigo-600 cursor-pointer text-sm font-medium" title={item.name}>
                            {item.name}
                        </Link>

                        <RoleBadge role={item.subtitle || ""} />

                        {item.type === "le" && orgType !== "SUPPLIER" && (
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-indigo-500 bg-indigo-50 hover:bg-indigo-100 cursor-pointer whitespace-nowrap shrink-0 ml-2">
                                <Plus className="h-2.5 w-2.5" /> Relationship
                            </span>
                        )}
                    </div>

                    <div className="hidden md:contents">
                        {item.type === "questionnaire" ? (
                            <div className="col-span-5" />
                        ) : (
                            <>
                                {orgType === "SUPPLIER" ? (
                                    <>
                                        <div /><div /><div /><div /><div /><div />
                                    </>
                                ) : (
                                    <>
                                        <MetricCell value={item.metrics.total} />
                                        <MetricCell value={item.metrics.noData} />
                                        <MetricCell value={item.metrics.mapped} />
                                        <MetricCell value={item.metrics.answered} />
                                        <MetricCell value={item.metrics.approved} />
                                        <MetricCell value={item.metrics.released} />
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {hasChildren && (
                    <CollapsibleContent>
                        {item.children?.map(child => (
                            <NestedTreeRow key={child.id} item={child} level={level + 1} orgType={orgType} />
                        ))}
                    </CollapsibleContent>
                )}
            </div>
        </Collapsible>
    );
}

function MetricCell({ value }: { value: number }) {
    return (
        <div className={cn(
            "text-right text-xs pr-2 font-mono",
            value === 0 ? "text-slate-300" : "text-slate-700 font-medium"
        )}>
            {value}
        </div>
    );
}

function RowIcon({ type }: { type: string }) {
    const t = type.toUpperCase();
    switch (t) {
        case "CLIENT": return <Factory className="h-4 w-4 shrink-0" style={{ color: "#4338CA" }} />;
        case "LE": return <Landmark className="h-4 w-4 shrink-0" style={{ color: "#8B3D88" }} />;
        case "ENGAGEMENT": return <LinkIcon className="h-3 w-3 shrink-0" style={{ color: "#D4A017" }} />;
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

    const label = role === "ADMIN_VISIBILITY" ? "Admin" : role.replace("_", " ");

    return (
        <Badge variant="outline" className={cn("text-[10px] font-normal px-1.5 py-0 h-4 uppercase tracking-tighter", colorClass)}>
            {label}
        </Badge>
    );
}

// ─── Child Row Component ─────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [contexts, setContexts] = useState<DashboardContexts | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await getUserContexts();
                setContexts(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const orgNodes = useMemo(() => {
        if (!contexts) return [];
        return reshapeContexts(contexts);
    }, [contexts]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
            </div>
        );
    }

    if (!contexts) {
        return <div className="p-8 text-center text-muted-foreground">Failed to load context.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-slate-100 rounded-xl">
                    <Home className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Universe</h1>
                    <p className="text-muted-foreground text-sm">Your organisations and workspaces</p>
                </div>
            </div>

            {/* Org Tree */}
            {orgNodes.length === 0 ? (
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
                    {orgNodes.map(org => (
                        <OrgCard key={org.id} org={org} />
                    ))}
                </div>
            )}

            {/* Footer link to Scout */}
            <div className="pt-4 border-t border-slate-100 text-center">
                <Link href="/app/scout" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    Switch to Scout view →
                </Link>
            </div>
        </div>
    );
}
