"use client";

import { useState } from "react";
import { TreeItemFn, DashboardMetric } from "@/actions/dashboard-tree";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ChevronRight,
    ChevronDown,
    Building2,
    Briefcase,
    Link as LinkIcon,
    Settings,
    Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

interface DashboardTreeProps {
    items: TreeItemFn[];
}

export function DashboardTree({ items }: DashboardTreeProps) {
    if (items.length === 0) {
        return <div className="p-8 text-center text-slate-500 italic">No access found.</div>;
    }

    return (
        <div className="space-y-8">
            {items.map(item => (
                <ClientSection key={item.id} item={item} />
            ))}
        </div>
    );
}

function ClientSection({ item }: { item: TreeItemFn }) {
    // Determine headers based on desktop grid
    // Grid: [Name(1fr) Role(100px) ...metrics(9x80px)]
    return (
        <div className="border rounded-xl bg-white shadow-sm dark:bg-slate-950 dark:border-slate-800 overflow-hidden">
            {/* Desktop Header - Hidden on Mobile */}
            <div className="hidden md:grid grid-cols-[minmax(350px,1fr)_100px_repeat(9,80px)] items-center px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:bg-slate-900 dark:border-slate-800">
                <div>{item.name}</div>
                <div>Role</div>
                <div className="text-right">No Data</div>
                <div className="text-right">Prepop</div>
                <div className="text-right">System</div>
                <div className="text-right">Drafted</div>
                <div className="text-right">Approved</div>
                <div className="text-right">Released</div>
                <div className="text-right">Ack</div>
                <div className="text-right">Last Edit</div>
                <div className="text-right">Target</div>
            </div>

            {/* Mobile Header - Just the Client Name */}
            <div className="md:hidden px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 dark:bg-slate-900 dark:border-slate-800">
                {item.name}
            </div>

            {/* Tree Rows (Starting with the Client Itself? Or just children? 
               Usually the "Section" IS the Client. So we should render the Client Row first? 
               actually, if the section is the client, maybe we just render items.
               Wait, the previous logic rendered the Client AS a row. 
               Let's keep rendering the Client as a row, but inside this wrapper?
               OR, if the section header IS the client info, we might duplicate.
               
               Let's stick to the previous recursion: <TreeRow item={item} />
               But visually, we want the Client Row to look like the "Root".
            */}
            <TreeRow item={item} level={0} isRoot={true} />
        </div>
    );
}

function TreeRow({ item, level, isRoot = false }: { item: TreeItemFn; level: number; isRoot?: boolean }) {
    const [isOpen, setIsOpen] = useState(level < 2);
    const [showMobileDetails, setShowMobileDetails] = useState(false);

    const canExpand = item.children && item.children.length > 0;

    // Mobile: Flex row with Name + Toggle Details
    // Desktop: Grid
    const desktopGrid = "md:grid md:grid-cols-[minmax(350px,1fr)_100px_repeat(9,80px)]";

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div
                className={cn(
                    "flex flex-col md:block border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group",
                    level === 0 && !isRoot && "bg-slate-50/30 dark:bg-slate-900/20 font-medium", // Sub-clients? (Unlikely top level is usually 0)
                    isRoot && "bg-white dark:bg-slate-950", // Root text styling
                    level === 1 && "bg-white dark:bg-slate-950",
                    level === 2 && "bg-orange-50/30 dark:bg-orange-950/10"
                )}
            >
                <div className={cn("flex flex-wrap items-center gap-2 p-3 md:px-4 md:py-2", desktopGrid)}>

                    {/* Primary Info (Mobile: Full Width row 1) */}
                    <div className="flex items-center gap-2 overflow-hidden flex-1 md:flex-none" style={{ paddingLeft: `${level * 24}px` }}>
                        {canExpand ? (
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0">
                                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                            </CollapsibleTrigger>
                        ) : (
                            <div className="w-6 shrink-0" />
                        )}

                        <RowIcon type={item.type} />

                        {item.type === "CLIENT" ? (
                            <Link href={`/app/clients/${item.id}`} className="truncate hover:underline hover:text-blue-600 cursor-pointer text-sm font-medium" title={item.name}>
                                {item.name}
                            </Link>
                        ) : item.type === "LE" ? (
                            <Link href={`/app/le/${item.id}`} className="truncate hover:underline hover:text-blue-600 cursor-pointer text-sm font-medium" title={item.name}>
                                {item.name}
                                {item.metadata?.status === "ARCHIVED" && (
                                    <span className="ml-2 text-xs text-slate-400 italic no-underline">(archived)</span>
                                )}
                            </Link>
                        ) : (
                            <span className="truncate text-sm" title={item.name}>
                                {item.name}
                            </span>
                        )}

                        {/* Mobile Details Toggle */}
                        <div className="ml-auto md:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-slate-400"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMobileDetails(!showMobileDetails);
                                }}
                            >
                                {showMobileDetails ? "Hide" : "Details"}
                            </Button>
                        </div>
                    </div>

                    {/* Role (Mobile: Hidden or inline? Let's keep inline if possible, or hide) */}
                    <div className="hidden md:block">
                        <RoleBadge role={item.role} />
                    </div>

                    {/* Metrics (Desktop) */}
                    <div className="hidden md:contents">
                        {/* 'contents' allows these divs to participate in the parent grid */}
                        <MetricCell value={item.metrics.noData} />
                        <MetricCell value={item.metrics.prepopulated} />
                        <MetricCell value={item.metrics.systemUpdated} />
                        <MetricCell value={item.metrics.drafted} />
                        <MetricCell value={item.metrics.approved} />
                        <MetricCell value={item.metrics.released} />
                        <MetricCell value={item.metrics.acknowledged} />
                        <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                            {item.metrics.lastEdit ? format(new Date(item.metrics.lastEdit), "dd MMM yy") : "-"}
                        </div>
                        <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                            {item.metrics.targetCompletion ? format(new Date(item.metrics.targetCompletion), "dd MMM yy") : "-"}
                        </div>
                    </div>
                </div>

                {/* Mobile Details Panel */}
                {showMobileDetails && (
                    <div className="md:hidden px-4 pb-3 pl-12 grid grid-cols-2 gap-2 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100">
                        <div className="col-span-2 py-1 flex justify-between border-b border-slate-100">
                            <span className="text-slate-500">Role</span>
                            <RoleBadge role={item.role} />
                        </div>
                        <MobileMetric label="No Data" value={item.metrics.noData} />
                        <MobileMetric label="Prepop" value={item.metrics.prepopulated} />
                        <MobileMetric label="System" value={item.metrics.systemUpdated} />
                        <MobileMetric label="Drafted" value={item.metrics.drafted} />
                        <MobileMetric label="Approved" value={item.metrics.approved} />
                        <MobileMetric label="Released" value={item.metrics.released} />
                        <MobileMetric label="Ack" value={item.metrics.acknowledged} />
                        <div className="col-span-2 pt-2 text-right text-slate-400">
                            Last Edit: {item.metrics.lastEdit ? format(new Date(item.metrics.lastEdit), "dd MMM yy") : "-"}
                        </div>
                    </div>
                )}
            </div>

            {/* Nested Children */}
            <CollapsibleContent>
                {item.children.map(child => (
                    <TreeRow key={child.id} item={child} level={level + 1} />
                ))}

                {/* "Add New" placeholder rows */}
                {level === 0 && (
                    <div className="pl-12 py-3 text-xs text-slate-400 hover:text-indigo-600 cursor-pointer flex items-center gap-1 border-b border-slate-100 dark:border-slate-800">
                        <Plus className="h-3 w-3" /> New Legal Entity
                    </div>
                )}
                {level === 1 && (
                    <div className="pl-[72px] py-2 text-xs text-slate-400 hover:text-indigo-600 cursor-pointer flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 bg-orange-50/10">
                        <Plus className="h-3 w-3" /> New Relationship
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

function MobileMetric({ label, value }: { label: string, value: number }) {
    return (
        <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">{label}</span>
            <span className={cn("font-mono font-medium", value > 0 ? "text-slate-900" : "text-slate-300")}>
                {value}
            </span>
        </div>
    );
}

// --- Subcomponents ---

function RowIcon({ type }: { type: string }) {
    switch (type) {
        case "CLIENT": return <Building2 className="h-4 w-4 text-slate-400" />;
        case "LE": return <Briefcase className="h-4 w-4 text-emerald-500" />;
        case "ENGAGEMENT": return <LinkIcon className="h-3 w-3 text-indigo-500" />;
        default: return <div className="h-4 w-4" />;
    }
}

function RoleBadge({ role }: { role: string }) {
    if (role === "NO_ACCESS") {
        return <Badge variant="outline" className="text-[10px] text-slate-400 border-dashed">No Access</Badge>;
    }

    // Color mapping based on screenshot
    let colorClass = "bg-slate-100 text-slate-600 border-slate-200"; // Default User?
    if (["ADMIN", "ORG_ADMIN", "CLIENT_ADMIN"].includes(role)) {
        colorClass = "bg-green-100 text-green-700 border-green-200"; // Admin
    } else if (role === "LE_ADMIN") {
        colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; // LE Admin
    } else if (role === "USER") {
        colorClass = "bg-green-50 text-green-600 border-green-100"; // User
    }

    return (
        <Badge variant="outline" className={cn("text-[10px] font-normal px-1.5 py-0 h-5", colorClass)}>
            {role.replace("_", " ")}
        </Badge>
    );
}

function MetricCell({ value }: { value: number }) {
    return (
        <div className={cn(
            "text-right text-xs pr-2 font-mono",
            value === 0 ? "text-slate-300 dark:text-slate-700" : "text-slate-700 dark:text-slate-300 font-medium"
        )}>
            {value}
        </div>
    );
}
