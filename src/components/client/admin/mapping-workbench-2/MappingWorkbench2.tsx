"use client";

import { useMemo, useState } from "react";
import { Wb2PageData, Wb2SourceData } from "@/actions/mapping-workbench-2";
import { Layers3 } from "lucide-react";
import { SourceColumn } from "./SourceColumn";
import { MasterDataColumn } from "./MasterDataColumn";
import { QuestionsColumn } from "./QuestionsColumn";

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
    // path composite key → fieldNos[]
    const pathToFields = new Map<string, number[]>();
    // fieldNo → path composite keys[]
    const fieldToPaths = new Map<number, string[]>();
    // fieldNo → questionIds[]
    const fieldToQuestions = new Map<number, string[]>();
    // questionId → fieldNos[]
    const questionToFields = new Map<string, number[]>();

    for (const source of data.sources) {
        for (const p of source.paths) {
            if (p.mappedToFieldNo == null || p.isActive === false) continue;
            const composite = `${source.sourceKey}::${p.path}`;
            const fno = p.mappedToFieldNo;

            const pf = pathToFields.get(composite) ?? [];
            pf.push(fno);
            pathToFields.set(composite, pf);

            const fp = fieldToPaths.get(fno) ?? [];
            fp.push(composite);
            fieldToPaths.set(fno, fp);
        }
    }

    for (const qnaire of data.questionnaires) {
        for (const q of qnaire.questions) {
            if (q.masterFieldNo == null) continue;
            const fno = q.masterFieldNo;

            const fq = fieldToQuestions.get(fno) ?? [];
            fq.push(q.id);
            fieldToQuestions.set(fno, fq);

            const qf = questionToFields.get(q.id) ?? [];
            qf.push(fno);
            questionToFields.set(q.id, qf);
        }
    }

    return { pathToFields, fieldToPaths, fieldToQuestions, questionToFields };
}

function computeHighlights(
    selection: Selection,
    graph: ReturnType<typeof buildGraph>
): RelationshipHighlights {
    if (!selection) return { paths: new Set(), fields: new Set(), questions: new Set(), hasSelection: false };

    const { pathToFields, fieldToPaths, fieldToQuestions, questionToFields } = graph;

    if (selection.kind === "path") {
        const composite = `${selection.sourceKey}::${selection.path}`;
        const fields = new Set(pathToFields.get(composite) ?? []);
        const questions = new Set([...fields].flatMap(f => fieldToQuestions.get(f) ?? []));
        return { paths: new Set([composite]), fields, questions, hasSelection: true };
    }

    if (selection.kind === "field") {
        const paths = new Set(fieldToPaths.get(selection.fieldNo) ?? []);
        const questions = new Set(fieldToQuestions.get(selection.fieldNo) ?? []);
        return { paths, fields: new Set([selection.fieldNo]), questions, hasSelection: true };
    }

    if (selection.kind === "question") {
        const fields = new Set(questionToFields.get(selection.questionId) ?? []);
        const paths = new Set([...fields].flatMap(f => fieldToPaths.get(f) ?? []));
        return { paths, fields, questions: new Set([selection.questionId]), hasSelection: true };
    }

    return { paths: new Set(), fields: new Set(), questions: new Set(), hasSelection: false };
}

// ── Root component ─────────────────────────────────────────────────────────

export function MappingWorkbench2({ data }: { data: Wb2PageData }) {
    const [selection, setSelection] = useState<Selection>(null);
    // Multi-source selection — default GLEIF + Companies House ticked
    const [activeSources, setActiveSources] = useState<string[]>(
        () => data.sources
            .filter(s => s.sourceKey === "GLEIF" || s.sourceKey === "CH_RA000585")
            .map(s => s.sourceKey)
    );
    const [activeQnaireId, setActiveQnaireId] = useState<string>(data.questionnaires[0]?.id ?? "");

    const graph = useMemo(() => buildGraph(data), [data]);
    const highlights = useMemo(() => computeHighlights(selection, graph), [selection, graph]);

    function handleSelect(next: Selection) {
        if (!next || !selection) { setSelection(next); return; }
        if (next.kind === "path" && selection.kind === "path" && next.sourceKey === selection.sourceKey && next.path === selection.path) { setSelection(null); return; }
        if (next.kind === "field" && selection.kind === "field" && next.fieldNo === selection.fieldNo) { setSelection(null); return; }
        if (next.kind === "question" && selection.kind === "question" && next.questionId === selection.questionId) { setSelection(null); return; }
        setSelection(next);
    }

    function handleSourceToggle(key: string) {
        setActiveSources(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    }

    const activeQnaire = data.questionnaires.find(q => q.id === activeQnaireId) ?? data.questionnaires[0];

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <Layers3 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mapping Workbench Idea 2</h1>
                    <p className="text-sm text-slate-500">
                        Source&nbsp;→&nbsp;Master Data&nbsp;→&nbsp;Questions &nbsp;·&nbsp; Click any item to trace relationships
                    </p>
                </div>
                {highlights.hasSelection && (
                    <button
                        onClick={() => setSelection(null)}
                        className="ml-auto text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition-colors"
                    >
                        Clear selection
                    </button>
                )}
            </div>

            {/* Three-column grid */}
            <div className="flex gap-3 flex-1 min-h-0">
                <SourceColumn
                    sources={data.sources}
                    activeSources={activeSources}
                    onSourceToggle={handleSourceToggle}
                    selection={selection}
                    highlights={highlights}
                    onSelect={handleSelect}
                />
                <MasterDataColumn
                    fields={data.masterFields}
                    mappedCount={data.masterFieldsMappedCount}
                    unmappedCount={data.masterFieldsUnmappedCount}
                    selection={selection}
                    highlights={highlights}
                    onSelect={handleSelect}
                />
                <QuestionsColumn
                    questionnaires={data.questionnaires}
                    activeQnaireId={activeQnaire?.id ?? ""}
                    onQnaireChange={setActiveQnaireId}
                    selection={selection}
                    highlights={highlights}
                    onSelect={handleSelect}
                />
            </div>
        </div>
    );
}
