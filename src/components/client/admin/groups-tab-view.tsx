"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { GroupActions } from "./group-actions";
import { GroupItemsTable } from "./group-items-table";

interface GroupsTabViewProps {
    groups: any[];
}

interface GroupCardProps {
    group: any;
    isCollapsed: boolean;
    onToggle: (id: string) => void;
}

function GroupCard({ group, isCollapsed, onToggle }: GroupCardProps) {
    return (
        <div className="border rounded-xl bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Collapse toggle */}
                    <button
                        onClick={() => onToggle(group.id)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed
                            ? <ChevronRight className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />
                        }
                    </button>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 shrink-0">
                        <LayoutGrid className="h-5 w-5 text-purple-600" />
                    </div>

                    <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{group.label}</h3>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest leading-none mt-1 truncate">{group.key}</p>
                    </div>

                    <Badge variant="secondary" className="ml-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-normal border-none shrink-0">
                        {group.category || "Uncategorized"}
                    </Badge>

                    {/* Field count pill */}
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {group.items?.length ?? 0} field{group.items?.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                    {group.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">Active</Badge>
                    ) : (
                        <Badge variant="outline" className="text-slate-400 border-slate-200 dark:border-slate-800">Inactive</Badge>
                    )}
                    <GroupActions group={group} />
                </div>
            </div>

            {/* Collapsible body */}
            {!isCollapsed && (
                <>
                    <GroupItemsTable group={group} />
                    {group.description && (
                        <div className="px-6 py-3 bg-slate-50/30 dark:bg-slate-900/10 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex gap-2 items-start">
                                <div className="mt-0.5 w-3 h-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                    <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400">i</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 italic">
                                    {group.description}
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="border rounded-xl bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 text-sm italic">
            {label}
        </div>
    );
}

export function GroupsTabView({ groups }: GroupsTabViewProps) {
    const active = groups.filter((g: any) => g.isActive);
    const deactivated = groups.filter((g: any) => !g.isActive);

    // Collapsed set: IDs in here are collapsed.
    // Active groups default open → empty set.
    // Deactivated groups default closed → all IDs in set.
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
        () => new Set(deactivated.map((g: any) => g.id))
    );

    const toggle = useCallback((id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => setCollapsedIds(new Set()), []);

    const collapseAll = useCallback(() => {
        setCollapsedIds(new Set(groups.map((g: any) => g.id)));
    }, [groups]);

    return (
        <Tabs defaultValue="active" className="w-full">
            {/* Tab bar + Expand/Collapse All in the same row */}
            <div className="flex items-center justify-between mb-6">
                <TabsList>
                    <TabsTrigger value="active" className="gap-2">
                        Active
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                            {active.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="deactivated" className="gap-2">
                        Deactivated
                        {deactivated.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                {deactivated.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={expandAll}
                        title="Expand all groups"
                    >
                        <ChevronsUpDown className="h-3.5 w-3.5" />
                        Expand All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={collapseAll}
                        title="Collapse all groups"
                    >
                        <ChevronsDownUp className="h-3.5 w-3.5" />
                        Collapse All
                    </Button>
                </div>
            </div>

            {/* Active tab */}
            <TabsContent value="active" className="mt-0">
                {active.length === 0 ? (
                    <EmptyState label="No active groups found." />
                ) : (
                    <div className="grid gap-5">
                        {active.map((group: any) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                isCollapsed={collapsedIds.has(group.id)}
                                onToggle={toggle}
                            />
                        ))}
                    </div>
                )}
            </TabsContent>

            {/* Deactivated tab */}
            <TabsContent value="deactivated" className="mt-0">
                {deactivated.length === 0 ? (
                    <EmptyState label="No deactivated groups." />
                ) : (
                    <div className="grid gap-4">
                        {deactivated.map((group: any) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                isCollapsed={collapsedIds.has(group.id)}
                                onToggle={toggle}
                            />
                        ))}
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
}
