"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, Download, Play, ArrowLeft,
    CheckCircle2, AlertCircle, LayoutTemplate,
    FileText
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    getQuestionnaireById,
    extractDetailedContent,
    saveQuestionnaireChanges
} from "@/actions/questionnaire";
import { getMasterSchemaFields as getFields } from "@/actions/schema-utils";
import { ExtractedItem } from "@/actions/ai-mapper";
import { QuestionnaireFiller } from "@/components/client/questionnaire-filler";

export default function LEManageQuestionnairePage() {
    const params = useParams();
    // params.id is the LE ID because of /app/le/[id]/...
    // params.questionnaireId is the questionnaire ID because of .../questionnaire/[questionnaireId]
    const leId = params.id as string;
    const qId = params.questionnaireId as string;

    const [questionnaire, setQuestionnaire] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [extracting, setExtracting] = useState(false);

    // Data State
    const [items, setItems] = useState<ExtractedItem[]>([]);

    useEffect(() => {
        if (qId) {
            loadData();
        }
    }, [qId]);

    async function loadData() {
        setLoading(true);
        try {
            const [q] = await Promise.all([
                getQuestionnaireById(qId)
            ]);
            setQuestionnaire(q);

            const qAny = q as any;
            if (qAny.extractedContent) {
                setItems(qAny.extractedContent as unknown as ExtractedItem[]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleExtract() {
        if (!confirm("This will re-analyze the document and overwrite existing extraction data. Continue?")) return;

        setExtracting(true);
        try {
            const res = await extractDetailedContent(qId);
            if (res.success) {
                if (res.count === 0) {
                    alert("Extraction finished but found 0 items. The document might be empty.");
                }
                loadData();
            } else {
                alert("Extraction failed: " + (res.error || "Unknown Error"));
            }
        } catch (e) {
            alert("Error running extraction");
        } finally {
            setExtracting(false);
        }
    }

    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>;
    if (!questionnaire) return <div className="p-8">Questionnaire not found</div>;

    const iframeSrc = `/api/questionnaires/${qId}/download`;
    const showPreview = questionnaire.fileType === "application/pdf";

    return (
        <div className="flex h-[calc(100vh-theme(spacing.4))] flex-col bg-slate-50 overflow-hidden">

            {/* 1. Header Toolbar */}
            <header className="flex-none h-16 border-b bg-white px-6 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <Link href={`/app/le/${leId}/v2?tab=selected-questionnaires`}>
                        <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-full h-8 w-8">
                            <ArrowLeft className="w-4 h-4 text-slate-600" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2 text-slate-900">
                            {questionnaire.name}
                            <Badge variant="outline" className="font-normal text-xs">{questionnaire.status}</Badge>
                        </h1>
                        <p className="text-xs text-slate-500 font-mono">
                            {questionnaire.fileName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Extraction Status */}
                    {items.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-100">
                            <AlertCircle className="w-3 h-3" />
                            Needs Extraction
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" />
                            {items.length} Items Extracted
                        </div>
                    )}

                    <div className="h-4 w-px bg-slate-200 mx-2" />

                    <Button variant="ghost" size="sm" onClick={handleExtract} disabled={extracting}>
                        {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        {items.length > 0 ? "Re-Run AI" : "Run AI Analysis"}
                    </Button>
                </div>
            </header>

            {/* 2. Main Workbench Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT PANEL: Document Preview */}
                <div className="flex-1 border-r bg-slate-100 relative hidden md:block">
                    {showPreview ? (
                        <iframe src={iframeSrc} className="w-full h-full" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <FileText className="w-16 h-16 mb-4 opacity-50" />
                            <p>Preview not available for {questionnaire.fileType}</p>
                            <a href={iframeSrc} target="_blank" className="text-indigo-600 hover:underline mt-2 text-sm">Download File</a>
                        </div>
                    )}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded p-1 shadow border text-xs text-slate-500">
                        Original Document
                    </div>
                </div>

                {/* RIGHT PANEL: Extraction Workbench -> QuestionnaireFiller */}
                <div className="w-full md:w-[600px] lg:w-[700px] bg-slate-50 flex flex-col overflow-hidden shadow-xl z-20">
                    {/* The Filler handles its own scrolling and header */}
                    <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                        <QuestionnaireFiller
                            leId={leId}
                            questionnaireId={qId}
                            initialQuestions={items}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
