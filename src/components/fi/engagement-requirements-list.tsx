"use client";

import { useState } from "react";
import { Search, Filter, FileText, ArrowRight, Shield, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Card } from "@/components/ui/card";
import { QuestionnaireActions } from "@/components/fi/questionnaire-actions";

interface EngagementRequirementsListProps {
    engagementId: string;
    questionnaires: {
        id: string;
        name: string;
        status: string;
    }[];
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
                    <div key={q.id} className="group bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-900">{q.name}</h4>
                                <p className="text-xs text-slate-500">Source: Digital Form • Client Submitted</p>
                            </div>
                        </div>


                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">Ready</Badge>
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
                    </div>
                )}
            </div>
        </div>
    );
}
