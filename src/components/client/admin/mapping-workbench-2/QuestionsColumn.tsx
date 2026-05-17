"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Wb2Questionnaire, Wb2Question } from "@/actions/mapping-workbench-2";
import { Selection, RelationshipHighlights } from "./MappingWorkbench2";
import { assignQuestionToMasterField } from "@/actions/question-mapping";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X, ArrowRight, Minus, Plus, Link2Off, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ── Status badge colours ────────────────────────────────────────────────────
const STATUS_COLOURS: Record<string, string> = {
    DRAFT:    "bg-slate-100 text-slate-500",
    APPROVED: "bg-blue-100 text-blue-700",
    SHARED:   "bg-amber-100 text-amber-700",
    RELEASED: "bg-emerald-100 text-emerald-700",
};

// ── Source badge helpers ────────────────────────────────────────────────────
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

// ── Props ───────────────────────────────────────────────────────────────────
interface Props {
    questionnaires: Wb2Questionnaire[];
    activeQnaireId: string;
    onQnaireChange: (id: string) => void;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
    /** Live resolved values for the currently selected field, keyed by sourceKey */
    fieldLiveValues: Record<string, string>;
}

// ── Main component ──────────────────────────────────────────────────────────
export function QuestionsColumn({
    questionnaires, activeQnaireId, onQnaireChange,
    selection, highlights, onSelect, fieldLiveValues,
}: Props) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);

    const activeQnaire = questionnaires.find(q => q.id === activeQnaireId) ?? questionnaires[0];
    const fieldSelection = selection?.kind === "field" ? selection : null;

    // ── Field Context Mode data ─────────────────────────────────────────
    const section1Questions = useMemo(() => {
        if (!fieldSelection || !activeQnaire) return [];
        return activeQnaire.questions.filter(q => q.masterFieldNo === fieldSelection.fieldNo);
    }, [fieldSelection, activeQnaire]);

    const section2Questions = useMemo(() => {
        if (!fieldSelection || !activeQnaire) return [];
        let list = activeQnaire.questions.filter(q => q.masterFieldNo !== fieldSelection.fieldNo);
        if (search.trim()) {
            const q2 = search.toLowerCase();
            list = list.filter(q => q.text.toLowerCase().includes(q2));
        }
        if (showUnmappedOnly) {
            list = list.filter(q => !q.isMapped);
        }
        return list;
    }, [fieldSelection, activeQnaire, search, showUnmappedOnly]);

    // ── Global mode data ────────────────────────────────────────────────
    const filteredQuestions = useMemo(() => {
        if (!activeQnaire) return [];
        let list = activeQnaire.questions;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(q2 => q2.text.toLowerCase().includes(q));
        }
        if (showUnmappedOnly) list = list.filter(q => !q.isMapped);
        return list;
    }, [activeQnaire, search, showUnmappedOnly]);

    async function handleAssign(questionId: string, masterFieldNo: number | null) {
        setPendingId(questionId);
        try {
            const res = await assignQuestionToMasterField(questionId, masterFieldNo);
            if (res.success) {
                toast.success(masterFieldNo !== null ? "Question mapped to field" : "Mapping cleared");
                router.refresh();
            } else {
                toast.error(res.error ?? "Failed to update mapping");
            }
        } finally {
            setPendingId(null);
        }
    }

    // ── FIELD CONTEXT MODE ──────────────────────────────────────────────
    if (fieldSelection) {
        return (
            <div className="flex flex-col w-[32%] min-w-0 rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
                {/* Field context banner */}
                <div className="border-b border-violet-100 bg-violet-50 p-3 shrink-0 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Field Context</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-violet-500">F{fieldSelection.fieldNo}</span>
                        <span className="text-sm font-semibold text-violet-900 truncate">
                            {/* find field name from section1 or hints */}
                            {section1Questions[0]?.masterFieldName ?? `Field ${fieldSelection.fieldNo}`}
                        </span>
                    </div>
                    {/* Questionnaire selector */}
                    <div className="relative mt-1">
                        <select
                            value={activeQnaireId}
                            onChange={e => onQnaireChange(e.target.value)}
                            className="w-full text-[11px] font-medium text-violet-700 bg-violet-100/60 border border-violet-200 rounded-md px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-1 focus:ring-violet-400"
                        >
                            {questionnaires.map(q => (
                                <option key={q.id} value={q.id}>{q.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-500 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-violet-500 pt-0.5">
                        {section1Questions.length === 0
                            ? "No questions linked to this field — click + below to link one"
                            : `${section1Questions.length} question${section1Questions.length !== 1 ? "s" : ""} linked · click + to add more`}
                    </p>
                    {/* Live example values for this field */}
                    {Object.keys(fieldLiveValues).length > 0 && (
                        <div className="mt-1 space-y-0.5">
                            {Object.entries(fieldLiveValues).map(([src, val]) => (
                                <div key={src} className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Live</span>
                                    <code className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 truncate max-w-[180px]">{val}</code>
                                    <span className="text-[9px] text-violet-400 shrink-0">{src.split("_")[0]}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* ── Section 1: Linked questions ── */}
                    {section1Questions.length > 0 && (
                        <div className="border-b border-slate-100">
                            <div className="px-3 pt-3 pb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Linked Questions ({section1Questions.length})
                                </span>
                            </div>
                            {section1Questions.map(q => (
                                <LinkedQuestionCard
                                    key={q.id}
                                    question={q}
                                    pending={pendingId === q.id}
                                    onClear={() => handleAssign(q.id, null)}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Section 2: Other questions ── */}
                    <div>
                        <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Link a Question
                            </span>
                            <span className="text-[10px] text-slate-400">
                                ({section2Questions.length} available)
                            </span>
                        </div>

                        {/* Search + unmapped toggle */}
                        <div className="px-3 pb-2 space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search questions…"
                                    className="pl-8 h-8 text-xs border-slate-200"
                                />
                                {search && (
                                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-500">Unmapped only</span>
                                <Switch checked={showUnmappedOnly} onCheckedChange={setShowUnmappedOnly} />
                            </div>
                        </div>

                        {section2Questions.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">No questions to link</div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {section2Questions.map(q => (
                                    <QuestionRowAddable
                                        key={q.id}
                                        question={q}
                                        pending={pendingId === q.id}
                                        onAdd={() => handleAssign(q.id, fieldSelection.fieldNo)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 shrink-0">
                    {section1Questions.length} linked · {section2Questions.length} available
                </div>
            </div>
        );
    }

    // ── GLOBAL MODE ─────────────────────────────────────────────────────
    return (
        <div className="flex flex-col w-[32%] min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 p-3 space-y-2 shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Questions</span>

                {/* Questionnaire selector */}
                <div className="relative">
                    <select
                        value={activeQnaireId}
                        onChange={e => onQnaireChange(e.target.value)}
                        className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                        {questionnaires.map(q => (
                            <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Coverage summary */}
                {activeQnaire && (
                    <div className="flex gap-3 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="font-semibold text-slate-700">{activeQnaire.questions.length} questions</span>
                        <span>·</span>
                        <span><span className="font-medium text-emerald-600">{activeQnaire.mappedCount}</span> mapped</span>
                        <span>·</span>
                        <span><span className="font-medium text-amber-600">{activeQnaire.unmappedCount}</span> unmapped</span>
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search questions…"
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
                    Select a master field in Column 2 to manage its linked questions
                </p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {!activeQnaire ? (
                    <div className="py-10 text-center text-xs text-slate-400">Select a questionnaire</div>
                ) : filteredQuestions.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">No questions match</div>
                ) : (
                    filteredQuestions.map(q => (
                        <QuestionRow
                            key={q.id}
                            question={q}
                            selection={selection}
                            highlights={highlights}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </div>

            <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 shrink-0">
                {filteredQuestions.length} of {activeQnaire?.questions.length ?? 0} questions
            </div>
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function LinkedQuestionCard({ question, pending, onClear }: {
    question: Wb2Question;
    pending: boolean;
    onClear: () => void;
}) {
    return (
        <div className="mx-3 my-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
            <div className="flex items-start gap-2">
                <p className="text-xs text-slate-800 font-medium leading-snug flex-1 line-clamp-3">
                    {question.text}
                </p>
                <button
                    onClick={onClear}
                    disabled={pending}
                    className="shrink-0 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mt-0.5"
                    title="Clear mapping"
                >
                    {pending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Link2Off className="w-3.5 h-3.5" />
                    }
                </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", STATUS_COLOURS[question.status] ?? "bg-slate-100 text-slate-500")}>
                    {question.status}
                </span>
                {question.sourcedFrom.map(src => (
                    <span key={src} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", sourceBadgeClass(src))}>
                        {sourceShortLabel(src)}
                    </span>
                ))}
            </div>
        </div>
    );
}

function QuestionRowAddable({ question, pending, onAdd }: {
    question: Wb2Question;
    pending: boolean;
    onAdd: () => void;
}) {
    const existingMapping = question.masterFieldNo
        ? `F${question.masterFieldNo} ${question.masterFieldName ?? ""}`
        : question.masterQuestionGroupId
        ? question.masterQuestionGroupLabel ?? "Group"
        : null;

    return (
        <div className="px-3 py-2.5 flex items-start gap-2 hover:bg-slate-50 group">
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 leading-snug line-clamp-2">{question.text}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", STATUS_COLOURS[question.status] ?? "bg-slate-100 text-slate-500")}>
                        {question.status}
                    </span>
                    {existingMapping ? (
                        <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-medium">
                            → {existingMapping}
                        </span>
                    ) : (
                        <span className="text-[9px] text-slate-400 italic">unmapped</span>
                    )}
                </div>
            </div>
            <button
                onClick={onAdd}
                disabled={pending}
                className="shrink-0 w-6 h-6 rounded-full bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5"
                title="Link this question to the selected field"
            >
                {pending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    : <Plus className="w-3.5 h-3.5 text-emerald-600" />
                }
            </button>
        </div>
    );
}

function QuestionRow({ question, selection, highlights, onSelect }: {
    question: Wb2Question;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
}) {
    const isSelected = selection?.kind === "question" && selection.questionId === question.id;
    const isHighlighted = highlights.questions.has(question.id);
    const isDimmed = highlights.hasSelection && !isHighlighted;

    const mappingLabel = question.masterFieldNo
        ? `F${question.masterFieldNo} ${question.masterFieldName ?? ""}`
        : question.masterQuestionGroupId
        ? question.masterQuestionGroupLabel ?? question.masterQuestionGroupId
        : question.customFieldDefinitionId
        ? "Custom field"
        : null;

    return (
        <button
            onClick={() => onSelect({ kind: "question", questionId: question.id })}
            className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-2 transition-all border-l-2",
                isSelected    ? "bg-violet-50 border-l-violet-500" :
                isHighlighted ? "bg-indigo-50 border-l-indigo-400" :
                "border-l-transparent hover:bg-slate-50",
                isDimmed && "opacity-30"
            )}
        >
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 font-medium leading-snug line-clamp-2">
                    {question.text}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", STATUS_COLOURS[question.status] ?? "bg-slate-100 text-slate-500")}>
                        {question.status}
                    </span>
                    {mappingLabel ? (
                        <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                            <ArrowRight className="w-2.5 h-2.5" />
                            {mappingLabel}
                        </span>
                    ) : (
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5 italic">
                            <Minus className="w-2.5 h-2.5" />
                            unmapped
                        </span>
                    )}
                    {question.sourcedFrom.map(src => (
                        <span key={src} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", sourceBadgeClass(src))}>
                            {sourceShortLabel(src)}
                        </span>
                    ))}
                </div>
            </div>
        </button>
    );
}
