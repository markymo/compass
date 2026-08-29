"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Search,
    Filter,
    Building2,
    FileText,
    Clock,
    Lock,
    ShieldCheck,
    Paperclip,
    HelpCircle,
    Download,
    ChevronRight,
    LayoutGrid,
    Rows,
    TableProperties,
    X,
    ExternalLink,
    ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { SupplierQuestionView, FIWorkbenchData } from "@/actions/fi";
import { resolveFieldForDisplay, RawFieldSource } from "@/lib/master-data/field-interpreter";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";
import { FieldSourceBadge } from "@/components/client/fields/FieldSourceBadge";
import { usePreferences } from "@/components/providers/user-preferences-provider";

interface SupplierQuestionsWorkbenchProps {
    orgId: string;
    data: FIWorkbenchData;
}

type ViewMode = "classic" | "flow" | "compact";

function getQuestionDisplayModel(q: SupplierQuestionView) {
    if (q.answerVisibility === "NOT_SHARED") return null;

    const lastValidated = q.provenance?.lastValidatedAt || q.provenance?.timestamp;

    const rawSource: RawFieldSource | null = q.provenance ? {
        type: q.provenance.sourceType || (q.provenance.source === "Provisional Shared" ? "USER_INPUT" : q.provenance.source) || "USER_INPUT",
        reference: q.provenance.sourceReference || (q.provenance.releaseProvenance as any)?.sourceReference || null,
        timestamp: q.provenance.timestamp ? new Date(q.provenance.timestamp) : (lastValidated ? new Date(lastValidated) : undefined),
        sourceCheckedAt: lastValidated ? new Date(lastValidated) : undefined
    } : null;

    return resolveFieldForDisplay(
        q.answer,
        rawSource,
        {
            fieldNo: q.questionNumber ? parseInt(q.questionNumber, 10) || 0 : 0,
            label: q.questionText || (q as any).text,
            category: q.category,
            appDataType: (q as any).appDataType,
            codeSystem: (q as any).codeSystem
        }
    );
}

function SupplierQuestionsWorkbenchInner({ orgId, data }: SupplierQuestionsWorkbenchProps) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const { preferences, updatePreference } = usePreferences();

    // Search and Filters backed by URL parameters
    const [search, setSearch] = useState(searchParams.get("s") || "");
    const [relFilter, setRelFilter] = useState(searchParams.get("rel") || "ALL");
    const [qFilter, setQFilter] = useState(searchParams.get("q") || "ALL");
    const [catFilter, setCatFilter] = useState(searchParams.get("cat") || "ALL");
    const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");

    useEffect(() => {
        setSearch(searchParams.get("s") || "");
        setRelFilter(searchParams.get("rel") || "ALL");
        setQFilter(searchParams.get("q") || "ALL");
        setCatFilter(searchParams.get("cat") || "ALL");
        setStatusFilter(searchParams.get("status") || "ALL");
    }, [searchParams]);

    // Saved Preference with URL Override
    const savedPrefView = (preferences?.supplierQuestionsView as ViewMode) || "classic";
    const urlViewParam = searchParams.get("view") as ViewMode | null;
    const currentViewMode: ViewMode =
        urlViewParam && ["classic", "flow", "compact"].includes(urlViewParam)
            ? urlViewParam
            : savedPrefView;

    // Helper to update URL params cleanly
    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, val]) => {
            if (val && val !== "ALL") {
                params.set(key, val);
            } else {
                params.delete(key);
            }
        });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleSearchChange = (val: string) => {
        setSearch(val);
        updateUrl({ s: val });
    };

    const handleFilterChange = (key: string, val: string, setter: (v: string) => void) => {
        setter(val);
        updateUrl({ [key]: val });
    };

    const handleViewChange = (newView: ViewMode) => {
        updatePreference("supplierQuestionsView", newView);
        updateUrl({ view: newView });
    };

    const handleClearFilters = () => {
        setSearch("");
        setRelFilter("ALL");
        setQFilter("ALL");
        setCatFilter("ALL");
        setStatusFilter("ALL");
        router.replace(pathname, { scroll: false });
    };

    const hasActiveFilters = Boolean(
        search || relFilter !== "ALL" || qFilter !== "ALL" || catFilter !== "ALL" || statusFilter !== "ALL"
    );

    // Scope-filtered questions (before status filter is applied)
    const scopeFilteredQuestions = useMemo(() => {
        return data.questions.filter((q: SupplierQuestionView) => {
            const searchText = search.toLowerCase().trim();
            const qText = (q.questionText || (q as any).text || "").toLowerCase();
            const qNum = (q.questionNumber || "").toLowerCase();
            const leName = (q.clientLEName || (q as any).leName || "").toLowerCase();
            const qName = (q.questionnaireName || "").toLowerCase();
            const secName = (q.sectionName || "").toLowerCase();

            const matchesSearch =
                !searchText ||
                qText.includes(searchText) ||
                qNum.includes(searchText) ||
                leName.includes(searchText) ||
                qName.includes(searchText) ||
                secName.includes(searchText);

            const matchesLE = relFilter === "ALL" || (q.clientLEName || (q as any).leName) === relFilter;
            const matchesQ = qFilter === "ALL" || q.questionnaireName === qFilter;
            const matchesCat = catFilter === "ALL" || q.category === catFilter;

            return matchesSearch && matchesLE && matchesQ && matchesCat;
        });
    }, [data.questions, search, relFilter, qFilter, catFilter]);

    // Final filtered questions (including status filter)
    const filteredQuestions = useMemo(() => {
        return scopeFilteredQuestions.filter((q) => {
            return statusFilter === "ALL" || q.answerVisibility === statusFilter;
        });
    }, [scopeFilteredQuestions, statusFilter]);

    // Dynamic Summary Counts scoped to active relationship/questionnaire/category/search
    const summaryCounts = useMemo(() => {
        const total = scopeFilteredQuestions.length;
        const notShared = scopeFilteredQuestions.filter((q) => q.answerVisibility === "NOT_SHARED").length;
        const shared = scopeFilteredQuestions.filter((q) => q.answerVisibility === "SHARED").length;
        const released = scopeFilteredQuestions.filter((q) => q.answerVisibility === "RELEASED").length;

        return { total, notShared, shared, released };
    }, [scopeFilteredQuestions]);

    // Active Scope Context Summaries
    const activeClientsList = useMemo(() => {
        if (relFilter !== "ALL") return [relFilter];
        const unique = Array.from(new Set(scopeFilteredQuestions.map((q) => q.clientLEName || (q as any).leName).filter(Boolean)));
        return unique.length > 0 ? unique : data.les;
    }, [relFilter, scopeFilteredQuestions, data.les]);

    const activeQuestionnairesList = useMemo(() => {
        if (qFilter !== "ALL") return [qFilter];
        const unique = Array.from(new Set(scopeFilteredQuestions.map((q) => q.questionnaireName).filter(Boolean)));
        return unique.length > 0 ? unique : data.questionnaires;
    }, [qFilter, scopeFilteredQuestions, data.questionnaires]);

    return (
        <div className="space-y-6 w-full pb-20">
            {/* 1. Workbench Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by question text, number, client, questionnaire, section..."
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-10 bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500 text-xs h-10 rounded-xl"
                        />
                        {search && (
                            <button
                                onClick={() => handleSearchChange("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={relFilter} onValueChange={(val) => handleFilterChange("rel", val, setRelFilter)}>
                            <SelectTrigger className="w-[170px] bg-slate-50/50 border-slate-200 text-xs h-10 rounded-xl">
                                <Building2 className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Relationship" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Relationships</SelectItem>
                                {data.les.map((le) => (
                                    <SelectItem key={le} value={le}>{le}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={qFilter} onValueChange={(val) => handleFilterChange("q", val, setQFilter)}>
                            <SelectTrigger className="w-[180px] bg-slate-50/50 border-slate-200 text-xs h-10 rounded-xl">
                                <FileText className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Questionnaire" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Questionnaires</SelectItem>
                                {data.questionnaires.map((q) => (
                                    <SelectItem key={q} value={q}>{q}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={catFilter} onValueChange={(val) => handleFilterChange("cat", val, setCatFilter)}>
                            <SelectTrigger className="w-[160px] bg-slate-50/50 border-slate-200 text-xs h-10 rounded-xl">
                                <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Categories</SelectItem>
                                {data.categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={(val) => handleFilterChange("status", val, setStatusFilter)}>
                            <SelectTrigger className="w-[160px] bg-slate-50/50 border-slate-200 text-xs h-10 rounded-xl">
                                <div className="h-2 w-2 rounded-full bg-teal-500 mr-2" />
                                <SelectValue placeholder="Visibility" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Visibility</SelectItem>
                                <SelectItem value="NOT_SHARED">Awaiting Client</SelectItem>
                                <SelectItem value="SHARED">Shared (Provisional)</SelectItem>
                                <SelectItem value="RELEASED">Released (Formal)</SelectItem>
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearFilters}
                                className="text-xs text-slate-500 hover:text-slate-800 h-10 px-3 rounded-xl gap-1.5"
                            >
                                <X className="h-3.5 w-3.5" /> Clear filters
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Compact Unified Summary Section */}
            <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                    {/* Active Context Scope */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Summary Scope:</span>
                        
                        {/* Client / Relationship Scope */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200/70">
                            <Building2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                            <span className="text-slate-500 font-normal">Client:</span>
                            <span>
                                {relFilter !== "ALL"
                                    ? relFilter
                                    : activeClientsList.length === 1
                                    ? activeClientsList[0]
                                    : `${activeClientsList.length} Relationships`}
                            </span>
                        </div>

                        {/* Questionnaire Scope */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200/70">
                            <FileText className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                            <span className="text-slate-500 font-normal">Questionnaire:</span>
                            <span>
                                {qFilter !== "ALL"
                                    ? qFilter
                                    : activeQuestionnairesList.length === 1
                                    ? activeQuestionnairesList[0]
                                    : `${activeQuestionnairesList.length} Questionnaires`}
                            </span>
                        </div>

                        {/* Category Scope (If active) */}
                        {catFilter !== "ALL" && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-semibold border border-teal-200/70">
                                <Filter className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                <span className="text-teal-600 font-normal">Category:</span>
                                <span>{catFilter}</span>
                            </div>
                        )}
                    </div>

                    {/* Overall Filter Indicator if Search is active */}
                    {search && (
                        <div className="text-xs text-slate-500 italic">
                            Filtered by search: &ldquo;<span className="font-medium text-slate-700">{search}</span>&rdquo;
                        </div>
                    )}
                </div>

                {/* Status Breakdown Chips (Interactive) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Total Questions */}
                    <button
                        onClick={() => handleFilterChange("status", "ALL", setStatusFilter)}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-md border text-left transition-all hover:border-slate-300",
                            statusFilter === "ALL"
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60 text-slate-800"
                        )}
                    >
                        <div className={cn(
                            "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                            statusFilter === "ALL" ? "bg-slate-800 text-slate-200" : "bg-white border border-slate-200 text-slate-600"
                        )}>
                            <HelpCircle className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <div className="text-lg font-bold leading-tight">{summaryCounts.total}</div>
                            <div className={cn("text-[11px] font-medium", statusFilter === "ALL" ? "text-slate-300" : "text-slate-500")}>
                                Total Questions
                            </div>
                        </div>
                    </button>

                    {/* Awaiting Client */}
                    <button
                        onClick={() => handleFilterChange("status", statusFilter === "NOT_SHARED" ? "ALL" : "NOT_SHARED", setStatusFilter)}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-md border text-left transition-all hover:border-amber-300",
                            statusFilter === "NOT_SHARED"
                                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                : "bg-amber-50/50 border-amber-200/60 hover:bg-amber-50 text-slate-800"
                        )}
                    >
                        <div className={cn(
                            "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                            statusFilter === "NOT_SHARED" ? "bg-amber-700 text-amber-100" : "bg-white border border-amber-200 text-amber-600"
                        )}>
                            <Lock className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <div className="text-lg font-bold leading-tight">{summaryCounts.notShared}</div>
                            <div className={cn("text-[11px] font-medium", statusFilter === "NOT_SHARED" ? "text-amber-100" : "text-slate-500")}>
                                Awaiting Client
                            </div>
                        </div>
                    </button>

                    {/* Shared (Provisional) */}
                    <button
                        onClick={() => handleFilterChange("status", statusFilter === "SHARED" ? "ALL" : "SHARED", setStatusFilter)}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-md border text-left transition-all hover:border-blue-300",
                            statusFilter === "SHARED"
                                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                : "bg-blue-50/50 border-blue-200/60 hover:bg-blue-50 text-slate-800"
                        )}
                    >
                        <div className={cn(
                            "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                            statusFilter === "SHARED" ? "bg-blue-700 text-blue-100" : "bg-white border border-blue-200 text-blue-600"
                        )}>
                            <Clock className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <div className="text-lg font-bold leading-tight">{summaryCounts.shared}</div>
                            <div className={cn("text-[11px] font-medium", statusFilter === "SHARED" ? "text-blue-100" : "text-slate-500")}>
                                Shared (Provisional)
                            </div>
                        </div>
                    </button>

                    {/* Released (Formal) */}
                    <button
                        onClick={() => handleFilterChange("status", statusFilter === "RELEASED" ? "ALL" : "RELEASED", setStatusFilter)}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-md border text-left transition-all hover:border-emerald-300",
                            statusFilter === "RELEASED"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : "bg-emerald-50/50 border-emerald-200/60 hover:bg-emerald-50 text-slate-800"
                        )}
                    >
                        <div className={cn(
                            "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                            statusFilter === "RELEASED" ? "bg-emerald-700 text-emerald-100" : "bg-white border border-emerald-200 text-emerald-600"
                        )}>
                            <ShieldCheck className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <div className="text-lg font-bold leading-tight">{summaryCounts.released}</div>
                            <div className={cn("text-[11px] font-medium", statusFilter === "RELEASED" ? "text-emerald-100" : "text-slate-500")}>
                                Released (Formal)
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {/* 3. Results Bar & View Selector */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-white px-5 py-3.5 rounded-md border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-700">
                    Showing <span className="text-teal-700">{filteredQuestions.length}</span> {filteredQuestions.length === 1 ? "question" : "questions"}
                    {hasActiveFilters && <span className="text-slate-400 font-normal ml-1">(filtered from {data.questions.length})</span>}
                </div>

                {/* View Mode Selector: Classic, Flow, Compact */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-md border border-slate-200/60">
                    <Button
                        variant={currentViewMode === "classic" ? "secondary" : "ghost"}
                        size="sm"
                        aria-label="Classic view mode"
                        onClick={() => handleViewChange("classic")}
                        className={cn(
                            "h-7 text-xs font-semibold px-2.5 rounded-md gap-1.5 transition-all",
                            currentViewMode === "classic" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <LayoutGrid className="h-3.5 w-3.5 text-teal-600" /> Classic
                    </Button>
                    <Button
                        variant={currentViewMode === "flow" ? "secondary" : "ghost"}
                        size="sm"
                        aria-label="Flow view mode"
                        onClick={() => handleViewChange("flow")}
                        className={cn(
                            "h-7 text-xs font-semibold px-2.5 rounded-md gap-1.5 transition-all",
                            currentViewMode === "flow" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <Rows className="h-3.5 w-3.5 text-teal-600" /> Flow
                    </Button>
                    <Button
                        variant={currentViewMode === "compact" ? "secondary" : "ghost"}
                        size="sm"
                        aria-label="Compact view mode"
                        onClick={() => handleViewChange("compact")}
                        className={cn(
                            "h-7 text-xs font-semibold px-2.5 rounded-md gap-1.5 transition-all",
                            currentViewMode === "compact" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        <TableProperties className="h-3.5 w-3.5 text-teal-600" /> Compact
                    </Button>
                </div>
            </div>

            {/* 4. Question Results Renderers */}
            {filteredQuestions.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-md border border-dashed border-slate-300 p-8 space-y-2">
                    <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-slate-800">No questions found</h3>
                    <p className="text-slate-500 text-xs">
                        Try adjusting your filters or search terms to find questions.
                    </p>
                </div>
            ) : currentViewMode === "classic" ? (
                /* CLASSIC VIEW: Full-width Question Cards */
                <div className="space-y-4">
                    {filteredQuestions.map((q) => {
                        const displayModel = getQuestionDisplayModel(q);
                        const isNotShared = q.answerVisibility === "NOT_SHARED";
                        const isShared = q.answerVisibility === "SHARED";
                        const isReleased = q.answerVisibility === "RELEASED";

                        return (
                            <Card key={q.id} className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-md space-y-0">
                                {/* Header / Context Row */}
                                <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        {q.questionNumber && (
                                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-extrabold text-xs">
                                                #{q.questionNumber}
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-xs font-semibold">
                                            {q.category}
                                        </Badge>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs font-bold text-slate-800 truncate" title={q.clientLEName}>
                                            {q.clientLEName}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs text-slate-500 truncate" title={q.questionnaireName}>
                                            {q.questionnaireName}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <Link href={`/app/s/${orgId}?expand=${q.relationshipId}`} className="text-xs text-teal-700 hover:text-teal-800 font-medium flex items-center gap-1">
                                            <span>Relationship</span> <ArrowRight className="h-3 w-3" />
                                        </Link>

                                        {isReleased ? (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold px-2.5 py-0.5">
                                                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Released · Formal
                                            </Badge>
                                        ) : isShared ? (
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-0.5">
                                                <Clock className="h-3.5 w-3.5 mr-1 text-blue-600" /> Shared · Provisional
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-xs font-semibold px-2.5 py-0.5">
                                                <Lock className="h-3.5 w-3.5 mr-1 text-slate-400" /> Awaiting Client
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <CardContent className="p-6 space-y-6">
                                    {/* Question Text */}
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 shrink-0">
                                                Q:
                                            </span>
                                            <h3 className="text-base font-bold text-slate-900 leading-snug">
                                                {q.questionText || (q as any).text}
                                            </h3>
                                        </div>
                                        {q.guidance && (
                                            <div className="ml-8 p-3 rounded-md bg-blue-50/40 border border-blue-100 text-xs text-blue-900 leading-relaxed">
                                                <span className="font-bold text-blue-600 uppercase text-[10px] tracking-wider mr-2">Guidance:</span>
                                                {q.guidance}
                                            </div>
                                        )}
                                    </div>

                                    {/* Answer Section */}
                                    <div className="pt-4 border-t border-slate-100 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                A:
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Answer</span>
                                        </div>

                                        {isNotShared && (
                                            <div className="ml-8 p-4 rounded-md border border-amber-200 bg-amber-50/30 text-xs text-amber-900 flex items-center gap-2.5 font-medium">
                                                <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                                                <span>Answer not yet shared by the Client.</span>
                                            </div>
                                        )}

                                        {(isShared || isReleased) && (
                                            <div className="ml-8 space-y-4">
                                                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-200/60">
                                                        <span>
                                                            {isReleased ? "Formally issued and locked" : "Provisional answer"}
                                                        </span>
                                                        <span>
                                                            {isReleased && q.releasedAt
                                                                ? `Released ${format(new Date(q.releasedAt), "dd MMM yyyy")}`
                                                                : isShared && q.sharedAt
                                                                ? `Shared ${format(new Date(q.sharedAt), "dd MMM yyyy")}`
                                                                : null}
                                                        </span>
                                                    </div>
                                                    {displayModel && (
                                                        <div className="pt-1 space-y-2">
                                                            <FieldValueRenderer field={displayModel} className="text-sm font-medium text-slate-800" />
                                                            {displayModel.source && (
                                                                <div className="pt-1.5 border-t border-slate-200/60">
                                                                    <FieldSourceBadge source={displayModel.source} showLastValidated={true} variant="span" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Supporting Documents */}
                                                {q.documents && q.documents.length > 0 && (
                                                    <div className="space-y-2 pt-2">
                                                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                            <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                                                            Supporting Documents ({q.documents.length})
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {q.documents.map((doc) => (
                                                                <div key={doc.id} className="p-3 rounded-md border border-slate-200 bg-white flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                                                        <span className="text-xs font-medium text-slate-800 truncate" title={doc.fileName}>
                                                                            {doc.fileName}
                                                                        </span>
                                                                    </div>
                                                                    <Link href={`/api/documents/${doc.id}/download`} target="_blank" className="shrink-0">
                                                                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-slate-600">
                                                                            <Download className="h-3.5 w-3.5" /> Download
                                                                        </Button>
                                                                    </Link>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : currentViewMode === "flow" ? (
                /* FLOW VIEW: Two-Column Internal Card Grid */
                <div className="space-y-4">
                    {filteredQuestions.map((q) => {
                        const displayModel = getQuestionDisplayModel(q);
                        const isNotShared = q.answerVisibility === "NOT_SHARED";
                        const isShared = q.answerVisibility === "SHARED";
                        const isReleased = q.answerVisibility === "RELEASED";

                        return (
                            <Card key={q.id} className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-md">
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        {/* Left Half: Context & Question */}
                                        <div className="lg:col-span-6 space-y-3 lg:border-r lg:border-slate-100 lg:pr-6">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {q.questionNumber && (
                                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-extrabold text-[11px]">
                                                        #{q.questionNumber}
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[11px] font-semibold">
                                                    {q.category}
                                                </Badge>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="text-xs font-bold text-slate-800">{q.clientLEName}</div>
                                                <div className="text-[11px] text-slate-500">{q.questionnaireName}</div>
                                            </div>

                                            <div className="space-y-1.5 pt-2">
                                                <div className="text-xs font-extrabold text-teal-700">Q: Question</div>
                                                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                                    {q.questionText || (q as any).text}
                                                </h3>
                                            </div>

                                            {q.guidance && (
                                                <div className="p-3 rounded-md bg-blue-50/40 border border-blue-100 text-xs text-blue-900 leading-relaxed">
                                                    {q.guidance}
                                                </div>
                                            )}

                                            <Link href={`/app/s/${orgId}?expand=${q.relationshipId}`} className="text-xs text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-1 pt-1">
                                                <span>View Relationship</span> <ArrowRight className="h-3 w-3" />
                                            </Link>
                                        </div>

                                        {/* Right Half: Visibility & Answer */}
                                        <div className="lg:col-span-6 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-extrabold text-slate-700">A: Answer & Status</span>
                                                {isReleased ? (
                                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-semibold">
                                                        Released · Formal
                                                    </Badge>
                                                ) : isShared ? (
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold">
                                                        Shared · Provisional
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[11px] font-semibold">
                                                        Awaiting Client
                                                    </Badge>
                                                )}
                                            </div>

                                            {isNotShared ? (
                                                <div className="p-4 rounded-md border border-amber-200 bg-amber-50/30 text-xs text-amber-900 flex items-center gap-2 font-medium">
                                                    <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                                                    <span>Answer not yet shared by the Client.</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="p-4 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-1">
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                            {isReleased && q.releasedAt
                                                                ? `Released ${format(new Date(q.releasedAt), "dd MMM yyyy")}`
                                                                : isShared && q.sharedAt
                                                                ? `Shared ${format(new Date(q.sharedAt), "dd MMM yyyy")}`
                                                                : "Answer"}
                                                        </div>
                                                        {displayModel && (
                                                            <div className="pt-1 space-y-2">
                                                                <FieldValueRenderer field={displayModel} className="text-sm font-medium text-slate-800" />
                                                                {displayModel.source && (
                                                                    <div className="pt-1.5 border-t border-slate-200/60">
                                                                        <FieldSourceBadge source={displayModel.source} showLastValidated={true} variant="span" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {q.documents && q.documents.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            {q.documents.map((doc) => (
                                                                <div key={doc.id} className="p-2.5 rounded-md border border-slate-200 bg-white flex items-center justify-between text-xs">
                                                                    <span className="truncate font-medium text-slate-800 max-w-[200px]" title={doc.fileName}>
                                                                        {doc.fileName}
                                                                    </span>
                                                                    <Link href={`/api/documents/${doc.id}/download`} target="_blank">
                                                                        <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1">
                                                                            <Download className="h-3 w-3" /> Download
                                                                        </Button>
                                                                    </Link>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                /* COMPACT VIEW: Clean Table Layout */
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-md">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table className="w-full text-left">
                                <TableHeader className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                                    <TableRow>
                                        <TableHead className="w-[140px] px-6 py-3 font-extrabold">Status</TableHead>
                                        <TableHead className="w-[220px] px-6 py-3 font-extrabold">Relationship & Questionnaire</TableHead>
                                        <TableHead className="px-6 py-3 font-extrabold">Question</TableHead>
                                        <TableHead className="px-6 py-3 font-extrabold">Answer</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-slate-100 text-xs">
                                    {filteredQuestions.map((q) => {
                                        const displayModel = getQuestionDisplayModel(q);
                                        const isNotShared = q.answerVisibility === "NOT_SHARED";
                                        const isShared = q.answerVisibility === "SHARED";
                                        const isReleased = q.answerVisibility === "RELEASED";

                                        return (
                                            <TableRow key={q.id} className="hover:bg-slate-50/60 transition-colors">
                                                <TableCell className="px-6 py-4 align-top">
                                                    {isReleased ? (
                                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold py-0.5">
                                                            Released
                                                        </Badge>
                                                    ) : isShared ? (
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold py-0.5">
                                                            Shared
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] font-semibold py-0.5">
                                                            Awaiting Client
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                <TableCell className="px-6 py-4 align-top">
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="font-bold text-slate-900 truncate" title={q.clientLEName}>
                                                            {q.clientLEName}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 truncate" title={q.questionnaireName}>
                                                            {q.questionnaireName}
                                                        </div>
                                                        <Link
                                                            href={`/app/s/${orgId}?expand=${q.relationshipId}`}
                                                            className="text-[11px] text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-0.5 pt-0.5"
                                                        >
                                                            <span>Relationship</span> <ArrowRight className="h-2.5 w-2.5" />
                                                        </Link>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="px-6 py-4 align-top">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {q.questionNumber && (
                                                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                    #{q.questionNumber}
                                                                </span>
                                                            )}
                                                            <Badge variant="outline" className="text-[10px] font-medium border-slate-200 text-slate-500">
                                                                {q.category}
                                                            </Badge>
                                                        </div>
                                                        <div className="font-bold text-slate-900 leading-snug">
                                                            {q.questionText || (q as any).text}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="px-6 py-4 align-top">
                                                    {isNotShared ? (
                                                        <span className="text-slate-400 italic">Answer not yet shared</span>
                                                    ) : (
                                                        <div className="space-y-1.5 min-w-0">
                                                            {displayModel && (
                                                                <div className="space-y-1">
                                                                    <FieldValueRenderer field={displayModel} className="text-xs font-medium text-slate-800" />
                                                                    {displayModel.source && (
                                                                        <div className="pt-0.5">
                                                                            <FieldSourceBadge source={displayModel.source} showLastValidated={true} variant="span" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {q.documents && q.documents.length > 0 && (
                                                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                                    <Paperclip className="h-3 w-3 text-slate-400" />
                                                                    <span>{q.documents.length} document(s)</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export function SupplierQuestionsWorkbench(props: SupplierQuestionsWorkbenchProps) {
    return (
        <Suspense fallback={null}>
            <SupplierQuestionsWorkbenchInner {...props} />
        </Suspense>
    );
}
