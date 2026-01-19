
"use client";


import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle, AlertCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionDetailView } from "./question-detail-view";

interface Question {
    id: string;
    text: string;
    answer: string | null;
    status: string;
    order: number;
}

interface QuestionnaireQAModeProps {
    questions: Question[];
    // TODO: Add save/update handlers
}

export function QuestionnaireQAMode({ questions }: QuestionnaireQAModeProps) {
    const [activeQuestionId, setActiveQuestionId] = React.useState<string | null>(
        questions.length > 0 ? questions[0].id : null
    );

    const activeQuestion = questions.find(q => q.id === activeQuestionId);

    return (
        <div className="flex h-full bg-slate-50">
            {/* Left Sidebar: Question List */}
            <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">Questions</h3>
                    <p className="text-xs text-slate-500">{questions.length} items to review</p>
                </div>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-slate-100">
                        {questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => setActiveQuestionId(q.id)}
                                id={`question-${q.id}`}
                                className={cn(
                                    "w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-3",
                                    activeQuestionId === q.id ? "bg-indigo-50/50 border-l-4 border-l-indigo-500" : "border-l-4 border-l-transparent"
                                )}
                            >
                                <div className="mt-1">
                                    {q.status === 'DONE' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-slate-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-medium line-clamp-2", activeQuestionId === q.id ? "text-indigo-900" : "text-slate-700")}>
                                        <span className="text-slate-400 mr-2">#{idx + 1}</span>
                                        {q.text}
                                    </p>
                                    {q.answer && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">
                                            "{q.answer}"
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Panel: Active Question Detail */}
            <div className="flex-1 flex flex-col">
                {activeQuestion ? (
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="max-w-2xl mx-auto">
                            <QuestionDetailView
                                question={activeQuestion as any}
                                totalQuestions={questions.length}
                                currentIndex={questions.findIndex(q => q.id === activeQuestion.id)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                        Select a question to view details
                    </div>
                )}
            </div>
        </div>
    );
}
