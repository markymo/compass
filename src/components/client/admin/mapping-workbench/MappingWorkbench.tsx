"use client";

import { useState, useMemo } from "react";
import { WorkbenchPageData, WorkbenchField } from "@/actions/mapping-workbench";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Search, GitMerge, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldDetailPanel } from "./FieldDetailPanel";

const SOURCE_COLOURS: Record<string, string> = {
    GLEIF: "bg-purple-100 text-purple-700 border-purple-200",
    REGISTRATION_AUTHORITY: "bg-red-100 text-red-700 border-red-200",
    COMPANIES_HOUSE: "bg-red-100 text-red-700 border-red-200",
    USER_INPUT: "bg-slate-100 text-slate-600 border-slate-200",
    AI_EXTRACTION: "bg-green-100 text-green-700 border-green-200",
};

type FilterMode = "all" | "warnings" | "errors" | "no-mapping" | "repeating";

export function MappingWorkbench({ data }: { data: WorkbenchPageData }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterMode>("all");
    const [selectedFieldNo, setSelectedFieldNo] = useState<number | null>(null);

    const filtered = useMemo(() => {
        let list = data.fields;

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(f =>
                f.fieldName.toLowerCase().includes(q) ||
                String(f.fieldNo).includes(q) ||
                f.categoryName?.toLowerCase().includes(q) ||
                f.sourceMappings.some(m => m.sourcePath.toLowerCase().includes(q) || m.pathMeaning?.toLowerCase().includes(q))
            );
        }

        switch (filter) {
            case "errors":    list = list.filter(f => f.errorCount > 0); break;
            case "warnings":  list = list.filter(f => f.warningCount > 0); break;
            case "no-mapping":list = list.filter(f => f.sourceMappings.filter(m => m.isActive).length === 0); break;
            case "repeating": list = list.filter(f => f.isMultiValue); break;
        }

        return list;
    }, [data.fields, search, filter]);

    const selected = selectedFieldNo != null
        ? data.fields.find(f => f.fieldNo === selectedFieldNo) ?? null
        : null;

    const filterButtons: { label: string; value: FilterMode; count?: number }[] = [
        { label: "All fields", value: "all", count: data.totalFields },
        { label: "Has warnings", value: "warnings", count: data.totalWithWarnings },
        { label: "Errors", value: "errors", count: data.totalErrors },
        { label: "No source mapping", value: "no-mapping" },
        { label: "Repeating", value: "repeating" },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-0">
            {/* ── Header ── */}
            <div className="flex flex-col gap-1 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <GitMerge className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mapping Workbench Idea 1</h1>
                        <p className="text-sm text-slate-500">Trace source fields → master schema → questionnaire usage</p>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span>{data.totalFields} fields</span>
                    <span>·</span>
                    <span>{data.totalMappings} source mappings</span>
                    <span>·</span>
                    <span className={data.totalErrors > 0 ? "text-red-600 font-medium" : ""}>{data.totalErrors} errors</span>
                    <span>·</span>
                    <span className={data.totalWithWarnings > 0 ? "text-amber-600 font-medium" : ""}>{data.totalWithWarnings} with warnings</span>
                </div>
            </div>

            {/* ── Main split layout ── */}
            <div className="flex gap-4 flex-1 min-h-0">

                {/* Left: search + list */}
                <div className={cn(
                    "flex flex-col gap-3 shrink-0 transition-all duration-200",
                    selected ? "w-80" : "w-full max-w-lg"
                )}>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search fields, paths, meanings…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-9 text-sm bg-white border-slate-200"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter pills */}
                    <div className="flex flex-wrap gap-1.5">
                        {filterButtons.map(btn => (
                            <button
                                key={btn.value}
                                onClick={() => setFilter(btn.value)}
                                className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                    filter === btn.value
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                )}
                            >
                                {btn.label}
                                {btn.count !== undefined && (
                                    <span className={cn("ml-1.5 font-mono", filter === btn.value ? "text-indigo-200" : "text-slate-400")}>
                                        {btn.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Field list */}
                    <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center text-sm text-slate-400">No fields match your search</div>
                        ) : (
                            filtered.map(f => (
                                <FieldListRow
                                    key={f.fieldNo}
                                    field={f}
                                    isSelected={f.fieldNo === selectedFieldNo}
                                    onClick={() => setSelectedFieldNo(f.fieldNo === selectedFieldNo ? null : f.fieldNo)}
                                    compact={!!selected}
                                />
                            ))
                        )}
                    </div>

                    <div className="text-xs text-slate-400 text-right shrink-0">
                        {filtered.length} of {data.totalFields} fields
                    </div>
                </div>

                {/* Right: detail panel */}
                {selected && (
                    <div className="flex-1 min-w-0 overflow-y-auto">
                        <FieldDetailPanel
                            field={selected}
                            onClose={() => setSelectedFieldNo(null)}
                        />
                    </div>
                )}

                {/* Empty state when no field selected */}
                {!selected && (
                    <div className="flex-1 hidden lg:flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50">
                        <div className="text-center space-y-2">
                            <GitMerge className="w-10 h-10 text-slate-300 mx-auto" />
                            <p className="text-sm font-medium text-slate-500">Select a field to inspect</p>
                            <p className="text-xs text-slate-400">Source mappings · Claims · Questionnaire usage · Warnings</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function FieldListRow({ field, isSelected, onClick, compact }: {
    field: WorkbenchField;
    isSelected: boolean;
    onClick: () => void;
    compact: boolean;
}) {
    const activeSources = field.sourceMappings.filter(m => m.isActive);
    const sourceTypes = [...new Set(activeSources.map(m => m.sourceType))];
    const hasErrors = field.errorCount > 0;
    const hasWarnings = field.warningCount > 0 && !hasErrors;
    const allGood = field.warningCount === 0 && activeSources.length > 0;

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors group",
                isSelected
                    ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                    : "hover:bg-slate-50 border-l-2 border-l-transparent"
            )}
        >
            {/* Status indicator */}
            <div className="mt-0.5 shrink-0">
                {hasErrors   && <AlertCircle className="w-4 h-4 text-red-500" />}
                {hasWarnings && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                {allGood     && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {!hasErrors && !hasWarnings && !allGood && (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">F{field.fieldNo}</span>
                    <span className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-indigo-900" : "text-slate-800 group-hover:text-slate-900"
                    )}>
                        {field.fieldName}
                    </span>
                </div>

                {!compact && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {field.categoryName && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {field.categoryName}
                            </span>
                        )}
                        {field.isMultiValue && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                                Repeating
                            </span>
                        )}
                        {sourceTypes.map(st => (
                            <span key={st} className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", SOURCE_COLOURS[st] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                                {st === "REGISTRATION_AUTHORITY" ? "Registry" : st}
                            </span>
                        ))}
                        {activeSources.length === 0 && (
                            <span className="text-[10px] text-slate-400 italic">no source</span>
                        )}
                    </div>
                )}

                {compact && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{field.categoryName ?? field.appDataType}</p>
                )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
                {field.warningCount > 0 && (
                    <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        hasErrors ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                    )}>
                        {field.warningCount}
                    </span>
                )}
                <ChevronRight className={cn("w-3.5 h-3.5 text-slate-300", isSelected && "text-indigo-400")} />
            </div>
        </button>
    );
}
