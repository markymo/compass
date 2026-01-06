"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Loader2, Download, Play, Save, ArrowLeft,
    Trash2, Archive, RotateCcw, CheckCircle2,
    AlertCircle, HelpCircle, LayoutTemplate,
    FileText, Check, X,
    Maximize2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from "@/components/ui/select";

import {
    getQuestionnaireById,
    extractDetailedContent,
    saveQuestionnaireChanges
} from "@/actions/questionnaire";
import { getMasterSchemaFields as getFields } from "@/actions/schema-utils";
import { ExtractedItem } from "@/actions/ai-mapper";
import { STANDARD_CATEGORIES } from "@/lib/constants";

export default function LEManageQuestionnairePage() {
    const params = useParams();
    const router = useRouter();
    // params.id is the LE ID because of /app/le/[id]/...
    // params.questionnaireId is the questionnaire ID because of .../questionnaire/[questionnaireId]
    const leId = params.id as string;
    const qId = params.questionnaireId as string;

    const [questionnaire, setQuestionnaire] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);

    // Data State
    const [masterFields, setMasterFields] = useState<any[]>([]);
    const [items, setItems] = useState<ExtractedItem[]>([]);

    useEffect(() => {
        if (qId) {
            loadData();
        }
    }, [qId]);

    async function loadData() {
        setLoading(true);
        try {
            const [q, fields] = await Promise.all([
                getQuestionnaireById(qId),
                getFields()
            ]);
            setQuestionnaire(q);
            setMasterFields(fields);

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

    async function handleSave() {
        setSaving(true);
        try {
            const res = await saveQuestionnaireChanges(qId, items);
            if (res.success) {
                // visual feedback could be better, but alert is safe for now
                // alert("Saved successfully");
            } else {
                alert("Failed to save changes.");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving changes");
        } finally {
            setSaving(false);
        }
    }

    // --- State Updates ---

    function updateItem(index: number, field: keyof ExtractedItem, value: any) {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    }

    // --- Grouping Logic ---

    const sections = useMemo(() => {
        if (!items || items.length === 0) return [];

        const groups: { title: string, startIndex: number, items: { item: ExtractedItem, originalIndex: number }[] }[] = [];
        let currentGroup = { title: "General", startIndex: 0, items: [] as { item: ExtractedItem, originalIndex: number }[] };

        items.forEach((item, idx) => {
            if (item.type === "SECTION") {
                if (currentGroup.items.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = { title: item.originalText, startIndex: idx, items: [] };
            } else {
                currentGroup.items.push({ item, originalIndex: idx });
            }
        });
        if (currentGroup.items.length > 0) groups.push(currentGroup);

        return groups;

    }, [items]);

    // --- Render Helpers ---

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

                    <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
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

                {/* RIGHT PANEL: Extraction Workbench */}
                <div className="w-full md:w-[600px] lg:w-[700px] bg-slate-50 flex flex-col overflow-hidden shadow-xl z-20">

                    {/* Workbench Header */}
                    <div className="p-4 border-b bg-white flex justify-between items-center">
                        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                            <LayoutTemplate className="w-4 h-4 text-indigo-500" />
                            Extraction Grid
                        </h2>
                        <div className="text-xs text-slate-500">
                            Review and map identified questions
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth">
                        {items.length === 0 && (
                            <div className="text-center py-20 opacity-50">
                                <p>No items extracted yet.</p>
                            </div>
                        )}

                        {sections.map((section, sIdx) => (
                            <div key={sIdx} className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider sticky top-0 bg-slate-50/95 py-2 backdrop-blur-sm z-10">
                                    <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                                    {section.title}
                                    <span className="text-xs font-normal text-slate-400 ml-2">({section.items.length} questions)</span>
                                </div>

                                <div className="space-y-3 pl-2">
                                    {section.items.map(({ item, originalIndex }) => {
                                        const isQuestion = item.type === "QUESTION";
                                        const isMapped = !!item.masterKey && item.masterKey !== "IGNORE";
                                        const isCategorized = !!item.category && item.category !== "IGNORE";

                                        // Status Color Logic
                                        let statusColor = "border-slate-200"; // Default
                                        if (isQuestion) {
                                            if (isMapped) statusColor = "border-emerald-200 bg-emerald-50/30";
                                            else if (isCategorized) statusColor = "border-amber-200 bg-amber-50/30";
                                            else statusColor = "border-red-200 bg-red-50/10";
                                        }

                                        if (!isQuestion) return null;

                                        return (
                                            <Card key={originalIndex} className={`p-4 transition-all duration-200 ${statusColor} shadow-sm hover:shadow-md group`}>

                                                {/* Top Row: Original Text */}
                                                <div className="mb-3">
                                                    <div className="text-xs font-medium text-slate-500 mb-1 flex justify-between">
                                                        <span>Original Text</span>
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isMapped ? "text-emerald-600" : isCategorized ? "text-amber-600" : "text-red-400"
                                                            }`}>
                                                            {isMapped ? "Mapped" : isCategorized ? "Categorized" : "Unmapped"}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-700 leading-relaxed font-serif italic border-l-2 border-slate-200 pl-3 py-1">
                                                        "{item.originalText}"
                                                    </div>
                                                </div>

                                                {/* Bottom Row: Inputs */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">

                                                    {/* 1. Neutral Text */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-semibold text-slate-400 uppercase">Neutral Question</label>
                                                        <Input
                                                            value={item.neutralText || ""}
                                                            onChange={(e) => updateItem(originalIndex, "neutralText", e.target.value)}
                                                            className="h-8 text-sm bg-white"
                                                            placeholder="Standardized question text..."
                                                        />
                                                    </div>

                                                    {/* 2. Mapping or Category */}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-semibold text-slate-400 uppercase flex justify-between">
                                                            <span>Map to Master Schema</span>
                                                            {item.confidence > 0 && <span className="text-slate-300">{(item.confidence * 100).toFixed(0)}% Match</span>}
                                                        </label>

                                                        {/* Master Key Select */}
                                                        <Select
                                                            value={item.masterKey || "IGNORE"}
                                                            onValueChange={(val) => {
                                                                const newVal = val === "IGNORE" ? undefined : val;
                                                                updateItem(originalIndex, "masterKey", newVal);
                                                            }}
                                                        >
                                                            <SelectTrigger className={`h-8 text-sm bg-white ${isMapped ? "border-emerald-500 text-emerald-700 font-medium" : ""}`}>
                                                                <SelectValue placeholder="Select Field..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="IGNORE" className="text-slate-400 font-mono">-- No Direct Match --</SelectItem>
                                                                {masterFields.map(f => (
                                                                    <SelectItem key={f.key} value={f.key}>
                                                                        {f.label} <span className="text-xs text-slate-400 font-mono ml-2">[{f.key}]</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        {/* Fallback Category Select (Shows if not mapped) */}
                                                        {!isMapped && (
                                                            <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                                <label className="text-[10px] font-semibold text-amber-500 uppercase flex items-center gap-1 mb-1">
                                                                    <HelpCircle className="w-3 h-3" />
                                                                    Fallback Category
                                                                </label>
                                                                <Select
                                                                    value={item.category || "IGNORE"}
                                                                    onValueChange={(val) => {
                                                                        const newVal = val === "IGNORE" ? undefined : val;
                                                                        updateItem(originalIndex, "category", newVal);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8 text-sm bg-amber-50/50 border-amber-200">
                                                                        <SelectValue placeholder="Select Category..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="IGNORE">-- Uncategorized --</SelectItem>
                                                                        {STANDARD_CATEGORIES.map(c => (
                                                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="h-20" /> {/* Spacer */}
                    </div>
                </div>
            </div>
        </div>
    );
}
