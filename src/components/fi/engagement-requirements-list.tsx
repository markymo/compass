"use client";

import { useState } from "react";
import { Search, Filter, FileText, ArrowRight, Shield, AlertCircle, Terminal, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Card } from "@/components/ui/card";
import { QuestionnaireActions } from "@/components/fi/questionnaire-actions";

interface EngagementRequirementsListProps {
    engagementId: string;
    questionnaires: {
        id: string;
        name: string;
        status: string;
        processingLogs?: any; // Start optional
    }[];
}

function LogViewer({ logs }: { logs: any[] }) {
    if (!logs || logs.length === 0) return <div className="text-xs text-slate-400 p-2">No logs available.</div>;

    return (
        <ScrollArea className="h-64 w-full rounded border bg-slate-950 p-2 text-xs font-mono">
            {logs.map((log, i) => (
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
        </ScrollArea>
    );
}

export function EngagementRequirementsList({ engagementId, questionnaires }: EngagementRequirementsListProps) {
    const [search, setSearch] = useState("");

    const filteredQuestionnaires = questionnaires.filter(q =>
        q.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-400" /> Requirements List
                </h3>
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Filter by questionnaire..."
                        className="pl-9 h-9 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3">
                {/* 1. Static Mock Item based on wireframe (always show to demo) 
                    In real app, these would also be filtered or part of the 'questionnaires' list
                */}
                <div className="group bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900">Certificate of Incorporation</h4>
                            <p className="text-xs text-slate-500">Source: <span className="font-mono bg-slate-100 px-1 rounded">cert_inc.pdf</span> • AI Extracted</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100">Review</Badge>
                        <Button size="sm" variant="ghost" className="text-slate-400 group-hover:text-indigo-600">
                            Review <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>

                {/* 2. Dynamic Questionnaires */}
                {filteredQuestionnaires.map((q) => (
                    <div key={q.id} className="group bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-900">{q.name}</h4>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    {/* Source: Digital Form • Client Submitted */}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* STATUS BADGE WITH LOGS POPOVER */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <div className="cursor-pointer">
                                        {q.status === 'DIGITIZING' ? (
                                            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse cursor-pointer hover:bg-indigo-100 transition-colors">
                                                Digitizing...
                                            </Badge>
                                        ) : q.status === 'DRAFT' ? (
                                            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200 cursor-pointer hover:bg-slate-100">
                                                Draft
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 cursor-pointer hover:bg-emerald-100">
                                                Ready
                                            </Badge>
                                        )}
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="end">
                                    <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                                        <h4 className="font-medium text-xs uppercase tracking-wide text-slate-500">Processing Logs</h4>
                                        <Badge variant="outline" className="text-[10px] h-5">{q.status}</Badge>
                                    </div>
                                    <div className="p-0">
                                        <LogViewer logs={q.processingLogs || []} />
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Link href={`./${engagementId}/workbench/${q.id}`}>
                                <Button size="sm" variant="ghost" className="text-slate-400 group-hover:text-indigo-600">
                                    Review <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            </Link>
                            <QuestionnaireActions id={q.id} name={q.name} />
                        </div>
                    </div>
                ))}

                {filteredQuestionnaires.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        No questionnaires found matching "{search}"
                        {search === "" && questionnaires.length === 0 && (
                            <div className="mt-2 text-slate-300">Upload a questionnaire to get started.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
