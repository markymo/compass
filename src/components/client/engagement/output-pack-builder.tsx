"use client"

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
    FileText,
    Download,
    FileSpreadsheet,
    File,
    ChevronDown,
    ChevronRight,
    Paperclip,
    FolderOpen,
    PackageCheck,
    Archive,
    Loader2,
    ImageIcon,
} from "lucide-react";

// ------------------------------------------------------------------
// Mock data — replace with real props/queries when wiring up
// ------------------------------------------------------------------
const MOCK_QUESTIONNAIRES = [
    {
        id: "q1",
        name: "Due Diligence 2026",
        questionCount: 24,
        answeredCount: 22,
        files: [
            { id: "f1", name: "Board Resolution.pdf", questionRef: "Q3", size: "240 KB" },
            { id: "f2", name: "Certificate of Incorporation.pdf", questionRef: "Q7", size: "1.2 MB" },
        ],
    },
    {
        id: "q2",
        name: "AML / CFT Assessment",
        questionCount: 18,
        answeredCount: 12,
        files: [
            { id: "f3", name: "AML Policy v4.docx", questionRef: "Q2", size: "380 KB" },
            { id: "f4", name: "Transaction Monitoring Screenshot.png", questionRef: "Q11", size: "890 KB" },
            { id: "f5", name: "KYC Onboarding Flow.pdf", questionRef: "Q14", size: "1.5 MB" },
        ],
    },
    {
        id: "q3",
        name: "ESG Screening Questionnaire",
        questionCount: 12,
        answeredCount: 12,
        files: [],
    },
];

const MOCK_SUPPORTING_DOCS = [
    { id: "d1", name: "Latest Annual Report 2025.pdf", size: "4.2 MB" },
    { id: "d2", name: "Company Structure Chart.pdf", size: "580 KB" },
    { id: "d3", name: "Regulatory Licence.pdf", size: "210 KB" },
];

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
type Format = "pdf" | "excel";

export function OutputPackBuilder() {
    const [format, setFormat] = useState<Format>("pdf");

    // Selection state
    const [selectedQuestionnaires, setSelectedQuestionnaires] = useState<Set<string>>(new Set());
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

    // Expanded accordion state
    const [expandedQuestionnaires, setExpandedQuestionnaires] = useState<Set<string>>(new Set());

    // Mock generating state
    const [isGenerating, setIsGenerating] = useState(false);

    // Helpers
    const toggleQuestionnaire = (id: string) => {
        setSelectedQuestionnaires((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                // Also deselect its files
                const q = MOCK_QUESTIONNAIRES.find((q) => q.id === id);
                q?.files.forEach((f) => setSelectedFiles((p) => { const n = new Set(p); n.delete(f.id); return n; }));
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleFile = (fileId: string) => {
        setSelectedFiles((prev) => {
            const next = new Set(prev);
            next.has(fileId) ? next.delete(fileId) : next.add(fileId);
            return next;
        });
    };

    const toggleDoc = (docId: string) => {
        setSelectedDocs((prev) => {
            const next = new Set(prev);
            next.has(docId) ? next.delete(docId) : next.add(docId);
            return next;
        });
    };

    const toggleExpand = (id: string) => {
        setExpandedQuestionnaires((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAllQuestionnaires = () => {
        if (selectedQuestionnaires.size === MOCK_QUESTIONNAIRES.length) {
            setSelectedQuestionnaires(new Set());
        } else {
            setSelectedQuestionnaires(new Set(MOCK_QUESTIONNAIRES.map((q) => q.id)));
        }
    };

    const selectAllDocs = () => {
        if (selectedDocs.size === MOCK_SUPPORTING_DOCS.length) {
            setSelectedDocs(new Set());
        } else {
            setSelectedDocs(new Set(MOCK_SUPPORTING_DOCS.map((d) => d.id)));
        }
    };

    // Computed
    const totalSelectedFiles = selectedFiles.size + selectedDocs.size;
    const hasFiles = totalSelectedFiles > 0;
    const hasAnythingSelected = selectedQuestionnaires.size > 0 || hasFiles;
    const outputIsZip = hasFiles;

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => setIsGenerating(false), 2500); // Mock delay
    };

    const fileIcon = (name: string) => {
        if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return <ImageIcon className="h-4 w-4 text-pink-400" />;
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
        if (name.endsWith(".docx") || name.endsWith(".doc")) return <FileText className="h-4 w-4 text-blue-500" />;
        return <File className="h-4 w-4 text-red-400" />;
    };

    return (
        <div className="space-y-6">

            {/* ─── Format Toggle ───────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Output Pack</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Select questionnaires and documents to generate a downloadable output pack.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1">Questionnaire Format</span>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setFormat("pdf")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                format === "pdf"
                                    ? "bg-white text-red-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <File className="h-3.5 w-3.5" />
                            PDF
                        </button>
                        <button
                            onClick={() => setFormat("excel")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                format === "excel"
                                    ? "bg-white text-emerald-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Questionnaires Section ──────────────────── */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Questionnaires</span>
                    </div>
                    <button
                        onClick={selectAllQuestionnaires}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        {selectedQuestionnaires.size === MOCK_QUESTIONNAIRES.length ? "Deselect All" : "Select All"}
                    </button>
                </div>

                <div className="space-y-2">
                    {MOCK_QUESTIONNAIRES.map((q) => {
                        const isSelected = selectedQuestionnaires.has(q.id);
                        const isExpanded = expandedQuestionnaires.has(q.id);
                        const hasAttachments = q.files.length > 0;

                        return (
                            <Card
                                key={q.id}
                                className={cn(
                                    "transition-all overflow-hidden",
                                    isSelected
                                        ? "border-indigo-200 bg-indigo-50/30 shadow-sm"
                                        : "border-slate-200 hover:border-slate-300"
                                )}
                            >
                                <CardContent className="p-0">
                                    {/* Questionnaire row */}
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleQuestionnaire(q.id)}
                                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-slate-900">{q.name}</span>
                                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-slate-100 text-slate-500">
                                                    {q.answeredCount}/{q.questionCount} answered
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hasAttachments && (
                                                <button
                                                    onClick={() => toggleExpand(q.id)}
                                                    className={cn(
                                                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors",
                                                        isExpanded
                                                            ? "bg-amber-50 text-amber-700"
                                                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <Paperclip className="h-3 w-3" />
                                                    {q.files.length} file{q.files.length !== 1 ? "s" : ""}
                                                    {isExpanded
                                                        ? <ChevronDown className="h-3 w-3" />
                                                        : <ChevronRight className="h-3 w-3" />
                                                    }
                                                </button>
                                            )}
                                            {!hasAttachments && (
                                                <span className="text-[11px] text-slate-300 italic">No attachments</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded files list */}
                                    {isExpanded && hasAttachments && (
                                        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 space-y-1">
                                            <div className="flex items-center justify-between py-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    Question Attachments
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const allFileIds = q.files.map((f) => f.id);
                                                        const allSelected = allFileIds.every((id) => selectedFiles.has(id));
                                                        setSelectedFiles((prev) => {
                                                            const next = new Set(prev);
                                                            allFileIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
                                                            return next;
                                                        });
                                                    }}
                                                    className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
                                                >
                                                    {q.files.every((f) => selectedFiles.has(f.id)) ? "Deselect All" : "Select All"}
                                                </button>
                                            </div>
                                            {q.files.map((f) => (
                                                <div
                                                    key={f.id}
                                                    className={cn(
                                                        "flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
                                                        selectedFiles.has(f.id) ? "bg-indigo-50/60" : "hover:bg-white"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={selectedFiles.has(f.id)}
                                                        onCheckedChange={() => toggleFile(f.id)}
                                                        className="h-3.5 w-3.5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                    />
                                                    {fileIcon(f.name)}
                                                    <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
                                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono border-slate-200 text-slate-400 shrink-0">
                                                        {f.questionRef}
                                                    </Badge>
                                                    <span className="text-[11px] text-slate-400 shrink-0">{f.size}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* ─── Supporting Documents Section ────────────── */}
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supporting Documents</span>
                        <span className="text-[10px] text-slate-400">(not linked to specific questions)</span>
                    </div>
                    <button
                        onClick={selectAllDocs}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        {selectedDocs.size === MOCK_SUPPORTING_DOCS.length ? "Deselect All" : "Select All"}
                    </button>
                </div>

                <Card className="border-slate-200">
                    <CardContent className="p-0 divide-y divide-slate-50">
                        {MOCK_SUPPORTING_DOCS.map((doc) => (
                            <div
                                key={doc.id}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 transition-colors",
                                    selectedDocs.has(doc.id) ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                                )}
                            >
                                <Checkbox
                                    checked={selectedDocs.has(doc.id)}
                                    onCheckedChange={() => toggleDoc(doc.id)}
                                    className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                />
                                {fileIcon(doc.name)}
                                <span className="text-sm font-medium text-slate-700 flex-1 truncate">{doc.name}</span>
                                <span className="text-[11px] text-slate-400 shrink-0">{doc.size}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* ─── Generate Bar ────────────────────────────── */}
            <div className="sticky bottom-0 z-10">
                <Card className={cn(
                    "border transition-all",
                    hasAnythingSelected
                        ? "border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/80 shadow-lg"
                        : "border-slate-200 bg-slate-50"
                )}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <PackageCheck className="h-4 w-4 text-indigo-500" />
                                    <span>
                                        <span className="font-semibold text-slate-900">{selectedQuestionnaires.size}</span> questionnaire{selectedQuestionnaires.size !== 1 ? "s" : ""}
                                    </span>
                                    {totalSelectedFiles > 0 && (
                                        <>
                                            <span className="text-slate-300">·</span>
                                            <span>
                                                <span className="font-semibold text-slate-900">{totalSelectedFiles}</span> file{totalSelectedFiles !== 1 ? "s" : ""}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {outputIsZip && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[10px]">
                                        <Archive className="h-3 w-3" />
                                        ZIP Archive
                                    </Badge>
                                )}
                                {!outputIsZip && selectedQuestionnaires.size > 0 && (
                                    <Badge variant="outline" className={cn(
                                        "gap-1 text-[10px]",
                                        format === "pdf"
                                            ? "bg-red-50 text-red-600 border-red-200"
                                            : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                    )}>
                                        {format === "pdf" ? <File className="h-3 w-3" /> : <FileSpreadsheet className="h-3 w-3" />}
                                        {format === "pdf" ? "PDF" : "Excel"} Output
                                    </Badge>
                                )}
                            </div>
                            <Button
                                className={cn(
                                    "gap-2 transition-all",
                                    hasAnythingSelected
                                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                )}
                                disabled={!hasAnythingSelected || isGenerating}
                                onClick={handleGenerate}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4" />
                                        Generate Output Pack
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
