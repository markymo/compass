"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardCheck, FileQuestion, Database, ArrowRight, Building2, Search, SortDesc, SortAsc, FileText, UserCheck, Users, User, PanelRightOpen } from "lucide-react";

export type UnifiedAssignment = {
    id: string;
    type: "question" | "master";
    title: string;
    description: string;
    status: string;
    workStatus?: 'OPEN' | 'DONE';
    clientName: string | null;
    clientLEId: string | null;
    engagementId?: string | null;
    questionnaireId?: string | null;
    contextName: string | null; // Questionnaire name or Field No
    assignedToUserId?: string;
    assignedToUserName?: string;
    assignedBy: string;
    note?: string | null;
    createdAt: Date;
    fieldNo?: number;
};

interface AssignmentsListProps {
    myAssignments: UnifiedAssignment[];
    teamAssignments: UnifiedAssignment[];
    currentUserId?: string;
}

export function AssignmentsList({ myAssignments, teamAssignments, currentUserId }: AssignmentsListProps) {
    const [activeTab, setActiveTab] = useState<"my" | "team">("my");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [clientFilter, setClientFilter] = useState<string>("all");
    const [workStatusFilter, setWorkStatusFilter] = useState<string>("all");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

    // Active dataset based on tab selection
    const rawList = useMemo(() => {
        return activeTab === "my" ? myAssignments : teamAssignments;
    }, [activeTab, myAssignments, teamAssignments]);

    // Unique team members for Assignee filter in Team view
    const teamMembers = useMemo(() => {
        const map = new Map<string, string>();
        for (const item of teamAssignments) {
            if (item.assignedToUserId) {
                map.set(item.assignedToUserId, item.assignedToUserName || "Team Member");
            }
        }
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [teamAssignments]);

    // Unique clients for filter
    const clients = useMemo(() => {
        const unique = new Set(rawList.map((a) => a.clientName).filter(Boolean));
        return Array.from(unique) as string[];
    }, [rawList]);

    // Summary metrics for Master Field assignments
    const masterSummary = useMemo(() => {
        const masters = rawList.filter(a => a.type === "master");
        const total = masters.length;
        const open = masters.filter(a => a.workStatus === "OPEN" || !a.workStatus).length;
        const done = masters.filter(a => a.workStatus === "DONE").length;
        return { total, open, done };
    }, [rawList]);

    // Personal open items count badge for My ToDo tab
    const myOpenCount = useMemo(() => {
        return myAssignments.filter(a => a.type === "question" || a.workStatus === "OPEN" || !a.workStatus).length;
    }, [myAssignments]);

    const getItemUrl = (item: UnifiedAssignment) => {
        if (!item.clientLEId) return `/app`;
        if (item.type === "master") {
            return `/app/le/${item.clientLEId}/master?fieldNo=${item.fieldNo}`;
        }
        if (item.engagementId && item.questionnaireId) {
            return `/app/le/${item.clientLEId}/engagement-new/${item.engagementId}/questionnaire/${item.questionnaireId}?questionId=${item.id}`;
        }
        return `/app/le/${item.clientLEId}/requirements?questionId=${item.id}`;
    };

    const filteredAndSorted = useMemo(() => {
        let result = [...rawList];

        // Search
        if (search) {
            const s = search.toLowerCase();
            result = result.filter((a) =>
                a.title.toLowerCase().includes(s) ||
                a.description.toLowerCase().includes(s) ||
                (a.clientName || "").toLowerCase().includes(s) ||
                (a.assignedToUserName || "").toLowerCase().includes(s) ||
                (a.note || "").toLowerCase().includes(s)
            );
        }

        // Type Filter
        if (typeFilter !== "all") {
            result = result.filter((a) => a.type === typeFilter);
        }

        // Client Filter
        if (clientFilter !== "all") {
            result = result.filter((a) => a.clientName === clientFilter);
        }

        // Work Status Filter (for Master Field assignments)
        if (workStatusFilter !== "all") {
            result = result.filter((a) => {
                if (a.type !== "master") return true;
                const ws = a.workStatus || "OPEN";
                return ws === workStatusFilter;
            });
        }

        // Assignee Filter (Team view only)
        if (activeTab === "team" && assigneeFilter !== "all") {
            if (assigneeFilter === "me") {
                result = result.filter((a) => a.assignedToUserId === currentUserId);
            } else {
                result = result.filter((a) => a.assignedToUserId === assigneeFilter);
            }
        }

        // Sort
        result.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortBy === "newest" ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [rawList, search, typeFilter, clientFilter, workStatusFilter, assigneeFilter, sortBy, activeTab, currentUserId]);

    return (
        <div className="space-y-6 text-foreground">
            {/* Top Level Navigation Tabs: My ToDo vs Team */}
            <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "team")} className="w-auto">
                    <TabsList className="bg-muted p-1 rounded-xl h-11 border border-border">
                        <TabsTrigger
                            value="my"
                            className="text-xs font-semibold px-4 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
                        >
                            <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <span>My ToDo</span>
                            {myOpenCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                                    {myOpenCount}
                                </span>
                            )}
                        </TabsTrigger>

                        <TabsTrigger
                            value="team"
                            className="text-xs font-semibold px-4 h-9 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
                        >
                            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>Team</span>
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground rounded-full border border-border">
                                {teamAssignments.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Master Field Summary Bar */}
            {masterSummary.total > 0 && (
                <div className="flex items-center gap-3 text-xs bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 px-4 py-2.5 rounded-md shadow-xs font-medium flex-wrap">
                    <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="font-semibold">{activeTab === "my" ? "My Master Field Assignments:" : "Team Master Field Assignments:"}</span>
                    <span className="font-bold">{masterSummary.total} total</span>
                    <span>•</span>
                    <span className="text-foreground font-semibold">{masterSummary.open} open</span>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{masterSummary.done} done</span>
                </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-card text-card-foreground p-3 rounded-md border border-border shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={activeTab === "my" ? "Search my tasks..." : "Search team assignments..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Assignee Filter for Team tab */}
                    {activeTab === "team" && (
                        <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className="px-3 py-2 bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-semibold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        >
                            <option value="all">All Assignees</option>
                            <option value="me">Assigned to Me</option>
                            {teamMembers.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    )}

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="all">All Types</option>
                        <option value="question">Questions</option>
                        <option value="master">Master Data</option>
                    </select>

                    <select
                        value={workStatusFilter}
                        onChange={(e) => setWorkStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="all">All Work</option>
                        <option value="OPEN">Open</option>
                        <option value="DONE">Done</option>
                    </select>

                    {clients.length > 0 && (
                        <select
                            value={clientFilter}
                            onChange={(e) => setClientFilter(e.target.value)}
                            className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="all">All Workspaces</option>
                            {clients.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    )}

                    <button
                        onClick={() => setSortBy(prev => prev === "newest" ? "oldest" : "newest")}
                        className="flex items-center gap-1.5 px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                        {sortBy === "newest" ? <SortDesc className="h-3.5 w-3.5 text-muted-foreground" /> : <SortAsc className="h-3.5 w-3.5 text-muted-foreground" />}
                        {sortBy === "newest" ? "Newest" : "Oldest"}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-card text-card-foreground rounded-md border border-border shadow-sm overflow-hidden">
                {filteredAndSorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <ClipboardCheck className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium">No results found for your search.</p>
                        <button
                            onClick={() => { setSearch(""); setTypeFilter("all"); setClientFilter("all"); setWorkStatusFilter("all"); setAssigneeFilter("all"); }}
                            className="mt-4 text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filteredAndSorted.map((item: UnifiedAssignment) => (
                            <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex gap-4 min-w-0 flex-1">
                                        <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${item.type === "question" ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800" : (item.workStatus === "DONE" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800" : "bg-muted text-muted-foreground border border-border")
                                            }`}>
                                            {item.type === "question" ? <FileQuestion className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                                        </div>

                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${item.type === "question" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800" : (item.workStatus === "DONE" ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800" : "text-muted-foreground bg-muted border-border")
                                                    }`}>
                                                    {item.type === "question" ? "Question" : "Master Data"}
                                                </Badge>

                                                {item.clientName && (
                                                    <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground border-transparent flex items-center gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {item.clientName}
                                                    </Badge>
                                                )}

                                                <span className="text-xs text-muted-foreground">
                                                    • {item.contextName}
                                                </span>
                                            </div>

                                            <Link
                                                href={getItemUrl(item)}
                                                className="text-sm font-semibold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline line-clamp-2 transition-colors block"
                                            >
                                                {item.title}
                                            </Link>

                                            {item.note && (
                                                <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded border border-indigo-100 dark:border-indigo-800 italic flex items-start gap-1.5 mt-1">
                                                    <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                                    <span><strong className="not-italic font-semibold mr-1">Instruction:</strong>"{item.note}"</span>
                                                </p>
                                            )}

                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5 flex-wrap">
                                                {activeTab === "team" && item.assignedToUserName && (
                                                    <Badge variant="outline" className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800 font-medium py-0 px-2 flex items-center gap-1">
                                                        <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                                        <span>Assigned to: {item.assignedToUserName}</span>
                                                    </Badge>
                                                )}
                                                <span>Assigned by {item.assignedBy}</span>
                                                <span>•</span>
                                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                                {item.type === "master" ? (
                                                    <Badge variant="outline" className={item.workStatus === "DONE" ? "text-[9px] py-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-semibold" : "text-[9px] py-0 bg-muted text-muted-foreground border-border font-semibold"}>
                                                        {item.workStatus === "DONE" ? "Done" : "Open"}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[9px] py-0 bg-muted text-muted-foreground border-border">{item.status}</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={getItemUrl(item)}
                                        className="shrink-0 h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors bg-card shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                                        title={`Inspect assignment: ${item.title}`}
                                        aria-label={`Inspect assignment: ${item.title}`}
                                    >
                                        <PanelRightOpen className="h-5 w-5" />
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

