"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
    CheckCircle2,
    Clock,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface FIWorkbenchProps {
    orgId: string;
    data: {
        questions: any[];
        les: string[];
        questionnaires: string[];
        categories: string[];
    };
}

export function FIWorkbench({ orgId, data }: FIWorkbenchProps) {
    const [search, setSearch] = useState("");
    const [leFilter, setLeFilter] = useState("ALL");
    const [qFilter, setQFilter] = useState("ALL");
    const [catFilter, setCatFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const filteredQuestions = useMemo(() => {
        return data.questions.filter(q => {
            const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase()) ||
                (q.answer && q.answer.toLowerCase().includes(search.toLowerCase()));
            const matchesLE = leFilter === "ALL" || q.leName === leFilter;
            const matchesQ = qFilter === "ALL" || q.questionnaireName === qFilter;
            const matchesCat = catFilter === "ALL" || q.category === catFilter;
            const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;

            return matchesSearch && matchesLE && matchesQ && matchesCat && matchesStatus;
        });
    }, [data.questions, search, leFilter, qFilter, catFilter, statusFilter]);

    return (
        <div className="space-y-6">
            {/* Filters Header */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search questions or answers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={leFilter} onValueChange={setLeFilter}>
                            <SelectTrigger className="w-[180px] bg-slate-50/50 border-slate-200">
                                <Building2 className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue placeholder="Legal Entity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Clients</SelectItem>
                                {data.les.map(le => (
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
                                {data.questionnaires.map(q => (
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
                                {data.categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] bg-slate-50/50 border-slate-200">
                                <div className="h-2 w-2 rounded-full bg-teal-500 mr-2" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
                                <SelectItem value="SHARED">Shared</SelectItem>
                                <SelectItem value="RELEASED">Released</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Questions List */}
            <div className="grid gap-4">
                {filteredQuestions.map((q) => (
                    <FIQuestionCard key={q.id} question={q} />
                ))}

                {filteredQuestions.length === 0 && (
                    <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-300">
                        <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">No questions found</h3>
                        <p className="text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function FIQuestionCard({ question }: { question: any }) {
    const statusDate = question.status === "RELEASED"
        ? (question.releasedAt ? new Date(question.releasedAt) : new Date(question.updatedAt))
        : (question.approvedAt ? new Date(question.approvedAt) : new Date(question.updatedAt));

    const statusLabel = question.status === "RELEASED" ? "Released" : "Approved";

    return (
        <Card className="group transition-all shadow-sm overflow-hidden border border-slate-200 hover:border-teal-200 hover:shadow-md bg-white">
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-stretch">
                    {/* Left Sidebar Context */}
                    <div className="md:w-[220px] bg-slate-50/50 border-r border-slate-100 p-4 space-y-3 shrink-0">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <Building2 className="h-3 w-3" />
                                Legal Entity
                            </div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors truncate" title={question.leName}>
                                {question.leName}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <FileText className="h-3 w-3" />
                                Questionnaire
                            </div>
                            <div className="text-xs font-semibold text-slate-600 truncate" title={question.questionnaireName}>
                                {question.questionnaireName}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100/50 space-y-2">
                            <Badge variant="outline" className="bg-white text-[10px] font-bold text-slate-500 border-slate-200 py-0 uppercase tracking-tighter">
                                {question.category}
                            </Badge>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                <Clock className="h-3 w-3" />
                                {statusLabel} {format(statusDate, "dd MMM yyyy")}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 p-6 space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-start gap-3">
                                <span className="text-slate-300 font-black text-xs mt-1 shrink-0 italic">Q</span>
                                <h4 className="text-sm font-bold text-slate-900 leading-relaxed">
                                    {question.text}
                                </h4>
                            </div>
                        </div>

                        <div className={cn(
                            "rounded-xl p-4 border relative group/answer",
                            question.answer ? "bg-teal-50/30 border-teal-100/50" : "bg-red-50/30 border-red-100/50"
                        )}>
                            <div className="flex items-start gap-3">
                                <span className={cn("font-black text-xs mt-1 shrink-0 italic", question.answer ? "text-teal-400" : "text-red-400")}>A</span>
                                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {question.answer ? (
                                        question.answer
                                    ) : (
                                        <span className="text-red-400 italic font-medium">No answer provided yet.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
