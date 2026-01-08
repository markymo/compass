"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    Loader2, Play, ArrowLeft,
    CheckCircle2, AlertCircle,
    FileText,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    getQuestionnaireById,
    extractDetailedContent
} from "@/actions/questionnaire";
import { ExtractedItem } from "@/actions/ai-mapper";
import { QuestionnaireFiller } from "@/components/client/questionnaire-filler";

export default function LEManageQuestionnairePage() {
    const params = useParams();
    const leId = params.id as string;
    const qId = params.questionnaireId as string;

    const [questionnaire, setQuestionnaire] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [extracting, setExtracting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

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
    const canPreview = questionnaire.fileType === "application/pdf";

    return (
        <div className="flex h-[calc(100vh-theme(spacing.4))] flex-col bg-slate-50 overflow-hidden">

            {/* 1. Header Section */}
            <header className="flex-none bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Link href={`/app/le/${leId}/v2?tab=selected-questionnaires`}>
                        <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-full h-8 w-8">
                            <ArrowLeft className="w-4 h-4 text-slate-600" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-900">
                            {questionnaire.name}
                            <Badge variant="outline" className="font-normal text-xs">{questionnaire.status}</Badge>
                        </h1>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {questionnaire.fileName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Extraction Status */}
                    {items.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-100">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Needs Extraction
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {items.length} Items Ready
                        </div>
                    )}

                    <div className="h-4 w-px bg-slate-200 mx-1" />

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className={`gap-2 ${showPreview ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}`}
                    >
                        {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showPreview ? "Hide Original" : "Show Original"}
                    </Button>

                    <Button size="sm" onClick={handleExtract} disabled={extracting} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                        {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {items.length > 0 ? "Re-Run Analysis" : "Run Analysis"}
                    </Button>
                </div>
            </header>

            {/* 2. Document Preview Section (Collapsible) */}
            <div
                className={`flex-none bg-slate-100 border-b overflow-hidden transition-all duration-300 ease-in-out ${showPreview ? 'h-[50vh]' : 'h-0'}`}
            >
                {canPreview ? (
                    <iframe src={iframeSrc} className="w-full h-full border-none" />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FileText className="w-12 h-12 mb-3 opacity-50" />
                        <p>Preview not available for {questionnaire.fileType}</p>
                        <a href={iframeSrc} target="_blank" className="text-indigo-600 hover:underline mt-2 text-sm">Download File</a>
                    </div>
                )}
            </div>

            {/* 3. Questionnaire Filler Section (Full Width) */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="w-full h-full bg-white flex flex-col">
                    <QuestionnaireFiller
                        leId={leId}
                        questionnaireId={qId}
                        initialQuestions={items}
                        questionnaireName={questionnaire.name}
                    />
                </div>
            </div>

        </div>
    );
}
