"use client";

import { useState, useMemo } from "react";
import { Wb2Questionnaire, Wb2Question } from "@/actions/mapping-workbench-2";
import { Selection, RelationshipHighlights } from "./MappingWorkbench2";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X, ArrowRight, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";

const STATUS_COLOURS: Record<string, string> = {
    DRAFT:    "bg-slate-100 text-slate-500",
    APPROVED: "bg-blue-100 text-blue-700",
    SHARED:   "bg-amber-100 text-amber-700",
    RELEASED: "bg-emerald-100 text-emerald-700",
};

const SOURCE_BADGE: Record<string, string> = {
    GLEIF:       "bg-purple-100 text-purple-700",
    CH_RA000585: "bg-red-100 text-red-700",
    FR_RA000192: "bg-blue-100 text-blue-700",
};

function sourceBadgeClass(key: string): string {
    if (key.startsWith("GLEIF")) return SOURCE_BADGE["GLEIF"];
    if (key.includes("RA000585")) return SOURCE_BADGE["CH_RA000585"];
    if (key.includes("RA000192")) return SOURCE_BADGE["FR_RA000192"];
    return "bg-slate-100 text-slate-600";
}

function sourceShortLabel(key: string): string {
    if (key.startsWith("GLEIF")) return "GLEIF";
    if (key.includes("RA000585")) return "CH";
    if (key.includes("RA000192")) return "FR";
    return key.split(":").pop()?.slice(0, 6) ?? key;
}

interface Props {
    questionnaires: Wb2Questionnaire[];
    activeQnaireId: string;
    onQnaireChange: (id: string) => void;
    selection: Selection;
    highlights: RelationshipHighlights;
    onSelect: (s: Selection) => void;
}

export function QuestionsColumn({ questionnaires, activeQnaireId, onQnaireChange, selection, highlights, onSelect }: Props) {
    const [search, setSearch] = useState("");
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

    const activeQnaire = questionnaires.find(q => q.id === activeQnaireId) ?? questionnaires[0];

    const filtered = useMemo(() => {
        if (!activeQnaire) return [];
        let list = activeQnaire.questions;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(q2 => q2.text.toLowerCase().includes(q));
        }
        if (showUnmappedOnly) {
            list = list.filter(q => !q.isMapped);
        }
        return list;
    }, [activeQnaire, search, showUnmappedOnly]);

    return (
        <div className="flex flex-col w-[32%] min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Column header */}
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

                {/* Search + filter */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
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

            {/* Question list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                {!activeQnaire ? (
                    <div className="py-10 text-center text-xs text-slate-400">Select a questionnaire</div>
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">No questions match</div>
                ) : (
                    filtered.map(q => (
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
                {filtered.length} of {activeQnaire?.questions.length ?? 0} questions
            </div>
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
                isSelected ? "bg-violet-50 border-l-violet-500" :
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
                    {/* Status */}
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", STATUS_COLOURS[question.status] ?? "bg-slate-100 text-slate-500")}>
                        {question.status}
                    </span>

                    {/* Mapping target */}
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

                    {/* Source coverage badges */}
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
