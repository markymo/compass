"use client";

import { useState, useMemo } from "react";
import { Wb2SourceData, Wb2SourcePath } from "@/actions/mapping-workbench-2";
import { Selection, RelationshipHighlights } from "./MappingWorkbench2";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Search, X, CheckCircle2, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
    sources: Wb2SourceData[];
    activeSources: string[];
    onSourceToggle: (key: string) => void;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
}

const SOURCE_ACCENT: Record<string, { dot: string; check: string; label: string }> = {
    GLEIF:       { dot: "bg-purple-500", check: "border-purple-300 bg-purple-50",  label: "text-purple-800" },
    CH_RA000585: { dot: "bg-red-500",    check: "border-red-300 bg-red-50",        label: "text-red-800"    },
    FR_RA000192: { dot: "bg-blue-500",   check: "border-blue-300 bg-blue-50",      label: "text-blue-800"   },
};

const PATH_SOURCE_BADGE: Record<string, string> = {
    GLEIF:       "bg-purple-100 text-purple-700",
    CH_RA000585: "bg-red-100 text-red-700",
    FR_RA000192: "bg-blue-100 text-blue-700",
};

function sourceShortLabel(key: string): string {
    if (key === "GLEIF") return "GLEIF";
    if (key === "CH_RA000585") return "CH";
    if (key === "FR_RA000192") return "FR";
    return key;
}

export function SourceColumn({ sources, activeSources, onSourceToggle, selection, highlights, onSelect }: Props) {
    const [search, setSearch] = useState("");
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

    // Merge paths from all active sources into a single flat list,
    // annotating each path with its sourceKey.
    const allPaths = useMemo(() => {
        const result: Array<Wb2SourcePath & { sourceKey: string }> = [];
        for (const src of sources) {
            if (!activeSources.includes(src.sourceKey)) continue;
            for (const p of src.paths) {
                result.push({ ...p, sourceKey: src.sourceKey });
            }
        }
        // Sort: mapped first, then alphabetical
        result.sort((a, b) => {
            const aM = a.isMapped ? 0 : 1;
            const bM = b.isMapped ? 0 : 1;
            if (aM !== bM) return aM - bM;
            return a.path.localeCompare(b.path);
        });
        return result;
    }, [sources, activeSources]);

    const filtered = useMemo(() => {
        let list = allPaths;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.path.toLowerCase().includes(q) ||
                p.meaning?.toLowerCase().includes(q) ||
                p.exampleValue?.toLowerCase().includes(q)
            );
        }
        if (showUnmappedOnly) {
            list = list.filter(p => !p.isMapped);
        }
        return list;
    }, [allPaths, search, showUnmappedOnly]);

    // Coverage totals across active sources
    const totalMapped = sources
        .filter(s => activeSources.includes(s.sourceKey))
        .reduce((sum, s) => sum + s.mappedCount, 0);
    const totalAvailable = sources
        .filter(s => activeSources.includes(s.sourceKey))
        .reduce((sum, s) => sum + s.availableCount, 0);

    return (
        <div className="flex flex-col w-[32%] min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Column header */}
            <div className="border-b border-slate-100 p-3 space-y-2.5 shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Source</span>

                {/* Source checklist */}
                <div className="space-y-1.5">
                    {sources.map(src => {
                        const isChecked = activeSources.includes(src.sourceKey);
                        const accent = SOURCE_ACCENT[src.sourceKey] ?? {
                            dot: "bg-slate-400", check: "border-slate-200 bg-slate-50", label: "text-slate-700"
                        };
                        return (
                            <label
                                key={src.sourceKey}
                                className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors select-none",
                                    isChecked
                                        ? cn("border", accent.check)
                                        : "border-slate-100 hover:bg-slate-50"
                                )}
                            >
                                {/* Custom checkbox */}
                                <div
                                    className={cn(
                                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                        isChecked
                                            ? "bg-emerald-500 border-emerald-500"
                                            : "border-slate-300 bg-white"
                                    )}
                                    onClick={() => onSourceToggle(src.sourceKey)}
                                >
                                    {isChecked && (
                                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isChecked}
                                    onChange={() => onSourceToggle(src.sourceKey)}
                                />
                                <div className={cn("w-2 h-2 rounded-full shrink-0", accent.dot)} />
                                <span className={cn("text-xs font-medium flex-1", isChecked ? accent.label : "text-slate-500")}>
                                    {src.label}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                    {src.mappedCount}/{src.availableCount}
                                </span>
                            </label>
                        );
                    })}
                </div>

                {/* Coverage summary (across all active) */}
                {activeSources.length > 0 && (
                    <div className="flex gap-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-semibold text-slate-700">
                            {activeSources.length === 1
                                ? sources.find(s => s.sourceKey === activeSources[0])?.label
                                : `${activeSources.length} sources`}
                        </span>
                        <span>·</span>
                        <span><span className="font-medium text-emerald-600">{totalMapped}</span> mapped</span>
                        <span>·</span>
                        <span><span className="font-medium text-slate-600">{totalAvailable}</span> available</span>
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search paths…"
                        className="pl-8 h-8 text-xs border-slate-200"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Unmapped only toggle */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Unmapped only</span>
                    <Switch
                        checked={showUnmappedOnly}
                        onCheckedChange={setShowUnmappedOnly}
                    />
                </div>
            </div>

            {/* Path list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {activeSources.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">Select at least one source above</div>
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">No paths match</div>
                ) : (
                    filtered.map((p, i) => (
                        <PathRow
                            key={`${p.sourceKey}::${p.path}::${i}`}
                            path={p}
                            sourceKey={p.sourceKey}
                            showSourceBadge={activeSources.length > 1}
                            selection={selection}
                            highlights={highlights}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </div>

            <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 shrink-0">
                {filtered.length} of {allPaths.length} paths
            </div>
        </div>
    );
}

function PathRow({ path, sourceKey, showSourceBadge, selection, highlights, onSelect }: {
    path: Wb2SourcePath & { sourceKey: string };
    sourceKey: string;
    showSourceBadge: boolean;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
}) {
    const composite = `${sourceKey}::${path.path}`;
    const isSelected = selection?.kind === "path" && selection.sourceKey === sourceKey && selection.path === path.path;
    const isHighlighted = highlights.paths.has(composite);
    const isDimmed = highlights.hasSelection && !isHighlighted;
    const activeMappings = path.mappings.filter(m => m.isActive);

    return (
        <button
            onClick={() => onSelect({ kind: "path", sourceKey, path: path.path })}
            className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-2 transition-all border-l-2",
                isSelected   ? "bg-violet-50 border-l-violet-500" :
                isHighlighted ? "bg-indigo-50 border-l-indigo-400" :
                "border-l-transparent hover:bg-slate-50",
                isDimmed && "opacity-30"
            )}
        >
            <div className="mt-0.5 shrink-0">
                {path.isMapped
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    : <Circle className="w-3.5 h-3.5 text-slate-300" />
                }
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <code className="text-[11px] font-mono text-slate-700 break-all leading-tight">
                        {path.path}
                    </code>
                    {showSourceBadge && (
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0", PATH_SOURCE_BADGE[sourceKey] ?? "bg-slate-100 text-slate-600")}>
                            {sourceShortLabel(sourceKey)}
                        </span>
                    )}
                </div>
                {path.meaning && (
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{path.meaning}</p>
                )}
                {path.exampleValue && (
                    <p className="text-[10px] font-mono text-emerald-700 mt-0.5 truncate">{path.exampleValue}</p>
                )}
                {activeMappings.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {activeMappings.map(m => (
                            <span key={m.mappingId} className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                → F{m.targetFieldNo} {m.targetFieldName}
                            </span>
                        ))}
                        {activeMappings.length > 1 && (
                            <span className="text-[9px] text-slate-400">({activeMappings.length} mappings)</span>
                        )}
                    </div>
                )}
            </div>
        </button>
    );
}
