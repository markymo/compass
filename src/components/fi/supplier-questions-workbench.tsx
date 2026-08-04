"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Search,
    Filter,
    Building2,
    FileText,
    Clock,
    AlertCircle,
    Lock,
    ShieldCheck,
    Paperclip,
    HelpCircle,
    Download,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { SupplierQuestionView, FIWorkbenchData } from "@/actions/fi";
import { resolveFieldForDisplay } from "@/lib/master-data/field-interpreter";
import { FieldValueRenderer } from "@/components/client/fields/FieldValueRenderer";

interface SupplierQuestionsWorkbenchProps {
    orgId: string;
    data: FIWorkbenchData;
}

export function SupplierQuestionsWorkbench({ orgId, data }: SupplierQuestionsWorkbenchProps) {
    const [search, setSearch] = useState("");
    const [leFilter, setLeFilter] = useState("ALL");
    const [qFilter, setQFilter] = useState("ALL");
    const [catFilter, setCatFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
        data.questions.length > 0 ? data.questions[0].id : null
    );

    const filteredQuestions = useMemo(() => {
        return data.questions.filter((q: SupplierQuestionView) => {
            const searchText = search.toLowerCase();
            const qText = (q.questionText || q.text || "").toLowerCase();
            const qNum = (q.questionNumber || "").toLowerCase();
            const leName = (q.clientLEName || q.leName || "").toLowerCase();
            const qName = (q.questionnaireName || "").toLowerCase();
            const secName = (q.sectionName || "").toLowerCase();

            // Search operates strictly across safe question metadata
            const matchesSearch =
                qText.includes(searchText) ||
                qNum.includes(searchText) ||
                leName.includes(searchText) ||
                qName.includes(searchText) ||
                secName.includes(searchText);

            const matchesLE = leFilter === "ALL" || (q.clientLEName || q.leName) === leFilter;
            const matchesQ = qFilter === "ALL" || q.questionnaireName === qFilter;
            const matchesCat = catFilter === "ALL" || q.category === catFilter;
            const matchesStatus = statusFilter === "ALL" || q.answerVisibility === statusFilter;

            return matchesSearch && matchesLE && matchesQ && matchesCat && matchesStatus;
        });
    }, [data.questions, search, leFilter, qFilter, catFilter, statusFilter]);

    const selectedQuestion = useMemo(() => {
        if (!selectedQuestionId) return filteredQuestions[0] || null;
        return data.questions.find((q) => q.id === selectedQuestionId) || filteredQuestions[0] || null;
    }, [data.questions, filteredQuestions, selectedQuestionId]);

    const counts = data.counts || {
        total: data.questions.length,
        notShared: data.questions.filter((q) => q.answerVisibility === "NOT_SHARED").length,
        shared: data.questions.filter((q) => q.answerVisibility === "SHARED").length,
        released: data.questions.filter((q) => q.answerVisibility === "RELEASED").length
    };

    const selectedDisplayModel = useMemo(() => {
        if (!selectedQuestion || selectedQuestion.answerVisibility === "NOT_SHARED") {
            return null;
        }

        return resolveFieldForDisplay(
            selectedQuestion.answer,
            selectedQuestion.provenance
                ? {
                    type: selectedQuestion.provenance.source || "USER_INPUT",
                    timestamp: selectedQuestion.provenance.timestamp
                }
                : null,
            {
                fieldNo: selectedQuestion.questionNumber ? parseInt(selectedQuestion.questionNumber, 10) || 0 : 0,
                label: selectedQuestion.questionText || selectedQuestion.text,
                category: selectedQuestion.category,
                appDataType: (selectedQuestion as any).appDataType,
                codeSystem: (selectedQuestion as any).codeSystem
            }
        );
    }, [selectedQuestion]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full">
            {/* A. Summary Header & Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <HelpCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{counts.total}</div>
                        <div className="text-xs text-slate-500 font-medium">Total Questions</div>
                    </div>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <Lock className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{counts.notShared}</div>
                        <div className="text-xs text-slate-500 font-medium">Awaiting Client</div>
                    </div>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{counts.shared}</div>
                        <div className="text-xs text-slate-500 font-medium">Shared (Provisional)</div>
                    </div>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900">{counts.released}</div>
                        <div className="text-xs text-slate-500 font-medium">Released (Formal)</div>
                    </div>
                </Card>
            </div>

            {/* B. Workbench Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by question text, number, client, questionnaire..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={leFilter} onValueChange={setLeFilter}>
                            <SelectTrigger className="w-[170px] bg-slate-50/50 border-slate-200">
                                <Building2 className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Client" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Clients</SelectItem>
                                {data.les.map((le) => (
                                    <SelectItem key={le} value={le}>{le}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={qFilter} onValueChange={setQFilter}>
                            <SelectTrigger className="w-[180px] bg-slate-50/50 border-slate-200">
                                <FileText className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Questionnaire" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Questionnaires</SelectItem>
                                {data.questionnaires.map((q) => (
                                    <SelectItem key={q} value={q}>{q}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={catFilter} onValueChange={setCatFilter}>
                            <SelectTrigger className="w-[160px] bg-slate-50/50 border-slate-200">
                                <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Categories</SelectItem>
                                {data.categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] bg-slate-50/50 border-slate-200">
                                <div className="h-2 w-2 rounded-full bg-teal-500 mr-2" />
                                <SelectValue placeholder="Visibility" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Visibility</SelectItem>
                                <SelectItem value="NOT_SHARED">Awaiting Client</SelectItem>
                                <SelectItem value="SHARED">Shared (Provisional)</SelectItem>
                                <SelectItem value="RELEASED">Released (Formal)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* C. Master-Detail Workbench Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Question List (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-3 max-h-[750px] overflow-y-auto pr-1 no-scrollbar">
                    {filteredQuestions.map((q) => {
                        const isSelected = selectedQuestion?.id === q.id;
                        const isShared = q.answerVisibility === "SHARED";
                        const isReleased = q.answerVisibility === "RELEASED";

                        return (
                            <div
                                key={q.id}
                                onClick={() => setSelectedQuestionId(q.id)}
                                className={cn(
                                    "p-4 rounded-xl border transition-all cursor-pointer bg-white space-y-2.5 relative group",
                                    isSelected
                                        ? "border-teal-500 ring-2 ring-teal-500/20 shadow-md bg-teal-50/10"
                                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {q.questionNumber && (
                                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                #{q.questionNumber}
                                            </span>
                                        )}
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-slate-200 bg-slate-50"
                                        >
                                            {q.category}
                                        </Badge>
                                    </div>

                                    {/* Visibility State Pill */}
                                    {isReleased ? (
                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold py-0.5">
                                            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" /> Released
                                        </Badge>
                                    ) : isShared ? (
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold py-0.5">
                                            <Clock className="h-3 w-3 mr-1 text-blue-600" /> Shared
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] font-semibold py-0.5">
                                            <Lock className="h-3 w-3 mr-1 text-slate-400" /> Awaiting Client
                                        </Badge>
                                    )}
                                </div>

                                <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                                    {q.questionText || q.text}
                                </h3>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                    <div className="flex items-center gap-3 truncate">
                                        <span className="font-semibold text-slate-700 truncate" title={q.clientLEName}>
                                            {q.clientLEName}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="truncate" title={q.questionnaireName}>
                                            {q.questionnaireName}
                                        </span>
                                    </div>

                                    {q.documents && q.documents.length > 0 && (
                                        <span className="flex items-center gap-1 text-slate-500 font-medium shrink-0 ml-2" title={`${q.documents.length} visible document(s)`}>
                                            <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                                            {q.documents.length}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredQuestions.length === 0 && (
                        <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300">
                            <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                            <h4 className="text-base font-bold text-slate-800">No questions found</h4>
                            <p className="text-slate-500 text-xs mt-1">Adjust search or filters to browse questions.</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Selected Question Detail Panel (lg:col-span-7) */}
                <div className="lg:col-span-7 sticky top-24">
                    {selectedQuestion ? (
                        <Card className="bg-white border-slate-200 shadow-md overflow-hidden">
                            <CardHeader className="border-b bg-slate-50/50 p-6 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        {selectedQuestion.questionNumber && (
                                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-extrabold text-xs">
                                                Question #{selectedQuestion.questionNumber}
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="bg-white text-slate-600 border-slate-300 text-xs font-semibold">
                                            {selectedQuestion.category}
                                        </Badge>
                                    </div>

                                    {/* Relationship & Questionnaire Context Links */}
                                    <div className="flex items-center gap-2">
                                        <Link href={`/app/s/${orgId}`}>
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-slate-600 hover:text-slate-900">
                                                <Building2 className="h-3.5 w-3.5" /> Relationship <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>

                                <CardTitle className="text-lg font-bold text-slate-900 leading-snug">
                                    {selectedQuestion.questionText || selectedQuestion.text}
                                </CardTitle>

                                {/* Context Breadcrumb Row */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">Client:</span>
                                        <span className="font-semibold text-slate-800">{selectedQuestion.clientLEName}</span>
                                    </div>
                                    {selectedQuestion.clientOrganizationName && (
                                        <div>
                                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">Group:</span>
                                            <span className="font-medium text-slate-700">{selectedQuestion.clientOrganizationName}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">Questionnaire:</span>
                                        <span className="font-medium text-slate-700">{selectedQuestion.questionnaireName}</span>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-6 space-y-6">
                                {/* Guidance if present */}
                                {selectedQuestion.guidance && (
                                    <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 text-xs text-blue-900 leading-relaxed space-y-1">
                                        <div className="font-bold uppercase tracking-wider text-[10px] text-blue-600">Guidance</div>
                                        <div>{selectedQuestion.guidance}</div>
                                    </div>
                                )}

                                {/* Answer State Banner & Content */}
                                {selectedQuestion.answerVisibility === "NOT_SHARED" && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
                                        <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm">
                                            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                                            <span>Answer not yet shared by Client</span>
                                        </div>
                                        <p className="text-xs text-amber-700 leading-relaxed">
                                            The Client has not shared or released an answer for this question yet. Internal Client draft and approval states remain private.
                                        </p>
                                    </div>
                                )}

                                {selectedQuestion.answerVisibility === "SHARED" && (
                                    <div className="space-y-4">
                                        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-blue-600" />
                                                <div>
                                                    <div className="text-xs font-bold text-blue-900">Shared Answer — Provisional and subject to change</div>
                                                    <div className="text-[11px] text-blue-700">
                                                        {selectedQuestion.sharedAt ? `Shared on ${format(new Date(selectedQuestion.sharedAt), "dd MMM yyyy")}` : "Provisional Shared"}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-bold text-[10px]">
                                                Provisional
                                            </Badge>
                                        </div>

                                        {/* Canonical Answer Renderer Container */}
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Answer</div>
                                            {selectedDisplayModel && (
                                                <FieldValueRenderer field={selectedDisplayModel} className="text-sm font-medium text-slate-800" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedQuestion.answerVisibility === "RELEASED" && (
                                    <div className="space-y-4">
                                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                                <div>
                                                    <div className="text-xs font-bold text-emerald-900">Released Answer — Formally issued and locked</div>
                                                    <div className="text-[11px] text-emerald-700">
                                                        {selectedQuestion.releasedAt ? `Released on ${format(new Date(selectedQuestion.releasedAt), "dd MMM yyyy")}` : "Formal Release"}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                                                Formal Release
                                            </Badge>
                                        </div>

                                        {/* Canonical Answer Renderer Container */}
                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Answer</div>
                                            {selectedDisplayModel && (
                                                <FieldValueRenderer field={selectedDisplayModel} className="text-sm font-medium text-slate-800" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Documents Section (Only visible for SHARED or RELEASED) */}
                                {selectedQuestion.documents && selectedQuestion.documents.length > 0 && selectedQuestion.answerVisibility !== "NOT_SHARED" && (
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                            <Paperclip className="h-4 w-4 text-slate-500" />
                                            Supporting Documents ({selectedQuestion.documents.length})
                                        </div>

                                        <div className="space-y-2">
                                            {selectedQuestion.documents.map((doc) => (
                                                <div key={doc.id} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-slate-800 truncate" title={doc.fileName}>
                                                                {doc.fileName}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "Document"} • {format(new Date(doc.uploadedAt), "dd MMM yyyy")}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Link href={`/api/documents/${doc.id}/download`} target="_blank">
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-600 hover:text-slate-900 gap-1">
                                                            <Download className="h-3.5 w-3.5" /> Download
                                                        </Button>
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="py-24 text-center bg-white rounded-xl border border-dashed border-slate-300 p-8">
                            <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-slate-800">Select a question</h3>
                            <p className="text-slate-500 text-xs mt-1">Choose a question from the navigation list to view its complete structure and answer status.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
