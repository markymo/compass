"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, FileQuestion, Database, ArrowRight, Building2, Search, Filter, SortDesc, SortAsc } from "lucide-react";
import Link from "next/link";

export type UnifiedAssignment = {
    id: string;
    type: "question" | "master";
    title: string;
    description: string;
    status: string;
    clientName: string | null;
    clientLEId: string | null;
    contextName: string | null; // Questionnaire name or Field No
    assignedBy: string;
    createdAt: Date;
    fieldNo?: number;
};

interface AssignmentsListProps {
    assignments: UnifiedAssignment[];
}

export function AssignmentsList({ assignments }: AssignmentsListProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [clientFilter, setClientFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

    // Unique clients for filter
    const clients = useMemo(() => {
        const unique = new Set(assignments.map((a: any) => a.clientName).filter(Boolean));
        return Array.from(unique) as string[];
    }, [assignments]);

    const filteredAndSorted = useMemo(() => {
        let result = [...assignments];

        // Search
        if (search) {
            const s = search.toLowerCase();
            result = result.filter((a: any) =>
                a.title.toLowerCase().includes(s) ||
                a.description.toLowerCase().includes(s) ||
                (a.clientName || "").toLowerCase().includes(s)
            );
        }

        // Type Filter
        if (typeFilter !== "all") {
            result = result.filter((a: any) => a.type === typeFilter);
        }

        // Client Filter
        if (clientFilter !== "all") {
            result = result.filter((a: any) => a.clientName === clientFilter);
        }

        // Sort
        result.sort(((a: any, b: any)) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortBy === "newest" ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [assignments, search, typeFilter, clientFilter, sortBy]);

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search assignments..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="all">All Types</option>
                        <option value="question">Questions</option>
                        <option value="master">Master Fields</option>
                    </select>

                    <select
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[200px]"
                    >
                        <option value="all">All Clients</option>
                        {clients.map((c: any) => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <button
                        onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg text-sm py-2 px-3 hover:bg-slate-50 transition-colors"
                    >
                        {sortBy === "newest" ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
                        {sortBy === "newest" ? "Newest" : "Oldest"}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {filteredAndSorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <ClipboardCheck className="h-12 w-12 mb-4 opacity-10" />
                        <p className="text-sm font-medium">No results found for your search.</p>
                        <button
                            onClick={() => { setSearch(""); setTypeFilter("all"); setClientFilter("all"); }}
                            className="mt-4 text-indigo-600 text-sm hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredAndSorted.map((item: any) => (
                            <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex gap-4 min-w-0">
                                        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${item.type === "question" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                            }`}>
                                            {item.type === "question" ? <FileQuestion className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${item.type === "question" ? "text-indigo-600 bg-indigo-50/30 border-indigo-100" : "text-emerald-600 bg-emerald-50/30 border-emerald-100"
                                                    }`}>
                                                    {item.type === "question" ? "Question" : "Master Data"}
                                                </Badge>

                                                {item.clientName && (
                                                    <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-transparent flex items-center gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {item.clientName}
                                                    </Badge>
                                                )}

                                                <span className="text-xs text-slate-400">
                                                    • {item.contextName}
                                                </span>
                                            </div>

                                            <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                                                {item.title}
                                            </p>

                                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                <span>Assigned by {item.assignedBy}</span>
                                                <span>•</span>
                                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                                <Badge variant="outline" className="text-[9px] py-0">{item.status}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={item.type === "question"
                                            ? `/app/le/${item.clientLEId}/workbench2?questionId=${item.id}`
                                            : `/app/le/${item.clientLEId}/master?fieldNo=${item.fieldNo}`
                                        }
                                        className="shrink-0 h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors bg-white shadow-sm"
                                    >
                                        <ArrowRight className="h-5 w-5" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
