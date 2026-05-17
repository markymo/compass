"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Wb2MasterField, Wb2PathMapping } from "@/actions/mapping-workbench-2";
import { Selection, RelationshipHighlights } from "./MappingWorkbench2";
import { MappingSlideOver } from "./MappingSlideOver";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Search, X, AlertCircle, Repeat2, Plus, CheckCircle2, Edit2, ZapOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toggleSourceMapping } from "@/actions/source-mappings";
import { toast } from "sonner";

// ── Source helpers ──────────────────────────────────────────────────────────

function sourceBadgeClass(key: string): string {
    if (key.startsWith("GLEIF")) return "bg-purple-100 text-purple-700";
    if (key.includes("RA000585")) return "bg-red-100 text-red-700";
    if (key.includes("RA000192")) return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-600";
}

function sourceShortLabel(key: string): string {
    if (key.startsWith("GLEIF")) return "GLEIF";
    if (key.includes("RA000585")) return "CH";
    if (key.includes("RA000192")) return "FR";
    return key.split(":").pop()?.slice(0, 6) ?? key;
}

// ── Slide-over state ────────────────────────────────────────────────────────

interface SlideOverState {
    open: boolean;
    sourceType: string;
    sourceReference: string | null;
    sourcePath: string;
    sourceLabel: string;
    pathMeaning: string | null;
    exampleValue: string | null;
    targetFieldNo: number;
    targetFieldName: string;
    existingMapping: Wb2PathMapping | null;
}

const CLOSED_SLIDE_OVER: SlideOverState = {
    open: false,
    sourceType: "",
    sourceReference: null,
    sourcePath: "",
    sourceLabel: "",
    pathMeaning: null,
    exampleValue: null,
    targetFieldNo: 0,
    targetFieldName: "",
    existingMapping: null,
};

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
    fields: Wb2MasterField[];
    mappedCount: number;
    unmappedCount: number;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;

    // Passed from parent so Path Context Mode can read existing mappings
    sources: import("@/actions/mapping-workbench-2").Wb2SourceData[];
}

// ── Main component ──────────────────────────────────────────────────────────

export function MasterDataColumn({ fields, mappedCount, unmappedCount, selection, highlights, onSelect, sources }: Props) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
    const [slideOver, setSlideOver] = useState<SlideOverState>(CLOSED_SLIDE_OVER);

    // ── Path Context Mode ───────────────────────────────────────────────
    const pathSelection = selection?.kind === "path" ? selection : null;

    // Find the selected path's data from sources
    const selectedPathData = useMemo(() => {
        if (!pathSelection) return null;
        const src = sources.find(s => s.sourceKey === pathSelection.sourceKey);
        return src?.paths.find(p => p.path === pathSelection.path) ?? null;
    }, [pathSelection, sources]);

    const selectedSource = useMemo(() => {
        if (!pathSelection) return null;
        return sources.find(s => s.sourceKey === pathSelection.sourceKey) ?? null;
    }, [pathSelection, sources]);

    // Fields already mapped from the selected path (to exclude from Section 2)
    const alreadyMappedFieldNos = useMemo(
        () => new Set(selectedPathData?.mappings.map(m => m.targetFieldNo) ?? []),
        [selectedPathData]
    );

    // Section 2 field list: exclude already-mapped fields
    const section2Fields = useMemo(() => {
        let list = fields.filter(f => !alreadyMappedFieldNos.has(f.fieldNo));
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
    }, [fields, alreadyMappedFieldNos, search, showUnmappedOnly]);

    // Non-path-context field list (global mode)
    const filteredFields = useMemo(() => {
        let list = fields;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(f =>
                f.fieldName.toLowerCase().includes(q) ||
                String(f.fieldNo).includes(q) ||
                f.categoryName?.toLowerCase().includes(q)
            );
        }
        if (showUnmappedOnly) list = list.filter(f => f.mappedBySources.length === 0);
        return list;
    }, [fields, search, showUnmappedOnly]);

    function openCreate(targetFieldNo: number, targetFieldName: string) {
        if (!selectedSource || !selectedPathData) return;
        setSlideOver({
            open: true,
            sourceType: selectedSource.sourceType,
            sourceReference: selectedSource.sourceReference,
            sourcePath: pathSelection!.path,
            sourceLabel: selectedSource.label,
            pathMeaning: selectedPathData.meaning,
            exampleValue: selectedPathData.exampleValue,
            targetFieldNo,
            targetFieldName,
            existingMapping: null,
        });
    }

    function openEdit(mapping: Wb2PathMapping) {
        if (!selectedSource || !selectedPathData) return;
        setSlideOver({
            open: true,
            sourceType: selectedSource.sourceType,
            sourceReference: selectedSource.sourceReference,
            sourcePath: pathSelection!.path,
            sourceLabel: selectedSource.label,
            pathMeaning: selectedPathData.meaning,
            exampleValue: selectedPathData.exampleValue,
            targetFieldNo: mapping.targetFieldNo,
            targetFieldName: mapping.targetFieldName ?? `F${mapping.targetFieldNo}`,
            existingMapping: mapping,
        });
    }

    async function handleToggle(mapping: Wb2PathMapping) {
        const res = await toggleSourceMapping(mapping.mappingId, !mapping.isActive);
        if (res.success) {
            toast.success(mapping.isActive ? "Mapping deactivated" : "Mapping activated");
            router.refresh();
        } else {
            toast.error("Failed to toggle mapping");
        }
    }

    function handleSuccess() {
        router.refresh();
    }

    // ── PATH CONTEXT MODE render ────────────────────────────────────────
    if (pathSelection && selectedPathData) {
        const existingMappings = selectedPathData.mappings;

        return (
            <div className="flex flex-col flex-1 min-w-0 rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
                {/* Path context banner */}
                <div className="border-b border-violet-100 bg-violet-50 p-3 shrink-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Path Context</span>
                        <span className="text-[10px] text-violet-400">·</span>
                        <span className="text-[10px] font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                            {selectedSource?.label}
                        </span>
                    </div>
                    <code className="text-xs font-mono text-violet-900 break-all block">{pathSelection.path}</code>
                    {selectedPathData.meaning && (
                        <p className="text-[11px] text-violet-600">{selectedPathData.meaning}</p>
                    )}
                    <p className="text-[10px] text-violet-500 pt-0.5">
                        {existingMappings.length === 0
                            ? "No mappings yet — click + on any field below to create one"
                            : `${existingMappings.length} mapping${existingMappings.length !== 1 ? "s" : ""} · click any field below to add another`
                        }
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* ── Section 1: Existing mappings ── */}
                    {existingMappings.length > 0 && (
                        <div className="border-b border-slate-100">
                            <div className="px-3 pt-3 pb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Current Mappings ({existingMappings.length})
                                </span>
                            </div>
                            {existingMappings.map(m => (
                                <MappingCard
                                    key={m.mappingId}
                                    mapping={m}
                                    onEdit={() => openEdit(m)}
                                    onToggle={() => handleToggle(m)}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Section 2: Add mapping ── */}
                    <div>
                        <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Add Mapping To Field
                            </span>
                            <span className="text-[10px] text-slate-400">
                                ({section2Fields.length} available)
                            </span>
                        </div>

                        {/* Search */}
                        <div className="px-3 pb-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search fields…"
                                    className="pl-8 h-8 text-xs border-slate-200"
                                />
                            </div>
                        </div>

                        {section2Fields.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                {alreadyMappedFieldNos.size === fields.length
                                    ? "All fields are already mapped from this path"
                                    : "No fields match"}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {section2Fields.map(f => (
                                    <FieldRowAddable
                                        key={f.fieldNo}
                                        field={f}
                                        onAdd={() => openCreate(f.fieldNo, f.fieldName)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <MappingSlideOver
                    {...slideOver}
                    onOpenChange={open => setSlideOver(s => ({ ...s, open }))}
                    onSuccess={handleSuccess}
                />
            </div>
        );
    }

    // ── GLOBAL MODE render ──────────────────────────────────────────────
    return (
        <div className="flex flex-col flex-1 min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 p-3 space-y-2 shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Master Data</span>

                <div className="flex gap-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-slate-700">{fields.length} fields</span>
                    <span>·</span>
                    <span><span className="font-medium text-emerald-600">{mappedCount}</span> mapped</span>
                    <span>·</span>
                    <span><span className="font-medium text-amber-600">{unmappedCount}</span> unmapped</span>
                </div>

                <div className="relative">
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

                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Unmapped only</span>
                    <Switch checked={showUnmappedOnly} onCheckedChange={setShowUnmappedOnly} />
                </div>

                {/* Hint */}
                <p className="text-[10px] text-slate-400 italic">
                    Select a source path in Column 1 to manage its mappings
                </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {filteredFields.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">No fields match</div>
                ) : (
                    filteredFields.map(f => (
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
                {filteredFields.length} of {fields.length} fields
            </div>
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MappingCard({ mapping, onEdit, onToggle }: {
    mapping: Wb2PathMapping;
    onEdit: () => void;
    onToggle: () => void;
}) {
    return (
        <div className={cn(
            "mx-3 my-2 rounded-lg border p-3 space-y-1.5",
            mapping.isActive
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-slate-50 opacity-60"
        )}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0", mapping.isActive ? "text-emerald-500" : "text-slate-400")} />
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">F{mapping.targetFieldNo}</span>
                    <span className="text-sm font-semibold text-slate-800 truncate">{mapping.targetFieldName}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={onEdit}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Edit mapping"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onToggle}
                        className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title={mapping.isActive ? "Deactivate" : "Activate"}
                    >
                        <ZapOff className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div className="flex gap-3 text-[10px] text-slate-500">
                <span className="font-mono bg-white border border-slate-100 rounded px-1.5 py-0.5">{mapping.transformType}</span>
                <span>pri {mapping.priority}</span>
                <span>{Math.round(mapping.confidenceDefault * 100)}% conf</span>
                {!mapping.isActive && <span className="text-amber-600 font-medium">Inactive</span>}
            </div>
            {mapping.notes && (
                <p className="text-[10px] text-slate-500 italic">{mapping.notes}</p>
            )}
        </div>
    );
}

function FieldRowAddable({ field, onAdd }: {
    field: Wb2MasterField;
    onAdd: () => void;
}) {
    return (
        <div className="px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 group">
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">F{field.fieldNo}</span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{field.fieldName}</span>
                    {field.isMultiValue && <Repeat2 className="w-3 h-3 text-blue-500 shrink-0" />}
                    {field.hasError && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                </div>
                {field.categoryName && (
                    <span className="text-[9px] text-slate-400">{field.categoryName}</span>
                )}
            </div>
            {field.mappedBySources.map(src => (
                <span key={src} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0", sourceBadgeClass(src))}>
                    {sourceShortLabel(src)}
                </span>
            ))}
            <button
                onClick={onAdd}
                className="shrink-0 w-6 h-6 rounded-full bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title={`Map to F${field.fieldNo} ${field.fieldName}`}
            >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
            </button>
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
                isSelected    ? "bg-violet-50 border-l-violet-500" :
                isHighlighted ? "bg-indigo-50 border-l-indigo-400" :
                "border-l-transparent hover:bg-slate-50",
                isDimmed && "opacity-30"
            )}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">F{field.fieldNo}</span>
                    <span className="text-xs font-semibold text-slate-800 truncate">{field.fieldName}</span>
                    {field.isMultiValue && <Repeat2 className="w-3 h-3 text-blue-500 shrink-0" />}
                    {field.hasError && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {field.categoryName && (
                        <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{field.categoryName}</span>
                    )}
                    {field.mappedBySources.map(src => (
                        <span key={src} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", sourceBadgeClass(src))}>
                            {sourceShortLabel(src)}
                        </span>
                    ))}
                    {field.mappedBySources.length === 0 && (
                        <span className="text-[9px] text-slate-400 italic">no source</span>
                    )}
                    {field.questionCount > 0 && (
                        <span className="text-[9px] text-slate-400">{field.questionCount}Q</span>
                    )}
                </div>
            </div>
        </button>
    );
}
