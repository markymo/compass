"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { updateQuestionnaireFile, toggleQuestionnaireStatus, updateQuestionnaireName, toggleQuestionnaireGlobal, getQuestionnaireSnapshots } from "@/actions/questionnaire";
import {
    ArrowLeft, Loader2, Play, AlertCircle, CheckCircle2,
    FileText, Save, LayoutTemplate, Pencil, MoreVertical, Download, Eye, FileSearch, Keyboard, Globe
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

import {
    saveQuestionnaireChanges,
    extractRawText,
    extractDetailedContent, // Legacy/Fallback
    getQuestionnaireById
} from "@/actions/questionnaire";
import { ExtractedItem } from "@/actions/ai-mapper";

// import { ExtractTextStep } from "./extract-text-step";
// import { ParseStructureStep } from "./parse-structure-step";
// import { MappingWorkbench } from "./mapping-workbench";
import { QuestionnaireMapper } from "@/components/client/engagement/questionnaire-mapper";

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

    // Snapshot State
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);

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

    // --- Fetch Snapshots ---
    useEffect(() => {
        let mounted = true;
        async function fetchSnapshots() {
            setLoadingSnapshots(true);
            const res = await getQuestionnaireSnapshots(questionnaire.id);
            if (mounted && res.success) {
                setSnapshots(res.data || []);
            }
            if (mounted) setLoadingSnapshots(false);
        }
        fetchSnapshots();
        return () => { mounted = false; };
    }, [questionnaire.id]);

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

    const handleGlobalToggle = async (checked: boolean) => {
        setQuestionnaire({ ...questionnaire, isGlobal: checked });
        try {
            const res = await toggleQuestionnaireGlobal(questionnaire.id, checked);
            if (!res.success) {
                alert("Failed to update visibility: " + res.error);
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
                        <div className="flex items-center gap-4 border border-transparent hover:border-slate-200 rounded-lg p-1 transition-colors">
                            <Input
                                value={questionnaire.name}
                                onChange={(e) => setQuestionnaire({ ...questionnaire, name: e.target.value })}
                                onBlur={handleNameSave}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                className="h-9 w-72 font-semibold text-lg border-transparent hover:border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 px-2 shadow-none bg-transparent transition-all"
                                placeholder="Questionnaire Name"
                                title="Edit Name"
                            />

                            <div className="h-6 w-px bg-slate-200" />

                            <Select value={questionnaire.status} onValueChange={handleStatusChange}>
                                <SelectTrigger className={`h-7 text-xs w-auto border-none shadow-none px-3 rounded-full font-bold uppercase tracking-wider ${questionnaire.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
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

                            <div className="h-6 w-px bg-slate-200" />

                            <div className="flex items-center gap-2 px-2" title="If enabled, this questionnaire is available to all Client ORGs as a template.">
                                <Globe className="w-4 h-4 text-slate-400" />
                                <Label className="text-sm font-medium text-slate-600 cursor-pointer">Global Template</Label>
                                <Switch
                                    checked={questionnaire.isGlobal || false}
                                    onCheckedChange={handleGlobalToggle}
                                    className="scale-90 ml-1"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">


                    {items.length === 0 && (
                        <Button
                            variant={saving ? "secondary" : "default"}
                            onClick={handleSaveItems}
                            disabled={saving}
                            className={saving ? "opacity-80" : ""}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {saving ? "Saving..." : "Save Progress"}
                        </Button>
                    )}
                </div>
            </header>

            {/* Digitization Journey Accordion */}
            <Accordion type="single" collapsible className="w-full flex-none bg-white border-b px-6 shadow-sm z-20">
                <AccordionItem value="journey" className="border-none">
                    <AccordionTrigger className="py-3 text-sm font-semibold text-slate-700 hover:no-underline">
                        Digitization Journey & Source Files
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-2 flex flex-col md:flex-row gap-6">
                        {/* Process Logs */}
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Process Logs</h4>
                            <div className="h-40 overflow-y-auto bg-slate-900 rounded-md p-4 font-mono text-[10px] shadow-inner">
                                {(!questionnaire.processingLogs || questionnaire.processingLogs.length === 0) ? (
                                    <span className="text-slate-500">No logs available yet.</span>
                                ) : (
                                    questionnaire.processingLogs.map((log: any, i: number) => (
                                        <div key={i} className="mb-1 flex gap-2">
                                            <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            <span className={
                                                log.level === 'ERROR' ? 'text-red-400 font-bold' :
                                                    log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-300'
                                            }>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Document Actions */}
                        <div className="w-full md:w-64 flex flex-col gap-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Source Assets</h4>
                            {hasFile ? (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setShowSource(true)} className="w-full justify-start text-slate-600">
                                        <FileSearch className="w-4 h-4 mr-2" /> View Source Document
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => window.open(iframeSrc, '_blank')} className="w-full justify-start text-slate-600">
                                        <Download className="w-4 h-4 mr-2" /> Download Original
                                    </Button>
                                    {rawText && (
                                        <Button variant="outline" size="sm" onClick={() => setShowRawText(true)} className="w-full justify-start text-slate-600">
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> View Extracted Text
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <div className="text-sm text-slate-500 p-4 border rounded-md border-dashed text-center bg-slate-50">
                                    No source file attached.
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="instances" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-3 text-sm font-semibold text-slate-700">
                        <div className="flex items-center gap-2">
                            Active Instances & Snapshots
                            <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-5 text-xs font-normal">
                                {snapshots.length}
                            </Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-2">
                        <div className="bg-slate-50 border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                            {loadingSnapshots ? (
                                <div className="p-4 text-center text-slate-500 text-sm">Loading instances...</div>
                            ) : snapshots.length === 0 ? (
                                <div className="p-6 text-center text-slate-500 text-sm flex flex-col items-center">
                                    <Globe className="w-8 h-8 text-slate-200 mb-2" />
                                    No active instances of this questionnaire template found.
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm">
                                        <tr>
                                            <th className="font-semibold px-4 py-2 text-xs uppercase tracking-wider">Client LE</th>
                                            <th className="font-semibold px-4 py-2 text-xs uppercase tracking-wider">Supplier</th>
                                            <th className="font-semibold px-4 py-2 text-xs uppercase tracking-wider">Instance Name</th>
                                            <th className="font-semibold px-4 py-2 text-xs uppercase tracking-wider">Snapshot Taken</th>
                                            <th className="font-semibold px-4 py-2 text-xs uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-slate-700">
                                        {snapshots.map(((s: any, i: any)) => (
                                            <tr key={i} className="hover:bg-white transition-colors bg-slate-50/50">
                                                <td className="px-4 py-2 font-medium">
                                                    <Link href={`/app/le/${s.fiEngagement?.clientLE?.id}/v2`} className="hover:underline hover:text-indigo-600">
                                                        {s.fiEngagement?.clientLE?.name || "Unknown"}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-2">{s.fiEngagement?.org?.name || "Unknown"}</td>
                                                <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]" title={s.name}>{s.name}</td>
                                                <td className="px-4 py-2 text-slate-500">
                                                    {new Date(s.createdAt).toLocaleString(undefined, {
                                                        year: 'numeric', month: 'short', day: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="outline" className="text-[10px] bg-white">
                                                        {s.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

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
                                {extractionError ? "Digitization Failed" : (hasFile ? "Start Digitization" : "Start Building")}
                            </h2>
                            <p className="text-slate-500 mt-2">
                                {extractionError
                                    ? `We encountered an issue during extraction. You can retry with the AI or check the raw text.`
                                    : (hasFile ? "We couldn't automatically read this document yet. You can retry the AI extraction or start manually." : "Start building your questionnaire by adding your first question.")}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {hasFile && (
                                <>
                                    <Button onClick={handleExtractText} variant="default" className="w-[160px]">
                                        <Play className="w-4 h-4 mr-2" />
                                        {extractionError ? "Retry AI" : "Run Extraction"}
                                    </Button>

                                    <span className="text-slate-300 text-sm">or</span>
                                </>
                            )}
                            <Button onClick={handleStartManually} variant={hasFile ? "secondary" : "default"}>
                                <Keyboard className="w-4 h-4 mr-2" />
                                Start Manually
                            </Button>
                        </div>
                    </div>
                ) : (
                    // The Mapping Workbench fills the area smoothly
                    <div className="flex-1 pb-12">
                        <QuestionnaireMapper
                            questionnaireId={questionnaire.id}
                            onBack={() => router.push('/app/admin/questionnaires')}
                            standingData={undefined}
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

