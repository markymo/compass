"use client";

import { useState, useMemo } from "react";
import { Wb2MasterField } from "@/actions/mapping-workbench-2";
import { Selection, RelationshipHighlights } from "./MappingWorkbench2";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Search, X, AlertCircle, Repeat2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const SOURCE_BADGE: Record<string, string> = {
    GLEIF:       "bg-purple-100 text-purple-700",
    CH_RA000585: "bg-red-100 text-red-700",
    FR_RA000192: "bg-blue-100 text-blue-700",
};

const SOURCE_LABEL: Record<string, string> = {
    "GLEIF":                                    "GLEIF",
    "REGISTRATION_AUTHORITY:RA000585":          "CH",
    "REGISTRATION_AUTHORITY:RA000192":          "FR",
    "GLEIF:null":                               "GLEIF",
};

function sourceLabel(key: string): string {
    return SOURCE_LABEL[key] ?? key.split(":").pop() ?? key;
}

function sourceBadgeClass(key: string): string {
    if (key.startsWith("GLEIF")) return SOURCE_BADGE["GLEIF"];
    if (key.includes("RA000585")) return SOURCE_BADGE["CH_RA000585"];
    if (key.includes("RA000192")) return SOURCE_BADGE["FR_RA000192"];
    return "bg-slate-100 text-slate-600";
}

interface Props {
    fields: Wb2MasterField[];
    mappedCount: number;
    unmappedCount: number;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
}

export function MasterDataColumn({ fields, mappedCount, unmappedCount, selection, highlights, onSelect }: Props) {
    const [search, setSearch] = useState("");
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

    const filtered = useMemo(() => {
        let list = fields;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(f =>
                f.fieldName.toLowerCase().includes(q) ||
                String(f.fieldNo).includes(q) ||
                f.categoryName?.toLowerCase().includes(q)
            );
        }
        if (showUnmappedOnly) {
            list = list.filter(f => f.mappedBySources.length === 0);
        }
        return list;
    }, [fields, search, showUnmappedOnly]);

    return (
        <div className="flex flex-col flex-1 min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Column header */}
            <div className="border-b border-slate-100 p-3 space-y-2 shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Master Data</span>

                {/* Coverage summary */}
                <div className="flex gap-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-slate-700">{fields.length} fields</span>
                    <span>·</span>
                    <span><span className="font-medium text-emerald-600">{mappedCount}</span> mapped</span>
                    <span>·</span>
                    <span><span className="font-medium text-amber-600">{unmappedCount}</span> unmapped</span>
                </div>

                {/* Search + filter */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search fields…"
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
            </div>

            {/* Field list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {filtered.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">No fields match</div>
                ) : (
                    filtered.map(f => (
                        <FieldRow
                            key={f.fieldNo}
                            field={f}
                            selection={selection}
                            highlights={highlights}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </div>

            <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 shrink-0">
                {filtered.length} of {fields.length} fields
            </div>
        </div>
    );
}

function FieldRow({ field, selection, highlights, onSelect }: {
    field: Wb2MasterField;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
}) {
    const isSelected = selection?.kind === "field" && selection.fieldNo === field.fieldNo;
    const isHighlighted = highlights.fields.has(field.fieldNo);
    const isDimmed = highlights.hasSelection && !isHighlighted;

    return (
        <button
            onClick={() => onSelect({ kind: "field", fieldNo: field.fieldNo })}
            className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-2 transition-all border-l-2",
                isSelected ? "bg-violet-50 border-l-violet-500" :
                isHighlighted ? "bg-indigo-50 border-l-indigo-400" :
                "border-l-transparent hover:bg-slate-50",
                isDimmed && "opacity-30"
            )}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">F{field.fieldNo}</span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{field.fieldName}</span>
                    {field.isMultiValue && (
                        <Repeat2 className="w-3 h-3 text-blue-500 shrink-0" />
                    )}
                    {field.hasError && (
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                    )}
                </div>

                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {field.categoryName && (
                        <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {field.categoryName}
                        </span>
                    )}
                    {field.mappedBySources.map(src => (
                        <span key={src} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", sourceBadgeClass(src))}>
                            {sourceLabel(src)}
                        </span>
                    ))}
                    {field.mappedBySources.length === 0 && (
                        <span className="text-[9px] text-slate-400 italic">no source</span>
                    )}
                    {field.questionCount > 0 && (
                        <span className="text-[9px] text-slate-400">
                            {field.questionCount}Q
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}
