"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { updateQuestionnaireFile, toggleQuestionnaireStatus, updateQuestionnaireName } from "@/actions/questionnaire";
import {
    ArrowLeft, Loader2, Play, AlertCircle, CheckCircle2,
    FileText, Save, LayoutTemplate, Pencil, MoreVertical, Download, Eye, FileSearch, Keyboard
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    saveQuestionnaireChanges,
    extractRawText,
    extractDetailedContent, // Legacy/Fallback
    getQuestionnaireById
} from "@/actions/questionnaire";
import { ExtractedItem } from "@/actions/ai-mapper";

// We don't use the steps anymore
// import { ExtractTextStep } from "./extract-text-step";
// import { ParseStructureStep } from "./parse-structure-step";
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

    const [extracting, setExtracting] = useState(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    // Dialog States
    const [showRawText, setShowRawText] = useState(false);
    const [showSource, setShowSource] = useState(false);

    // accessors
    const hasFile = !!questionnaire.fileType;
    const isPDF = questionnaire.fileType === "application/pdf";
    const iframeSrc = `/api/questionnaires/${questionnaire.id}/download`;

    // --- Auto-Extraction Logic ---
    useEffect(() => {
        // If we have a file, but no items and no raw text, let's try to auto-extract on load
        if (hasFile && items.length === 0 && !rawText && !extracting) {
            handleExtractText();
        }
    }, []); // Run once on mount

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

    const handleExtractText = async () => {
        if (extracting) return;
        setExtracting(true);
        setExtractionError(null);
        try {
            // 1. Try Server-Side Text Extraction
            console.log("Attempting server-side extraction...");

            // If we already have rawText, we technically only need to parse it, 
            // but `extractDetailedContent` is our main robust entry point. 
            // Ideally, we'd have a `parseOnly` flag, but for now, re-running is safer checksum.
            // (Future optimization: pass skipExtraction=true)
            const res = await extractRawText(questionnaire.id);

            // Actually, let's just use the robust `extractDetailedContent` which handles the chain
            const chainRes = await extractDetailedContent(questionnaire.id);

            if (chainRes.success) {
                const freshQ = await fetchQ();
                setItems(freshQ && freshQ.extractedContent ? freshQ.extractedContent as any[] : []);
                if (freshQ && freshQ.rawText) setRawText(freshQ.rawText);
            } else {
                // Refresh anyway to get logs/rawText even on failure
                const errorQ = await fetchQ();
                if (errorQ && errorQ.rawText) setRawText(errorQ.rawText);

                if (chainRes.error === "SCANNED_PDF_DETECTED" && isPDF) {
                    // Handle Scanned PDF
                    if (confirm("Scanned PDF detected. Use browser-side OCR? (Slow)")) {
                        const images = await convertPdfToImages(iframeSrc);
                        const imgRes = await extractDetailedContent(questionnaire.id, images);
                        if (imgRes.success) {
                            const ocrQ = await fetchQ();
                            setItems(ocrQ && ocrQ.extractedContent ? ocrQ.extractedContent as any[] : []);
                            if (ocrQ && ocrQ.rawText) setRawText(ocrQ.rawText);
                        } else {
                            setExtractionError(imgRes.error || "OCR Failed");
                        }
                    } else {
                        setExtractionError("Scanned PDF detected. Auto-extraction skipped.");
                    }
                } else {
                    console.warn("Extraction warning:", chainRes.error);
                    setExtractionError(chainRes.error || "Failed to extract content.");
                }
            }

        } catch (e: any) {
            console.error(e);
            setExtractionError(e.message || "An unexpected error occurred.");
        } finally {
            setExtracting(false);
        }
    };

    const handleStartManually = () => {
        const newItem: any = {
            type: "QUESTION",
            originalText: "Question 1",
            confidence: 0,
            order: 1,
            category: "CORE",
        };
        setItems([newItem]);
        // Also save this initial state so user doesn't lose it on refresh
        saveQuestionnaireChanges(questionnaire.id, [newItem]);
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
                // Toasted
            } else {
                alert("Failed to save.");
            }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    // --- PDF Helper (Kept for Scanned Fallback) ---
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

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="h-16 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-none">
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
                    {/* Document Options */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4 text-slate-500" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Document Options</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => window.open(iframeSrc, '_blank')}>
                                <Download className="w-4 h-4 mr-2" />
                                Download Original
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowSource(true)}>
                                <FileSearch className="w-4 h-4 mr-2" />
                                View Source PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowRawText(true)}>
                                <FileText className="w-4 h-4 mr-2" />
                                View Extracted Text
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

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

            {/* Main Content: Data First Editor */}
            <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
                {extracting ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                        <h2 className="text-xl font-semibold text-slate-800">Digitizing Document...</h2>
                        <p className="text-slate-500 max-w-md mt-2">
                            We are using AI to read your document structure. This usually takes 10-20 seconds.
                            If it's a scanned PDF, it might take up to 3 minutes.
                        </p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                        <div className="bg-slate-100 p-6 rounded-full relative">
                            <FileText className="w-12 h-12 text-slate-400" />
                            {extractionError && (
                                <div className="absolute -top-1 -right-1 bg-red-100 text-red-600 rounded-full p-1">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                            )}
                        </div>

                        <div className="max-w-md text-center">
                            <h2 className="text-lg font-semibold text-slate-800">
                                {extractionError ? "Digitization Failed" : "Start Digitization"}
                            </h2>
                            <p className="text-slate-500 mt-2">
                                {extractionError
                                    ? `We encountered an issue during extraction. You can retry with the AI or check the raw text.`
                                    : "We couldn't automatically read this document yet. You can retry the AI extraction or start manually."}
                            </p>
                        </div>

                        {/* Log Display for Debugging */}
                        {(questionnaire.processingLogs && questionnaire.processingLogs.length > 0) && (
                            <div className="w-full max-w-lg bg-slate-900 rounded-md p-4 text-left shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Process Logs</h4>
                                    <span className="text-[10px] text-slate-500">Live</span>
                                </div>
                                <div className="h-32 overflow-y-auto font-mono text-[10px]">
                                    {questionnaire.processingLogs.map((log: any, i: number) => (
                                        <div key={i} className="mb-1 flex gap-2">
                                            <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            <span className={
                                                log.level === 'ERROR' ? 'text-red-400 font-bold' :
                                                    log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-300'
                                            }>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Button onClick={handleExtractText} variant="default" className="w-[160px]">
                                <Play className="w-4 h-4 mr-2" />
                                {extractionError ? "Retry AI" : "Run Extraction"}
                            </Button>

                            <span className="text-slate-300 text-sm">or</span>

                            <Button onClick={handleStartManually} variant="secondary">
                                <Keyboard className="w-4 h-4 mr-2" />
                                Start Manually
                            </Button>
                        </div>

                        <div className="flex gap-4">
                            {rawText && (
                                <Button variant="link" size="sm" onClick={() => setShowRawText(true)} className="text-indigo-600">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> View Extracted Text
                                </Button>
                            )}
                            {hasFile && (
                                <Button variant="link" size="sm" onClick={() => setShowSource(true)} className="text-slate-400">
                                    View Source PDF
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    // The Mapping Workbench fills the area
                    <div className="flex-1 overflow-hidden h-full">
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
                            }}
                        />
                    </div>
                )}
            </main>

            {/* Dialogs */}
            <Dialog open={showRawText} onOpenChange={setShowRawText}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Raw Extracted Text</DialogTitle>
                        <DialogDescription>
                            This is the raw text we read from the document file.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto border rounded-md bg-slate-50 p-4 font-mono text-xs whitespace-pre-wrap">
                        {rawText || "No raw text available."}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showSource} onOpenChange={setShowSource}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Source Document</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-slate-100 rounded border overflow-hidden">
                        {iframeSrc ? (
                            <iframe src={iframeSrc} className="w-full h-full" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">No Document</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}

