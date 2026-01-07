"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { updateQuestionnaireFile, toggleQuestionnaireStatus, updateQuestionnaireName } from "@/actions/questionnaire";
import {
    ArrowLeft, Loader2, Play, AlertCircle, CheckCircle2,
    FileText, Save, LayoutTemplate, Pencil
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    saveQuestionnaireChanges,
    extractRawText,
    extractDetailedContent, // Legacy/Fallback
    getQuestionnaireById
} from "@/actions/questionnaire";
import { ExtractedItem } from "@/actions/ai-mapper";

import { ExtractTextStep } from "./extract-text-step";
import { ParseStructureStep } from "./parse-structure-step";
import { MappingWorkbench } from "./mapping-workbench";

interface QuestionnaireManagerProps {
    questionnaire: any;
    masterFields: any[];
}

export function QuestionnaireManager({ questionnaire: initialQ, masterFields }: QuestionnaireManagerProps) {
    const router = useRouter();

    // --- State ---
    const [questionnaire, setQuestionnaire] = useState(initialQ);
    const [items, setItems] = useState<ExtractedItem[]>(initialQ.extractedContent as ExtractedItem[] || []);
    const [rawText, setRawText] = useState<string>(initialQ.rawText || "");

    // Steps: 1=Preview, 2=Text Review, 3=Structure Summary, 4=Mapping
    const [step, setStep] = useState<number>(1);

    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    const handleNameSave = async () => {
        setIsEditingName(false);
        if (!questionnaire.name || !questionnaire.name.trim()) return;

        try {
            const res = await updateQuestionnaireName(questionnaire.id, questionnaire.name);
            if (!res.success) {
                alert("Failed to update name: " + res.error);
                fetchQ();
            }
        } catch (e) { console.error(e); }
    };

    // --- accessors ---
    const hasFile = !!questionnaire.fileType;
    const isPDF = questionnaire.fileType === "application/pdf";
    const iframeSrc = `/api/questionnaires/${questionnaire.id}/download`;

    // --- Initial Step Logic ---
    // --- Initial Step Logic ---
    useEffect(() => {
        // Determine initial step based on data state
        // We only run this on mount/initial load to prevent "auto-advancing" 
        // when state updates during the workflow.
        if (items.length > 0) {
            setStep(2); // Parsed -> Show Text/Summary Page
        } else if (rawText && rawText.length > 0) {
            setStep(2); // Text extracted but not parsed
        } else if (!hasFile) {
            setStep(2); // No file, start at text entry
        } else {
            setStep(1); // Ready to extract
        }
    }, [items.length]);



    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", e.target.files[0]);

        const res = await updateQuestionnaireFile(questionnaire.id, formData);
        setUploading(false);
        if (res.success) {
            await fetchQ();
            // Stay on Step 1 to show file is loaded
        } else {
            alert("Upload failed: " + res.error);
        }
    };

    const goBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleExtractText = async () => {
        setExtracting(true);
        try {
            // 1. Try Server-Side Text Extraction
            console.log("Attempting server-side extraction...");
            const res = await extractRawText(questionnaire.id);

            if (res.success) {
                if (res.data) {
                    setRawText(res.data);
                    setStep(2);
                } else {
                    // check check, might be skipped
                    if (res.status === "SKIPPED_TEXT_EXTRACT") {
                        // handled?
                    } else {
                        alert("Extraction finished but returned empty text.");
                    }
                }
                return;
            }

            // 2. Handle specific Server Errors
            if (res.error === "NO_FILE") {
                // No file exists, user wants to manually edit
                setRawText("");
                setStep(2);
                return;
            }

            // 3. Check for Scanned PDF Fallback
            if (res.error === "SCANNED_PDF_DETECTED" && isPDF) {
                console.log("Scanned PDF detected. Switching to Client-Side Image Rendering...");
                if (!confirm("This document appears to be a scanned PDF. We will use your browser to render it for AI analysis. This operation is resource intensive and may take 2-3 minutes to complete. Please do not close the window. Continue?")) return;

                const images = await convertPdfToImages(iframeSrc);
                console.log(`Generated ${images.length} images from PDF.`);

                const imgRes = await extractDetailedContent(questionnaire.id, images);

                if (imgRes.success) {
                    const freshQ = await fetchQ();
                    const newItems = freshQ && freshQ.extractedContent ? freshQ.extractedContent as any[] : [];
                    setItems(newItems);

                    if (newItems.length > 0) {
                        const reconstructedText = newItems.map((i: any) => i.originalText).join("\n\n");
                        setRawText(reconstructedText);
                    }

                    setStep(3); // Go to Summary first
                } else {
                    alert("Image Extraction failed: " + (imgRes.error || "Unknown Error"));
                }
                return;
            }

            alert("Extraction failed: " + (res.error || "Unknown Error"));
        } catch (e: any) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setExtracting(false);
        }
    };

    // Helper to refresh data
    const fetchQ = async () => {
        router.refresh();
        const fresh = await getQuestionnaireById(questionnaire.id);
        if (fresh) setQuestionnaire(fresh);
        return fresh;
    };

    const handleStatusChange = async (val: string) => {
        const newStatus = val as "ACTIVE" | "ARCHIVED" | "DRAFT";
        // Optimistic update
        setQuestionnaire({ ...questionnaire, status: newStatus });

        try {
            const res = await toggleQuestionnaireStatus(questionnaire.id, newStatus);
            if (!res.success) {
                alert("Failed to update status: " + res.error);
                fetchQ(); // Revert
            }
        } catch (e) {
            console.error(e);
            fetchQ();
        }
    };

    const handleSaveItems = async () => {
        setSaving(true);
        try {
            const res = await saveQuestionnaireChanges(questionnaire.id, items);
            if (res.success) {
                // maybe toast
            } else {
                alert("Failed to save.");
            }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    // --- PDF Helper ---
    async function convertPdfToImages(url: string): Promise<string[]> {
        const pdfJS = await import('pdfjs-dist');
        pdfJS.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfJS.version}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfJS.getDocument(url);
        const pdf = await loadingTask.promise;
        const images: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            if (context) {
                await page.render({ canvasContext: context, viewport: viewport } as any).promise;
                const dataUrl = canvas.toDataURL("image/png");
                const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
                images.push(base64);
            }
        }
        return images;
    }

    // --- Render ---

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <header className="h-16 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href={`/app/admin/organizations/${questionnaire.fiOrgId}`}>
                        <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-full h-8 w-8">
                            <ArrowLeft className="w-4 h-4 text-slate-600" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            {isEditingName ? (
                                <Input
                                    value={questionnaire.name}
                                    onChange={(e) => setQuestionnaire({ ...questionnaire, name: e.target.value })}
                                    onBlur={handleNameSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                                    className="h-8 w-64 font-semibold text-lg"
                                    autoFocus
                                />
                            ) : (
                                <h1
                                    className="text-lg font-semibold tracking-tight flex items-center gap-2 text-slate-900 cursor-pointer group hover:text-indigo-600 transition-colors"
                                    onClick={() => setIsEditingName(true)}
                                    title="Click to rename"
                                >
                                    {questionnaire.name}
                                    <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </h1>
                            )}

                            <Select value={questionnaire.status} onValueChange={handleStatusChange}>
                                <SelectTrigger className={`h-6 text-[10px] w-auto border-none shadow-none px-2 rounded-full font-bold uppercase tracking-wider ${questionnaire.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                    questionnaire.status === 'ARCHIVED' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                                        'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={saving ? "secondary" : "default"}
                        onClick={handleSaveItems}
                        disabled={saving}
                        className={saving ? "opacity-80" : ""}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Progress
                    </Button>
                </div>
            </header>

            {/* Main Content Area - Vertical Flow */}
            <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

                {/* STEP 1: SOURCE DOCUMENT */}
                <div className={`bg-white rounded-xl border transition-all duration-300 ${step === 1 ? 'shadow-lg ring-1 ring-indigo-100' : 'shadow-sm opacity-90'}`}>
                    <div
                        className={`px-6 py-4 flex items-center justify-between cursor-pointer ${step !== 1 ? 'hover:bg-slate-50' : ''}`}
                        onClick={() => setStep(1)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step > 1 ? 'bg-green-100 text-green-700' :
                                step === 1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                                }`}>
                                {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
                            </div>
                            <div>
                                <h3 className={`font-semibold ${step === 1 ? 'text-slate-900' : 'text-slate-700'}`}>Source Document</h3>
                                {step !== 1 && hasFile && (
                                    <p className="text-sm text-slate-500">File: {questionnaire.fileName}</p>
                                )}
                            </div>
                        </div>
                        {step !== 1 && (
                            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">Edit</Button>
                        )}
                    </div>

                    {step === 1 && (
                        <div className="px-6 pb-6 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in">
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                {/* Preview / Info */}
                                <div className="flex-1 w-full text-center md:text-left">
                                    <div className="mb-4">
                                        <h4 className="text-sm font-medium text-slate-700 mb-1">Current Status</h4>
                                        <p className="text-sm text-slate-500">
                                            {hasFile
                                                ? `Document uploaded: ${questionnaire.fileName} (${questionnaire.fileType})`
                                                : "No document uploaded yet."}
                                        </p>
                                    </div>

                                    {/* Simple Preview Link */}
                                    {hasFile && (
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 inline-block mb-4">
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-8 h-8 text-blue-500" />
                                                <div className="text-left">
                                                    <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{questionnaire.fileName}</p>
                                                    <a href={iframeSrc} target="_blank" className="text-xs text-blue-600 hover:underline">Download / View Original</a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex-1 w-full max-w-sm bg-slate-50 p-6 rounded-lg border border-slate-100">
                                    <label className="block text-sm font-medium text-slate-700 mb-3">
                                        {hasFile ? "Replace Document" : "Upload Document"}
                                    </label>
                                    <div className="space-y-4">
                                        <Input type="file" onChange={handleFileUpload} disabled={uploading} className="bg-white" />
                                        {uploading && <p className="text-xs text-blue-600 animate-pulse">Uploading...</p>}
                                        <Button
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2"
                                            onClick={() => setStep(2)}
                                        >
                                            Next: Text Extraction
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* STEP 2: TEXT EXTRACTION */}
                <div className={`bg-white rounded-xl border transition-all duration-300 ${step === 2 ? 'shadow-lg ring-1 ring-indigo-100' : 'shadow-sm opacity-90'}`}>
                    <div
                        className={`px-6 py-4 flex items-center justify-between cursor-pointer ${step !== 2 ? 'hover:bg-slate-50' : ''}`}
                        onClick={() => setStep(2)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step > 2 ? 'bg-green-100 text-green-700' :
                                step === 2 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                                }`}>
                                {step > 2 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
                            </div>
                            <div>
                                <h3 className={`font-semibold ${step === 2 ? 'text-slate-900' : 'text-slate-700'}`}>Text Extraction</h3>
                                {step > 2 && (
                                    <p className="text-sm text-slate-500">
                                        {items.length} structured items extracted from {rawText.length} chars.
                                    </p>
                                )}
                            </div>
                        </div>
                        {step === 2 && hasFile && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleExtractText(); }}
                                disabled={extracting}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 ml-auto mr-4"
                            >
                                {extracting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                {rawText ? "Re-Extract" : "Auto-Extract"}
                            </Button>
                        )}
                        {step !== 2 && (
                            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">Edit</Button>
                        )}
                    </div>

                    {step === 2 && (
                        <div className="px-6 pb-6 pt-0 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in">
                            <div className="h-[600px] mt-4 rounded-md overflow-hidden border">
                                <ExtractTextStep
                                    questionnaireId={questionnaire.id}
                                    initialText={rawText}
                                    analysisResults={items}
                                    onAnalyzeComplete={async () => {
                                        const freshQ = await fetchQ();
                                        setItems(freshQ && freshQ.extractedContent ? freshQ.extractedContent as any : []);
                                    }}
                                    onOpenWorkbench={() => setStep(3)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* STEP 3: STRUCTURED QUESTIONS */}
                <div className={`bg-white rounded-xl border transition-all duration-300 ${step === 3 ? 'shadow-lg ring-1 ring-indigo-100' : 'shadow-sm opacity-90'}`}>
                    <div
                        className={`px-6 py-4 flex items-center justify-between cursor-pointer ${step !== 3 ? 'hover:bg-slate-50' : ''}`}
                        onClick={() => setStep(3)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
                                }`}>
                                3
                            </div>
                            <h3 className={`font-semibold ${step === 3 ? 'text-slate-900' : 'text-slate-700'}`}>Structured Questions</h3>
                        </div>
                    </div>

                    {step === 3 && (
                        <div className="px-6 pb-6 pt-0 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in">
                            <div className="mt-6">
                                <MappingWorkbench
                                    items={items}
                                    masterFields={masterFields}
                                    onUpdateItem={(idx, field, val) => {
                                        const newItems = [...items];
                                        newItems[idx] = { ...newItems[idx], [field]: val };
                                        setItems(newItems);
                                    }}
                                    onAddItem={() => {
                                        const newItem: any = {
                                            type: "QUESTION",
                                            originalText: "New Question",
                                            confidence: 0,
                                            order: items.length + 1,
                                            category: "CORE",
                                        };
                                        setItems([...items, newItem]);
                                        // Scroll to bottom logic is handled by component update usually, or user scrolls
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}
