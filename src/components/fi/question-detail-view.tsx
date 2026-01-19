
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from 'next/link';

export interface QuestionDetail {
    id: string;
    text: string;
    answer: string | null;
    status: string;
    order: number;
    // Context fields (optional, for standalone context)
    questionnaire?: {
        id: string;
        name: string;
        fiEngagement?: {
            id: string;
            clientLE?: {
                name: string;
            }
        }
    }
}

interface QuestionDetailViewProps {
    question: QuestionDetail;
    totalQuestions?: number;
    currentIndex?: number;
    onSave?: (answer: string) => void;
    embedded?: boolean; // If true, might hide some context or styling
}

export function QuestionDetailView({ question, totalQuestions, currentIndex, onSave, embedded = false }: QuestionDetailViewProps) {
    const [answer, setAnswer] = React.useState(question.answer || "");

    // Link to full context
    const engagementId = question.questionnaire?.fiEngagement?.id;
    const questionnaireId = question.questionnaire?.id;
    const workbenchUrl = engagementId && questionnaireId
        ? `/app/fi/engagements/${engagementId}/workbench/${questionnaireId}?question=${question.id}`
        : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    {totalQuestions !== undefined && currentIndex !== undefined ? (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600">
                            Question {currentIndex + 1} of {totalQuestions}
                        </Badge>
                    ) : (
                        <div />
                    )}

                    {workbenchUrl && embedded && (
                        <Link href={workbenchUrl}>
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 items-center gap-1">
                                Open in Workbench <ExternalLink className="w-3 h-3" />
                            </Button>
                        </Link>
                    )}
                </div>

                <h1 className="text-xl font-semibold text-slate-900 leading-relaxed">
                    {question.text}
                </h1>

                {embedded && question.questionnaire && (
                    <p className="text-xs text-slate-400">
                        Context: {question.questionnaire.fiEngagement?.clientLE?.name} / {question.questionnaire.name}
                    </p>
                )}
            </div>

            {/* Answer Area (Read-Only for FI) */}
            <Card className="border-indigo-100 shadow-sm">
                <CardContent className="p-0">
                    <div className="p-3 bg-indigo-50/30 border-b border-indigo-100 flex justify-between items-center">
                        <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">Refined Answer</span>
                        <div className="flex gap-2">
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none shadow-none">Read Only</Badge>
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none shadow-none">Auto-Filled</Badge>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50/30">
                        <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed min-h-[100px]">
                            {answer || <span className="text-slate-400 italic">No answer provided.</span>}
                        </div>
                        {/* Hidden textarea if we ever need form submission, but UI is read-only div for better reading experience */}
                    </div>

                    {/* FI Actions */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-2">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Add a comment or query..."
                                className="w-full text-xs border-slate-200 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-50">
                                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                                Return to Client
                            </Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Sign Off
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Context / Source (Placeholder) */}
            <div className="space-y-2 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    Reviewer Comments
                </h4>
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500 italic text-center">
                    No comments yet.
                </div>
            </div>
        </div>
    );
}
