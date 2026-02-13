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
    return (
        <div className="w-full overflow-x-auto border rounded-xl bg-white shadow-sm dark:bg-slate-950 dark:border-slate-800">
            {/* Header */}
            <div className="min-w-[1200px] grid grid-cols-[minmax(350px,1fr)_100px_repeat(9,80px)] items-center px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:bg-slate-900 dark:border-slate-800">
                <div>Entity</div>
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

            {/* Body */}
            <div className="min-w-[1200px]">
                {items.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic">No access found.</div>
                ) : (
                    items.map(item => <TreeRow key={item.id} item={item} level={0} />)
                )}
            </div>
        </div>
    );
}

function TreeRow({ item, level }: { item: TreeItemFn; level: number }) {
    const [isOpen, setIsOpen] = useState(level < 2); // Default expand top levels? Or specific logic?
    // Let's default expand Clients (level 0), collapse others.
    // Actually, screenshot shows Clients expanded, LEs expanded maybe.

    // Auto-expand if level 0 (Client)
    const canExpand = item.children && item.children.length > 0;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div
                className={cn(
                    "grid grid-cols-[minmax(350px,1fr)_100px_repeat(9,80px)] items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group",
                    level === 0 && "bg-slate-50/30 dark:bg-slate-900/20 font-medium",
                    level === 1 && "bg-white dark:bg-slate-950",
                    level === 2 && "bg-orange-50/30 dark:bg-orange-950/10" // Tint for engagements like screenshot
                )}
            >
                {/* Name / Tree Control */}
                <div className="flex items-center gap-2 overflow-hidden" style={{ paddingLeft: `${level * 24}px` }}>
                    {canExpand ? (
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0 hover:bg-slate-200 dark:hover:bg-slate-800">
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </Button>
                        </CollapsibleTrigger>
                    ) : (
                        <div className="w-5" /> // Spacer
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
                        <span className="truncate" title={item.name}>
                            {item.name}
                        </span>
                    )}

                    {/* Action Buttons (Mock based on screenshot gear/image icons) */}
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Settings className="h-3 w-3 text-slate-400" />
                        </Button>
                    </div>
                </div>

                {/* Role */}
                <div>
                    <RoleBadge role={item.role} />
                </div>

                {/* Metrics */}
                <MetricCell value={item.metrics.noData} />
                <MetricCell value={item.metrics.prepopulated} />
                <MetricCell value={item.metrics.systemUpdated} />
                <MetricCell value={item.metrics.drafted} />
                <MetricCell value={item.metrics.approved} />
                <MetricCell value={item.metrics.released} />
                <MetricCell value={item.metrics.acknowledged} />

                {/* Dates */}
                <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                    {item.metrics.lastEdit ? format(new Date(item.metrics.lastEdit), "dd MMM yy") : "-"}
                </div>
                <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                    {item.metrics.targetCompletion ? format(new Date(item.metrics.targetCompletion), "dd MMM yy") : "-"}
                </div>
            </div>

            {/* Nested Children */}
            <CollapsibleContent>
                {item.children.map(child => (
                    <TreeRow key={child.id} item={child} level={level + 1} />
                ))}

                {/* "Add New" placeholder rows based on level (optional for now, but nice to have) */}
                {level === 0 && (
                    <div className="pl-12 py-2 text-xs text-slate-400 hover:text-indigo-600 cursor-pointer flex items-center gap-1 border-b border-slate-100 dark:border-slate-800">
                        <Plus className="h-3 w-3" /> New Legal Entity
                    </div>
                )}
                {level === 1 && (
                    <div className="pl-[72px] py-1.5 text-xs text-slate-400 hover:text-indigo-600 cursor-pointer flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 bg-orange-50/10">
                        <Plus className="h-3 w-3" /> New Relationship
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
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
