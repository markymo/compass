"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Wb2PageData, Wb2LiveEntityRef } from "@/actions/mapping-workbench-2";
import { Layers3, RotateCcw, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceColumn } from "./SourceColumn";
import { MasterDataColumn } from "./MasterDataColumn";
import { QuestionsColumn } from "./QuestionsColumn";
import { DemoEntityPicker } from "./DemoEntityPicker";
import { usePreferences } from "@/components/providers/user-preferences-provider";
import { refreshWorkbenchLiveData } from "@/actions/workbench-demo-entities";
import {
    DEFAULT_GLEIF_LEI,
    DEFAULT_CH_COMPANY_NO,
    DEFAULT_FR_SIREN,
} from "@/lib/mapping-workbench/demo-entity-defaults";

// ── Selection model ────────────────────────────────────────────────────────

export type Selection =
    | { kind: "path"; sourceKey: string; path: string }
    | { kind: "field"; fieldNo: number }
    | { kind: "question"; questionId: string }
    | null;

export interface RelationshipHighlights {
    paths: Set<string>;    // "sourceKey::path"
    fields: Set<number>;
    questions: Set<string>;
    hasSelection: boolean;
}

// ── Graph computation ──────────────────────────────────────────────────────

function buildGraph(data: Wb2PageData) {
    const pathToFields    = new Map<string, number[]>();
    const fieldToPaths    = new Map<number, string[]>();
    const fieldToQuestions = new Map<number, string[]>();
    const questionToFields = new Map<string, number[]>();

    for (const source of data.sources) {
        for (const p of source.paths) {
            if (p.mappedToFieldNos.length === 0) continue;
            const composite = `${source.sourceKey}::${p.path}`;
            for (const fno of p.mappedToFieldNos) {
                const pf = pathToFields.get(composite) ?? []; if (!pf.includes(fno)) pf.push(fno); pathToFields.set(composite, pf);
                const fp = fieldToPaths.get(fno) ?? []; if (!fp.includes(composite)) fp.push(composite); fieldToPaths.set(fno, fp);
            }
        }
    }
    for (const qnaire of data.questionnaires) {
        for (const q of qnaire.questions) {
            if (q.masterFieldNo == null) continue;
            const fno = q.masterFieldNo;
            const fq = fieldToQuestions.get(fno) ?? []; fq.push(q.id); fieldToQuestions.set(fno, fq);
            const qf = questionToFields.get(q.id) ?? []; qf.push(fno); questionToFields.set(q.id, qf);
        }
    }
    return { pathToFields, fieldToPaths, fieldToQuestions, questionToFields };
}

function computeHighlights(selection: Selection, graph: ReturnType<typeof buildGraph>): RelationshipHighlights {
    if (!selection) return { paths: new Set(), fields: new Set(), questions: new Set(), hasSelection: false };
    const { pathToFields, fieldToPaths, fieldToQuestions, questionToFields } = graph;

    if (selection.kind === "path") {
        const composite = `${selection.sourceKey}::${selection.path}`;
        const fields = new Set(pathToFields.get(composite) ?? []);
        return { paths: new Set([composite]), fields, questions: new Set([...fields].flatMap(f => fieldToQuestions.get(f) ?? [])), hasSelection: true };
    }
    if (selection.kind === "field") {
        const paths = new Set(fieldToPaths.get(selection.fieldNo) ?? []);
        return { paths, fields: new Set([selection.fieldNo]), questions: new Set(fieldToQuestions.get(selection.fieldNo) ?? []), hasSelection: true };
    }
    if (selection.kind === "question") {
        const fields = new Set(questionToFields.get(selection.questionId) ?? []);
        const paths  = new Set([...fields].flatMap(f => fieldToPaths.get(f) ?? []));
        return { paths, fields, questions: new Set([selection.questionId]), hasSelection: true };
    }
    return { paths: new Set(), fields: new Set(), questions: new Set(), hasSelection: false };
}

// ── Root component ─────────────────────────────────────────────────────────

export function MappingWorkbench2({ data }: { data: Wb2PageData }) {
    const [selection,     setSelection]     = useState<Selection>(null);
    const [resetKey,      setResetKey]      = useState(0);
    const [activeSources, setActiveSources] = useState<string[]>(
        () => data.sources.filter(s => s.sourceKey === "GLEIF" || s.sourceKey === "CH_RA000585").map(s => s.sourceKey)
    );
    const [activeQnaireId, setActiveQnaireId] = useState<string>(data.questionnaires[0]?.id ?? "");

    // ── Live data override (from user-selected demo entities) ──────────────
    const { preferences } = usePreferences();
    const [overrideRefs,     setOverrideRefs]     = useState<Wb2LiveEntityRef[] | null>(null);
    const [overridePayloads, setOverridePayloads] = useState<Record<string, any> | null>(null);
    const [refreshing,       setRefreshing]       = useState(false);

    const savedEntities = preferences.mappingWorkbench?.demoEntities as {
        gleif?: { id: string; name: string };
        ch?:   { id: string; name: string };
        fr?:   { id: string; name: string };
    } | undefined;

    const doRefresh = useCallback(async (entities: typeof savedEntities) => {
        setRefreshing(true);
        try {
            const result = await refreshWorkbenchLiveData({
                gleifLei:    entities?.gleif?.id ?? DEFAULT_GLEIF_LEI,
                chCompanyNo: entities?.ch?.id    ?? DEFAULT_CH_COMPANY_NO,
                frSiren:     entities?.fr?.id    ?? DEFAULT_FR_SIREN,
            });
            setOverrideRefs(result.refs as Wb2LiveEntityRef[]);
            setOverridePayloads(result.payloads);
        } finally {
            setRefreshing(false);
        }
    }, []);

    // Refresh whenever saved entity preferences change (including on initial load)
    const savedKey = JSON.stringify(savedEntities);
    useEffect(() => {
        doRefresh(savedEntities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [savedKey]);

    const liveRefs = overrideRefs ?? data.liveEntityRefs;

    const graph      = useMemo(() => buildGraph(data), [data]);
    const highlights = useMemo(() => computeHighlights(selection, graph), [selection, graph]);

    function handleSelect(next: Selection) {
        if (!next || !selection) { setSelection(next); return; }
        if (next.kind === "path"     && selection.kind === "path"     && next.sourceKey === selection.sourceKey && next.path === selection.path) { setSelection(null); return; }
        if (next.kind === "field"    && selection.kind === "field"    && next.fieldNo   === selection.fieldNo)   { setSelection(null); return; }
        if (next.kind === "question" && selection.kind === "question" && next.questionId === selection.questionId) { setSelection(null); return; }
        setSelection(next);
    }

    function handleReset() { setSelection(null); setResetKey(k => k + 1); }
    function handleSourceToggle(key: string) {
        setActiveSources(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }

    const activeQnaire = data.questionnaires.find(q => q.id === activeQnaireId) ?? data.questionnaires[0];

    const selectedFieldLiveValues = useMemo(() => {
        if (selection?.kind !== "field") return {};
        return data.masterFields.find(f => f.fieldNo === selection.fieldNo)?.liveValues ?? {};
    }, [selection, data.masterFields]);

    const sourceContextLabel = useMemo(() => {
        if (!selection) return null;
        if (selection.kind === "field") {
            const f = data.masterFields.find(f => f.fieldNo === selection.fieldNo);
            return f ? `Connected to F${f.fieldNo} ${f.fieldName}` : null;
        }
        if (selection.kind === "question") {
            const q = data.questionnaires.flatMap(qn => qn.questions).find(q => q.id === selection.questionId);
            if (!q?.masterFieldNo) return null;
            const f = data.masterFields.find(f => f.fieldNo === q.masterFieldNo);
            return f ? `Connected via F${f.fieldNo} ${f.fieldName}` : "Connected via master field";
        }
        return null;
    }, [selection, data.masterFields, data.questionnaires]);

    const selectedQuestionText = useMemo(() => {
        if (selection?.kind !== "question") return null;
        return data.questionnaires.flatMap(qn => qn.questions).find(q => q.id === selection.questionId)?.text ?? null;
    }, [selection, data.questionnaires]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <Layers3 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mapping Workbench</h1>
                    <p className="text-sm text-slate-500">
                        Source → Master Data → Questions · Click any item to trace relationships
                    </p>
                    {/* Live entity refs with edit pickers */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Wifi className={cn("w-3 h-3 shrink-0", refreshing ? "text-amber-400 animate-pulse" : "text-emerald-500")} />
                        {liveRefs.map(ref => (
                            <span
                                key={ref.sourceKey}
                                title={ref.error ?? undefined}
                                className={cn(
                                    "group inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border cursor-default",
                                    ref.ok
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : ref.error
                                            ? "bg-amber-50 border-amber-200 text-amber-700"
                                            : "bg-slate-50 border-slate-200 text-slate-400"
                                )}
                            >
                                {ref.ok
                                    ? ref.entityName ?? ref.entityId
                                    : `${ref.entityId} (${ref.error ? "error — hover" : "offline"})`}
                                <DemoEntityPicker
                                    sourceKey={ref.sourceKey as any}
                                    currentName={ref.entityName}
                                    currentId={ref.entityId}
                                />
                            </span>
                        ))}
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {highlights.hasSelection && (
                        <button onClick={() => setSelection(null)} className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition-colors">
                            Clear selection
                        </button>
                    )}
                    <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition-colors" title="Reset all filters and selections">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </button>
                </div>
            </div>

            {/* Three-column grid */}
            <div className="flex gap-3 flex-1 min-h-0">
                <SourceColumn
                    key={`source-${resetKey}`}
                    sources={data.sources}
                    activeSources={activeSources}
                    onSourceToggle={handleSourceToggle}
                    selection={selection}
                    highlights={highlights}
                    onSelect={handleSelect}
                    contextLabel={sourceContextLabel}
                    overridePayloads={overridePayloads}
                />
                <MasterDataColumn
                    key={`master-${resetKey}`}
                    fields={data.masterFields}
                    mappedCount={data.masterFieldsMappedCount}
                    unmappedCount={data.masterFieldsUnmappedCount}
                    selection={selection}
                    highlights={highlights}
                    onSelect={handleSelect}
                    sources={data.sources}
                    selectedQuestionText={selectedQuestionText}
                />
                <QuestionsColumn
                    key={`questions-${resetKey}`}
                    questionnaires={data.questionnaires}
                    activeQnaireId={activeQnaire?.id ?? ""}
                    onQnaireChange={setActiveQnaireId}
                    selection={selection}
                    highlights={highlights}
                    onSelect={handleSelect}
                    fieldLiveValues={selectedFieldLiveValues}
                />
            </div>
        </div>
    );
}
